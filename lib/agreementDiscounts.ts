import { api } from './api';

// Descuentos de convenio (M12): catálogo de porcentajes (1..100) por negocio.
// Patrón espejo de lib/loyalty (promociones): CRUD admin + lectura desde el POS.
// El POS muestra un botón por cada descuento ACTIVO (ordenados por %); el servidor
// calcula el monto — el cliente solo manda el id del descuento elegido.

export type AgreementDiscount = {
  id: string;
  percent: number; // 1..100
  status: 'active' | 'inactive'; // inactive = archivado
  createdAt: string;
  updatedAt: string;
};

export type AgreementDiscountStatusFilter = 'active' | 'inactive' | 'all';

// Lista ordenada por % ascendente (lo garantiza el servidor). El POS lee los activos.
export const listAgreementDiscounts = (status: AgreementDiscountStatusFilter = 'active') =>
  api
    .get<{ items: AgreementDiscount[] }>(`/agreement-discounts?status=${status}`)
    .then((r) => r.items);

export const getAgreementDiscount = (id: string) =>
  api.get<{ discount: AgreementDiscount }>(`/agreement-discounts/${id}`).then((r) => r.discount);

export const createAgreementDiscount = (percent: number) =>
  api.post<{ discount: AgreementDiscount }>('/agreement-discounts', { percent }).then((r) => r.discount);

export const updateAgreementDiscount = (id: string, percent: number) =>
  api
    .put<{ discount: AgreementDiscount }>(`/agreement-discounts/${id}`, { percent })
    .then((r) => r.discount);

// Baja = archivar (soft delete → status='inactive'). Responde 204 sin cuerpo.
export const archiveAgreementDiscount = (id: string) =>
  api.delete<void>(`/agreement-discounts/${id}`);
