import { api } from './api';

// Cliente del módulo Repostería / Producción central (M10). Contratos espejo de
// tech-spec §5, verificados contra el backend real (localhost:8080). Envelopes
// heredados: `{items}` para listas, `{<recurso>}` singular. Cantidades enteras.
//
// Convenciones heredadas de lib/warehouse: helpers `dateLabel`/`isToday` se
// reexportan aquí para las tablas de este módulo (mismo formato dd/mm/aaaa).
export { dateLabel, isToday } from './warehouse';

// Umbral de antigüedad (aging). DECISIÓN DE DISEÑO (tech-spec §3.1, D-A):
// hardcodeada en el frontend, NO viene del backend. El aging es un indicador
// puramente visual de priorización en las worklists; no afecta datos ni lógica.
export const AGING_THRESHOLD_DAYS = 2;

// Ciclo de vida del pedido (wireframes: pending → in_production → shipped →
// received; cancelled solo desde pending sin producción).
export type BakeryOrderStatus =
  | 'pending'
  | 'in_production'
  | 'shipped'
  | 'received'
  | 'cancelled';

// Pedido de una sucursal a la repostería central (tech-spec §5.1/§5.2).
// `quantityShipped` alimenta el progreso `n/m` + barra; "Falta" = ordered − shipped.
// `createdAt` alimenta el aging (front).
export type BakeryOrder = {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityShipped: number;
  status: BakeryOrderStatus;
  note: string | null;
  requestedByName: string | null;
  createdAt: string;
};

// Acto de producción contra un pedido (tech-spec §5.3/§5.5/§5.8). El listado de
// auditoría (§5.8) trae campos extra (orderId, productName, branchName).
export type BakeryProduction = {
  id: string;
  orderId?: string;
  productName?: string;
  branchName?: string;
  quantityProduced: number;
  createdByName?: string | null;
  createdAt: string;
};

// Existencia de postre terminado por (producto, sucursal) — tech-spec §3.4/§5.7.
// `stockQty` puede ser 0 (se pinta en text-muted) o negativo.
export type ProductBranchStockItem = {
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  stockQty: number;
};

export type BakeryStockScope = 'all' | 'branch';

// --- Filtros de listado ---

export type ListOrdersParams = {
  status?: BakeryOrderStatus[]; // CSV en el query; default sin filtro
  branchId?: string; // ignorado por el backend para usuarios de sucursal
  q?: string; // nombre de postre
};

function ordersQuery(params?: ListOrdersParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.status && params.status.length > 0) q.set('status', params.status.join(','));
  if (params.branchId) q.set('branchId', params.branchId);
  if (params.q && params.q.trim() !== '') q.set('q', params.q.trim());
  const s = q.toString();
  return s ? `?${s}` : '';
}

// --- Pedidos (F3-F14) ---

// Crear pedido — solo sucursal. `branchId` NO se envía: el backend lo toma de la
// sucursal activa (F3). Backend valida productId de repostería (400 invalid_product).
export const createBakeryOrder = (input: { productId: string; quantity: number; note?: string }) =>
  api
    .post<{ order: BakeryOrder }>('/bakery/orders', {
      productId: input.productId,
      quantity: input.quantity,
      ...(input.note && input.note.trim() !== '' ? { note: input.note.trim() } : {}),
    })
    .then((r) => r.order);

// Listar pedidos / cola. Scope por rol en el backend: sucursal ve los suyos;
// repostero/super_admin ven todos. Orden created_at ASC (FIFO).
export const listBakeryOrders = (params?: ListOrdersParams) =>
  api.get<{ items: BakeryOrder[] }>(`/bakery/orders${ordersQuery(params)}`).then((r) => r.items);

// Detalle de pedido + sus producciones.
export const getBakeryOrder = (id: string) =>
  api.get<{ order: BakeryOrder; productions: BakeryProduction[] }>(`/bakery/orders/${id}`);

// Registrar producción — solo repostero/super_admin. Ejecuta la transacción de
// doble efecto (baja insumos + acredita postre). 409 invalid_state si el pedido
// ya no es producible.
export const produceBakeryOrder = (id: string, quantity: number) =>
  api.post<{ order: BakeryOrder; production: BakeryProduction }>(`/bakery/orders/${id}/produce`, {
    quantity,
  });

// Cancelar — solo dueña/super_admin, solo si pending sin producción. 409
// invalid_state en cualquier otro caso.
export const cancelBakeryOrder = (id: string) =>
  api.patch<{ order: BakeryOrder }>(`/bakery/orders/${id}/cancel`, {}).then((r) => r.order);

// Marcar recibido — solo dueña/super_admin, solo desde shipped (informativo, no
// mueve stock). 409 invalid_state en otro estado.
export const receiveBakeryOrder = (id: string) =>
  api.patch<{ order: BakeryOrder }>(`/bakery/orders/${id}/receive`, {}).then((r) => r.order);

// --- Stock de postres (F15) ---

