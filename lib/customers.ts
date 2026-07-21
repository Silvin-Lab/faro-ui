import { api } from './api';

export type Customer = {
  id: string;
  tenantId: string;
  phone: string;
  firstName: string;
  lastName: string;
  visits: number; // visitas del ciclo actual (lealtad)
  visitsLifetime: number; // acumulado de por vida (nunca reinicia)
  createdAt: string;
};

// Lookup exacto por teléfono (retrocompatibilidad; 404 si no existe).
export const findCustomerByPhone = (phone: string) =>
  api.get<{ customer: Customer }>(`/customers?phone=${encodeURIComponent(phone)}`).then((r) => r.customer);

// Búsqueda por nombre o teléfono (ILIKE). Devuelve lista ordenada por nombre.
export const searchCustomers = (q: string, limit = 20) =>
  api
    .get<{ items: Customer[] }>(`/customers?q=${encodeURIComponent(q)}&limit=${limit}`)
    .then((r) => r.items);

// Listado por default (sin texto de búsqueda), paginado con "mostrar más".
export const listCustomers = (limit = 20, offset = 0) =>
  api.get<{ items: Customer[] }>(`/customers?limit=${limit}&offset=${offset}`).then((r) => r.items);

// priorVisits (opcional): visitas que ya traía (tarjeta física), fijadas de una
// vez al crear — no requiere el permiso de admin de setCustomerVisits.
export const createCustomer = (input: {
  phone: string;
  firstName: string;
  lastName: string;
  priorVisits?: number;
}) => api.post<{ customer: Customer }>('/customers', input).then((r) => r.customer);

// Fija el contador de visitas del ciclo actual (visits ≥ 0) y sube el acumulado de por
// vida al menos a ese valor (nunca baja). Migración de tarjetas físicas de lealtad.
// Solo super_admin / branch_admin (el backend responde 403 en caso contrario).
export const setCustomerVisits = (id: string, visits: number) =>
  api.patch<{ customer: Customer }>(`/customers/${id}/visits`, { visits }).then((r) => r.customer);
