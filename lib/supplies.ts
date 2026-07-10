import { api } from './api';

// Insumo (M-Insumos): se compra en una presentación ("Bote 900 ml") y se consume
// en su unidad base (g/ml/pieza). La unidad base es inmutable tras la creación.
// El inventario vive POR SUCURSAL; las recetas son globales por producto.

export type BaseUnit = 'g' | 'ml' | 'pieza';

// Existencias de un insumo en una sucursal. stockBase puede ser negativo:
// el inventario es un registro pasivo, nunca un candado.
export type SupplyStock = {
  branchId: string;
  branchName: string;
  stockBase: number;
};

// Categoría de insumo: clasifica los insumos del catálogo. Espejo de las
// categorías de gasto (sin imagen). El inventario no depende de la categoría.
export type SupplyCategory = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  sortOrder: number;
};

export type Supply = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  packageName: string;
  packageContent: number; // contenido de la presentación en unidad base
  packageCostCents?: number | null; // costo de la presentación en centavos; null = no capturado
  categoryId: string | null; // null = sin categoría
  categoryName: string | null; // snapshot para pintar sin cruzar el catálogo
  status: 'active' | 'inactive';
  stock: SupplyStock[];
};

type SupplyCreateInput = {
  name: string;
  baseUnit: BaseUnit;
  packageName: string;
  packageContent: number;
  packageCostCents?: number | null;
  categoryId?: string | null;
};

// baseUnit NO es editable (el backend responde validation_error si se envía).
type SupplyUpdateInput = {
  name?: string;
  status?: 'active' | 'inactive';
  packageName?: string;
  packageContent?: number;
  packageCostCents?: number | null;
  categoryId?: string | null;
};

export type MovementType = 'purchase' | 'adjustment' | 'sale';

export type SupplyMovement = {
  id: string;
  type: MovementType;
  quantityBase: number; // firmado: + entra, - sale
  reason: string | null;
  branchId: string;
  branchName: string;
  createdByName: string | null;
  createdAt: string;
};

// Entrada de compra: packages>0 (entran packages×packageContent) o quantityBase>0 directo.
// Ajuste/merma: quantityBase firmado ≠ 0 + reason obligatorio. Nada es bloqueante.
type MovementInput =
  | { type: 'purchase'; branchId: string; packages?: number; quantityBase?: number }
  | { type: 'adjustment'; branchId: string; quantityBase: number; reason: string };

export type RecipeItem = {
  supplyId: string;
  supplyName: string;
  baseUnit: BaseUnit;
  quantityBase: number;
};

// --- Catálogo ---

export const listSupplies = () =>
  api.get<{ items: Supply[] }>('/supplies').then((r) => r.items);

export const getSupply = (id: string) =>
  api.get<{ supply: Supply }>(`/supplies/${id}`).then((r) => r.supply);

export const createSupply = (input: SupplyCreateInput) =>
  api.post<{ supply: Supply }>('/supplies', input).then((r) => r.supply);

export const updateSupply = (id: string, input: SupplyUpdateInput) =>
  api.patch<{ supply: Supply }>(`/supplies/${id}`, input).then((r) => r.supply);

// --- Categorías de insumo ---

export const listSupplyCategories = () =>
  api.get<{ items: SupplyCategory[] }>('/supplies/categories').then((r) => r.items);

// No hay GET individual en el contrato: el edit resuelve desde el listado.
export const getSupplyCategory = (id: string) =>
  listSupplyCategories().then((items) => items.find((c) => c.id === id));

export const createSupplyCategory = (input: { name: string; sortOrder?: number }) =>
  api.post<{ category: SupplyCategory }>('/supplies/categories', input).then((r) => r.category);

export const updateSupplyCategory = (
  id: string,
  input: { name?: string; status?: 'active' | 'inactive'; sortOrder?: number },
) => api.patch<{ category: SupplyCategory }>(`/supplies/categories/${id}`, input).then((r) => r.category);

// --- Movimientos ---

export const createMovement = (supplyId: string, input: MovementInput) =>
  api
    .post<{ movement: SupplyMovement; stockBase: number }>(`/supplies/${supplyId}/movements`, input);

export const listMovements = (supplyId: string) =>
  api.get<{ items: SupplyMovement[] }>(`/supplies/${supplyId}/movements`).then((r) => r.items);

// --- Recetas (por producto, replace-all) ---

export const getRecipe = (productId: string) =>
  api.get<{ items: RecipeItem[] }>(`/supplies/recipes/${productId}`).then((r) => r.items);

export const saveRecipe = (
  productId: string,
  items: { supplyId: string; quantityBase: number }[],
) => api.put<{ items: RecipeItem[] }>(`/supplies/recipes/${productId}`, { items }).then((r) => r.items);

// --- Helpers de presentación ---

// Etiqueta corta de la unidad base.
export const unitLabel = (u: BaseUnit): string => u; // 'g' | 'ml' | 'pieza'

// Etiqueta de un tipo de movimiento en español.
export const movementTypeLabel = (t: MovementType): string =>
  t === 'purchase' ? 'Compra' : t === 'sale' ? 'Venta' : 'Ajuste';

// Formatea una cantidad en unidad base con separador de miles (es-MX): 1800 → "1,800".
export const formatBase = (n: number): string => n.toLocaleString('es-MX');

// Cantidad firmada con signo explícito: -400 → "−400", 900 → "+900".
export const formatSigned = (n: number): string =>
  `${n < 0 ? '−' : '+'}${formatBase(Math.abs(n))}`;

// Equivalencia en presentaciones: 1800 / (900) → "2.0". Evita división por cero.
export const packageEquivalent = (stockBase: number, packageContent: number): string =>
  packageContent > 0 ? (stockBase / packageContent).toFixed(1) : '0.0';

// Texto completo de stock de una sucursal, ej.:
//   "1,800 ml ≈ 2.0 × Bote 900 ml"
export const stockLabel = (s: Supply, stockBase: number): string =>
  `${formatBase(stockBase)} ${s.baseUnit} ≈ ${packageEquivalent(stockBase, s.packageContent)} × ${s.packageName}`;
