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

export const createCustomer = (input: { phone: string; firstName: string; lastName: string }) =>
  api.post<{ customer: Customer }>('/customers', input).then((r) => r.customer);
