import { api } from './api';

// Referencia ligera de sucursal (membresías y sesión). El CRUD completo vive en lib/branches.
export type BranchRef = { id: string; name: string };

export type User = {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  isSuperAdmin: boolean;
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

export const createUser = (input: {
  email: string;
  password: string;
  name: string;
  branchIds: string[];
}) => api.post<{ user: User }>('/users', input);

// branchIds reemplaza el set completo de membresías del usuario.
export const updateUser = (id: string, input: { branchIds?: string[]; name?: string }) =>
  api.patch<{ user: User }>(`/users/${id}`, input);

export const createTenant = (input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}) => api.post('/tenants', input);
