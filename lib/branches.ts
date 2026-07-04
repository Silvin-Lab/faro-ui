import { api } from './api';

// Sucursal del negocio (M7). Ver contrato: GET/POST /branches, PATCH/DELETE /branches/{id}.
export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

// Lista las sucursales del tenant. activeOnly => ?status=active (para selectores).
export const listBranches = (activeOnly = false) => {
  const q = activeOnly ? '?status=active' : '';
  return api.get<{ items: Branch[] }>(`/branches${q}`).then((r) => r.items);
};

export const createBranch = (input: { name: string }) =>
  api.post<{ branch: Branch }>('/branches', input).then((r) => r.branch);

export const updateBranch = (
  id: string,
  input: { name?: string; status?: 'active' | 'inactive' },
) => api.patch<{ branch: Branch }>(`/branches/${id}`, input).then((r) => r.branch);

// Borrado físico. El backend responde 409 branch_in_use si hay users/ventas asociadas.
export const deleteBranch = (id: string) => api.delete<void>(`/branches/${id}`);
