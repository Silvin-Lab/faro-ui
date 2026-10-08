import { api } from './api';

// Cliente del módulo Cierre de día / corte de caja (M11): sistematiza el cierre
// que hoy Vanta hace a mano (corte de caja, conteo de postres, mermas, insumos
// faltantes). Un cierre por (sucursal, fecha). Contratos espejo del backend real
// (`internal/dayclose`), montado en `/dayclose`.
//
// Envelope: todas las respuestas de recurso van como `{closure}`; el listado como
// `{items}`. Montos en centavos. En estado draft los totales son EN VIVO; en
// submitted son el snapshot congelado.

export type DayClosureStatus = 'draft' | 'submitted';

export type DayClosure = {
  id: string;
  branchId: string;
  branchName: string;
  closureDate: string; // YYYY-MM-DD
  status: DayClosureStatus;
  totalSalesCents: number | null;
  totalExpensesCents: number | null;
  cashExpectedCents: number | null;
  cashCountedCents: number | null;
  cashDiffCents: number | null;
  bakeryCountId: string | null;
  supplyRequisitionId: string | null;
  notes: string | null;
  createdByName: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Campos editables de un cierre en borrador (omitidos = no cambian).
export type DayClosurePatch = {
  cashCountedCents?: number;
  notes?: string;
  bakeryCountId?: string;
  supplyRequisitionId?: string;
};

export type ListDayClosuresParams = {
  branchId?: string; // solo super_admin
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

// Abrir (get-or-create) el cierre de la sucursal activa. Sin fecha = hoy. Devuelve
// el cierre existente (draft o submitted) o uno nuevo en draft.
export const openDayClosure = (date?: string) =>
  api
    .post<{ closure: DayClosure }>('/dayclose/open', date ? { date } : {})
    .then((r) => r.closure);

// Detalle de un cierre. En draft los totales vienen EN VIVO.
export const getDayClosure = (id: string) =>
  api.get<{ closure: DayClosure }>(`/dayclose/${id}`).then((r) => r.closure);

// Editar el borrador (persistencia incremental). 409 invalid_state si ya se envió.
export const updateDayClosure = (id: string, patch: DayClosurePatch) =>
  api.patch<{ closure: DayClosure }>(`/dayclose/${id}`, patch).then((r) => r.closure);

// Enviar el cierre (draft → submitted): congela el snapshot. 409 invalid_state si
// ya estaba enviado (doble clic / carrera entre pestañas).
export const submitDayClosure = (id: string) =>
  api.post<{ closure: DayClosure }>(`/dayclose/${id}/submit`, {}).then((r) => r.closure);

export const listDayClosures = (params?: ListDayClosuresParams) => {
  const p = new URLSearchParams();
  if (params?.branchId) p.set('branchId', params.branchId);
  if (params?.from) p.set('from', params.from);
  if (params?.to) p.set('to', params.to);
  const s = p.toString();
  return api
    .get<{ items: DayClosure[] }>(`/dayclose${s ? `?${s}` : ''}`)
    .then((r) => r.items);
};
