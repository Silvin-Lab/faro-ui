import { api } from './api';
import type { BaseUnit } from './supplies';

// Cliente del módulo Almacén (M8). Todos los endpoints bajo `/warehouse` están
// gated a super_admin en el backend. Tipos espejo de tech-spec §5, verificados
// contra el backend real (192.168.68.115:8080).
//
// Convenciones heredadas: envelopes `{items}` / `{<recurso>}`, precios en
// centavos, cantidades firmadas en unidad base (dispatch/waste negativos).

// --- Stock del almacén + mín/máx (F1-F3) ---

// `status` derivado por el backend (regla del badge, handoff §2.1).
export type WarehouseStockStatus = 'below_min' | 'ok' | 'no_min';

export type WarehouseStockItem = {
  supplyId: string;
  name: string;
  baseUnit: BaseUnit;
  packageName: string;
  packageContent: number;
  packageCostCents: number | null;
  stockBase: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  status: WarehouseStockStatus;
};

export const listWarehouseStock = () =>
  api.get<{ items: WarehouseStockItem[] }>('/warehouse/stock').then((r) => r.items);

// Upsert de mín/máx del insumo. `null` limpia el límite. El backend valida
// `max ≥ min` (400 validation_error) cuando ambos quedan definidos.
export const updateWarehouseMinMax = (
  supplyId: string,
  input: { minQuantity: number | null; maxQuantity: number | null },
) =>
  api
    .patch<{ item: WarehouseStockItem }>(`/warehouse/stock/${supplyId}`, input)
    .then((r) => r.item);

// --- Productos a comprar (F4) ---

export type ToBuyItem = {
  supplyId: string;
  name: string;
  baseUnit: BaseUnit;
  packageName: string;
  packageContent: number;
  stockBase: number;
  minQuantity: number;
  missing: number; // min − stock (≥0), derivado por el backend
};

export const listToBuy = () =>
  api.get<{ items: ToBuyItem[] }>('/warehouse/to-buy').then((r) => r.items);

// --- Proveedores (F6) ---

export type Supplier = {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
};

type SupplierCreateInput = { name: string; address?: string; email?: string; phone?: string };
type SupplierUpdateInput = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive';
};

export const listSuppliers = (activeOnly = false) => {
  const q = activeOnly ? '?status=active' : '';
  return api.get<{ items: Supplier[] }>(`/warehouse/suppliers${q}`).then((r) => r.items);
};

// No hay GET individual en el contrato: el edit resuelve desde el listado.
export const getSupplier = (id: string) =>
  listSuppliers().then((items) => items.find((s) => s.id === id));

export const createSupplier = (input: SupplierCreateInput) =>
  api.post<{ supplier: Supplier }>('/warehouse/suppliers', input).then((r) => r.supplier);

export const updateSupplier = (id: string, input: SupplierUpdateInput) =>
  api.patch<{ supplier: Supplier }>(`/warehouse/suppliers/${id}`, input).then((r) => r.supplier);

// --- Movimientos del almacén (respuesta de los POST) ---

export type WarehouseMovementType = 'purchase' | 'dispatch' | 'waste';

export type WarehouseMovement = {
  id: string;
  tenantId: string;
  supplyId: string;
  type: WarehouseMovementType;
  quantityBase: number; // firmado: purchase (+), dispatch/waste (−)
  branchId: string | null;
  supplierId: string | null;
  packages: number | null;
  unitCostCents: number | null;
  reason: string | null;
  origin?: 'warehouse' | 'branch'; // solo en waste: desde qué ledger se escribió
  createdBy: string | null;
  createdAt: string;
};

// --- Compras (F5, F7) ---

export type PurchaseInput = {
  supplyId: string;
  supplierId: string;
  packages: number; // >0
  unitCostCents: number; // ≥0, precio por presentación
  date?: string; // YYYY-MM-DD; hoy o ausente → now()
};

export type PurchaseHistoryItem = {
  id: string;
  supplyId: string;
  supplyName: string;
  supplierId: string;
  supplierName: string;
  packages: number;
  unitCostCents: number;
  totalCents: number; // derivado = packages × unitCostCents
  quantityBase: number;
  createdByName: string | null;
  createdAt: string;
};

export const createPurchase = (input: PurchaseInput) =>
  api.post<{ movement: WarehouseMovement; stockBase: number }>('/warehouse/purchases', input);

export const listPurchases = () =>
  api.get<{ items: PurchaseHistoryItem[] }>('/warehouse/purchases').then((r) => r.items);

// --- Salidas (F8-F10) ---

export type DispatchInput = {
  supplyId: string;
  branchId: string; // requerido
  quantityBase: number; // >0 (se registra como −qty)
  date?: string;
};

export type DispatchHistoryItem = {
  id: string;
  supplyId: string;
  supplyName: string;
  branchId: string;
  branchName: string;
  quantityBase: number; // negativo
  createdByName: string | null;
  createdAt: string;
};

export const createDispatch = (input: DispatchInput) =>
  api.post<{ movement: WarehouseMovement; warehouseStockBase: number; branchStockBase: number }>(
    '/warehouse/dispatches',
    input,
  );

export const listDispatches = () =>
  api.get<{ items: DispatchHistoryItem[] }>('/warehouse/dispatches').then((r) => r.items);

// --- Mermas (F11, F12) ---

export type WasteInput = {
  supplyId: string;
  quantityBase: number; // >0 (se registra como −qty)
  reason: string; // requerido
  branchId?: string; // ausente/null = almacén central
  date?: string;
};

export type WasteHistoryItem = {
  id: string;
  supplyId: string;
  supplyName: string;
  branchId: string | null;
  branchName: string | null; // null = almacén central ("—")
  reason: string;
  quantityBase: number; // negativo
  origin: 'warehouse' | 'branch';
  createdByName: string | null;
  createdAt: string;
};

export const createWaste = (input: WasteInput) =>
  api.post<{ movement: WarehouseMovement; stockBase: number }>('/warehouse/waste', input);

export const listWaste = () =>
  api.get<{ items: WasteHistoryItem[] }>('/warehouse/waste').then((r) => r.items);

// --- Helpers de presentación ---

// Texto derivado de la presentación de un insumo para el form de compras
// (handoff §2.3): "Bolsa · +1000 g por presentación".
export const presentationLabel = (packageName: string, packageContent: number, unit: BaseUnit): string =>
  `${packageName} · +${packageContent.toLocaleString('es-MX')} ${unit} por presentación`;

// Fecha corta dd/mm/aaaa para los historiales (handoff §3).
export const dateLabel = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// true si el ISO cae en el día calendario de hoy (hora local), para resaltar en
// negrita las filas "de hoy" en los historiales de Compras/Salidas/Mermas.
export const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};