export const listBakeryStock = (params?: { branchId?: string; q?: string }) => {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.q && params.q.trim() !== '') q.set('q', params.q.trim());
  const s = q.toString();
  return api.get<{ scope: BakeryStockScope; items: ProductBranchStockItem[] }>(
    `/bakery/stock${s ? `?${s}` : ''}`,
  );
};

// --- Auditoría de producciones (§5.8) — solo repostero/super_admin ---

export const listBakeryProductions = (params?: {
  from?: string;
  to?: string;
  branchId?: string;
  productId?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.productId) q.set('productId', params.productId);
  const s = q.toString();
  return api
    .get<{ items: BakeryProduction[] }>(`/bakery/productions${s ? `?${s}` : ''}`)
    .then((r) => r.items);
};

// --- Merma de postre (M11) ---

// Respuesta de POST /bakery/waste: el movimiento 'waste' recién escrito (Quantity
// negativo) + el StockQty resultante de la sucursal para reflejarlo de inmediato.
export type BakeryWasteMovement = {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  quantity: number; // negativo
  reason: string | null;
  stockQty: number;
  createdAt: string;
};

// Fila del historial de mermas de postre (GET /bakery/waste). Quantity negativo.
export type BakeryWasteItem = {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  quantity: number; // negativo
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
};

// Registrar merma de postre — sucursal (su sucursal activa, forzada por backend)
// o super_admin (branchId obligatorio). NO se envía branchId desde la sucursal.
export const createBakeryWaste = (input: {
  productId: string;
  quantity: number; // >0 (se registra como −qty)
  reason: string;
  branchId?: string; // solo super_admin
}) =>
  api.post<{ movement: BakeryWasteMovement; stockQty: number }>('/bakery/waste', {
    productId: input.productId,
    quantity: input.quantity,
    reason: input.reason,
    ...(input.branchId ? { branchId: input.branchId } : {}),
  });

export const listBakeryWaste = (params?: { branchId?: string; from?: string; to?: string }) => {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const s = q.toString();
  return api
    .get<{ items: BakeryWasteItem[] }>(`/bakery/waste${s ? `?${s}` : ''}`)
    .then((r) => r.items);
};

// --- Conteo de cierre de postres (M11) ---

// Qué se dio de baja/ajustó por una línea de conteo: "waste" (diff<0),
// "adjustment" (diff>0) o null (diff=0, sin movimiento).
export type BakeryCountMovementType = 'waste' | 'adjustment';

// Encabezado de un conteo de cierre de postres de una sucursal.
export type BakeryCount = {
  id: string;
  branchId: string;
  branchName: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

// Línea de un conteo: lo esperado (stock en cache al momento), lo contado y la
// diferencia. diffQty<0 = merma automática; diffQty>0 = sobrante (ajuste).
export type BakeryCountItem = {
  id: string;
  productId: string;
  productName: string;
  expectedQty: number;
  countedQty: number;
  diffQty: number;
  movementId: string | null;
  movementType: BakeryCountMovementType | null;
};

// Detalle de un conteo: encabezado + líneas.
export type BakeryCountDetail = {
  count: BakeryCount;
  items: BakeryCountItem[];
};

// Registrar conteo de cierre — sucursal (su sucursal activa, forzada) o super_admin
// (branchId obligatorio). Devuelve el detalle línea por línea con el diff y el
// movimiento generado (merma/ajuste) por cada producto.
export const createBakeryCount = (input: {
  note?: string;
  branchId?: string; // solo super_admin
  items: { productId: string; countedQty: number }[];
}) =>
  api.post<BakeryCountDetail>('/bakery/counts', {
    ...(input.note && input.note.trim() !== '' ? { note: input.note.trim() } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    items: input.items.map((it) => ({ productId: it.productId, countedQty: it.countedQty })),
  });

export const getBakeryCount = (id: string) =>
  api.get<BakeryCountDetail>(`/bakery/counts/${id}`);

export const listBakeryCounts = (params?: { branchId?: string; from?: string; to?: string }) => {
  const q = new URLSearchParams();
  if (params?.branchId) q.set('branchId', params.branchId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const s = q.toString();
  return api
    .get<{ items: BakeryCount[] }>(`/bakery/counts${s ? `?${s}` : ''}`)
    .then((r) => r.items);
};

// --- Helpers de presentación ---

// Falta = pedido − surtido (nunca negativo para la UI).
export const remaining = (o: Pick<BakeryOrder, 'quantityOrdered' | 'quantityShipped'>): number =>
  Math.max(0, o.quantityOrdered - o.quantityShipped);

// Días de antigüedad de un pedido (días calendario redondeados hacia abajo).
export const ageDays = (iso: string): number => {
  const created = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / 86_400_000));
};

// true si el pedido debe mostrar el indicador de antigüedad: solo pendientes/en
// producción con ≥ AGING_THRESHOLD_DAYS días (tech-spec §3.1).
export const isAging = (o: Pick<BakeryOrder, 'status' | 'createdAt'>): boolean =>
  (o.status === 'pending' || o.status === 'in_production') &&
  ageDays(o.createdAt) >= AGING_THRESHOLD_DAYS;
