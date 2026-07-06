import { api } from './api';

// Referencia ligera de sucursal (membresías y sesión). El CRUD completo vive en lib/branches.
export type BranchRef = { id: string; name: string };

// M8: rol del usuario. super_admin administra el negocio; los demás operan una sucursal.
export type Role = 'super_admin' | 'branch_admin' | 'cashier' | 'barista';
// Roles asignables a un usuario de sucursal (no incluye super_admin).
export type BranchRole = 'branch_admin' | 'cashier' | 'barista';

export type User = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  // M8: rol explícito (viene en /auth/me, /auth/login y GET /users).
  role: Role;
  status: string;
  createdAt: string;
  // M7 v2: membresías del usuario (M:N). Presente en el listado de /users.
  branches?: BranchRef[];
};

// Marca del negocio expuesta por /auth/me y /auth/login (null para super admin).
export type Tenant = {
  id: string;
  name: string;
  faviconUrl: string | null;
};

// Sesión ampliada (ADR-007): user + tenant + membresías + sucursal activa.
export type Session = {
  user: User;
  tenant: Tenant | null;
  branches: BranchRef[];
  activeBranchId: string | null;
  mustSelectBranch: boolean;
};

// Destino final para un usuario con la sucursal ya resuelta (post-login o post select-branch).
// super_admin y branch_admin aterrizan en Reportes; cashier/barista en el POS.
export function roleLandingPath(role: Role): string {
  return role === 'super_admin' || role === 'branch_admin' ? '/reports' : '/pos';
}

// Destino tras autenticar: si el usuario operativo debe elegir sucursal, primero /select-branch;
// si no, el aterrizaje por rol. (El super admin nunca tiene mustSelectBranch.)
export function postLoginPath(session: Session): string {
  if (!session.user.isSuperAdmin && session.mustSelectBranch) return '/select-branch';
  return roleLandingPath(session.user.role);
}

// /auth/me y /auth/login devuelven la sesión completa.
export const getMe = () => api.get<Session>('/auth/me');

export const login = (email: string, password: string) =>
  api.post<Session>('/auth/login', { email, password });

export const logout = () => api.post<void>('/auth/logout', {});

// Cambio de contraseña del propio usuario (super admin o de sucursal).
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<void>('/auth/change-password', { currentPassword, newPassword });

// Fija la sucursal activa (re-emite la cookie con el claim activeBranchId).
export const selectBranch = (branchId: string) =>
  api.post<{ activeBranchId: string; branch: BranchRef }>('/auth/select-branch', { branchId });

export const listUsers = () => api.get<{ items: User[] }>('/users').then((r) => r.items);

// M8: acepta role. Si role='super_admin' NO se envían branchIds (el super admin es global).
export const createUser = (input: {
  email: string;
  password: string;
  name: string;
  role: Role;
  branchIds: string[];
}) => {
  const { branchIds, ...rest } = input;
  const body = input.role === 'super_admin' ? rest : { ...rest, branchIds };
  return api.post<{ user: User }>('/users', body);
};

// branchIds reemplaza el set completo de membresías del usuario.
// M8: role solo puede cambiar entre los roles de sucursal (branch_admin/cashier/barista).
export const updateUser = (
  id: string,
  input: { branchIds?: string[]; name?: string; role?: BranchRole },
) => api.patch<{ user: User }>(`/users/${id}`, input);

export const createTenant = (input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}) => api.post('/tenants', input);
