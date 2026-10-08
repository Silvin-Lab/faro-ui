import { api } from './api';
import type { BaseUnit } from './supplies';

// Cliente del módulo Requisiciones de insumos (M11): una sucursal solicita a la
// matriz los insumos que le faltan; la solicitud entra en una cola FIFO que el
// super_admin surte vía salidas de almacén. Contratos espejo del backend real
// (`internal/requisitions`), montado en `/requisitions`. Rutas bajo `/supplies`.
//
// Envelopes: los listados devuelven `{items}`; create/get/cancel/close devuelven
// el RequisitionDetail SIN envelope (writeJSON directo del detalle). Cantidades
// enteras en unidad base.

export { dateLabel, isToday } from './warehouse';

// Ciclo de vida: pending (nada surtido) → partial (algo surtido) → fulfilled
// (cerrada por el admin) | cancelled (cancelada por la dueña/admin sin surtir).
export type SupplyRequisitionStatus = 'pending' | 'partial' | 'fulfilled' | 'cancelled';

// Encabezado de una requisición (fila de la cola), con nombres resueltos.
export type SupplyRequisition = {
  id: string;
  branchId: string;
  branchName: string;
  status: SupplyRequisitionStatus;
  note: string | null;
  requestedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

// Línea de una requisición: insumo, cuánto se pidió y cuánto se ha surtido.
export type SupplyRequisitionItem = {
  id: string;
  supplyId: string;
  supplyName: string;
  baseUnit: BaseUnit;
  quantityRequested: number;
  quantityFulfilled: number;
  note: string | null;
};

// Salida de almacén (dispatch) ligada a la requisición: traza de lo surtido.
export type SupplyRequisitionMovement = {
  id: string;
  supplyId: string;
  supplyName: string;
  quantityBase: number;
  createdByName: string | null;
  createdAt: string;
};

// Detalle completo: encabezado + líneas + movimientos ligados.
export type SupplyRequisitionDetail = {
  requisition: SupplyRequisition;
  items: SupplyRequisitionItem[];
  movements: SupplyRequisitionMovement[];
};

// Sugerencia de reposición (insumo bajo su mínimo en la sucursal activa).
export type SupplyRequisitionSuggestion = {
  supplyId: string;
  supplyName: string;
  baseUnit: BaseUnit;
  stockBase: number;
  minQuantity: number;
  maxQuantity: number | null;
  suggestedQty: number;
};

// Línea de entrada al crear una requisición.
export type RequisitionLineInput = {
  supplyId: string;
  quantityBase: number; // >0, unidad base
  note?: string;
};

export type ListRequisitionsParams = {
  status?: SupplyRequisitionStatus; // el backend filtra por un solo estado
  branchId?: string; // solo super_admin; sucursal se fuerza a la suya
  q?: string; // nombre de insumo (búsqueda server-side)
};

function requisitionsQuery(params?: ListRequisitionsParams): string {
  if (!params) return '';
  const p = new URLSearchParams();
  if (params.status) p.set('status', params.status);
  if (params.branchId) p.set('branchId', params.branchId);
  if (params.q && params.q.trim() !== '') p.set('q', params.q.trim());
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Crear requisición — solo sucursal. `branchId` NO se envía: lo fuerza el backend
// desde la sucursal activa. Devuelve el detalle creado.
export const createRequisition = (input: { note?: string; items: RequisitionLineInput[] }) =>
  api.post<SupplyRequisitionDetail>('/requisitions/supplies', {
    ...(input.note && input.note.trim() !== '' ? { note: input.note.trim() } : {}),
    items: input.items.map((it) => ({
      supplyId: it.supplyId,
      quantityBase: it.quantityBase,
      ...(it.note && it.note.trim() !== '' ? { note: it.note.trim() } : {}),
    })),
  });

// Listar requisiciones (cola FIFO). Scope por rol en el backend: sucursal ve las
// suyas; super_admin ve todas (?branchId acota).
export const listRequisitions = (params?: ListRequisitionsParams) =>
  api
    .get<{ items: SupplyRequisition[] }>(`/requisitions/supplies${requisitionsQuery(params)}`)
    .then((r) => r.items);

// Detalle de una requisición (encabezado + líneas + movimientos).
export const getRequisition = (id: string) =>
  api.get<SupplyRequisitionDetail>(`/requisitions/supplies/${id}`);

// Cancelar — dueña o super_admin, solo si pending sin surtir. 409 invalid_state
// en cualquier otro caso.
export const cancelRequisition = (id: string) =>
  api.patch<SupplyRequisitionDetail>(`/requisitions/supplies/${id}/cancel`, {});

// Cerrar (partial → fulfilled) — solo super_admin, solo si parcialmente surtida.
// 409 invalid_state en cualquier otro caso.
export const closeRequisition = (id: string) =>
  api.patch<SupplyRequisitionDetail>(`/requisitions/supplies/${id}/close`, {});

// Sugerencias de reposición para la sucursal activa — solo sucursal.
export const listRequisitionSuggestions = () =>
  api
    .get<{ items: SupplyRequisitionSuggestion[] }>('/requisitions/supplies/suggestions')
    .then((r) => r.items);

// --- Helpers de presentación ---

// Falta = pedido − surtido (nunca negativo para la UI).
export const requisitionRemaining = (
  it: Pick<SupplyRequisitionItem, 'quantityRequested' | 'quantityFulfilled'>,
): number => Math.max(0, it.quantityRequested - it.quantityFulfilled);

// Etiqueta del estado en español.
export const requisitionStatusLabel = (s: SupplyRequisitionStatus): string =>
  s === 'pending'
    ? 'Pendiente'
    : s === 'partial'
      ? 'Parcial'
      : s === 'fulfilled'
        ? 'Surtida'
        : 'Cancelada';
