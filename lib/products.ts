import { api } from './api';

// M10: cómo se surte el producto. `branch_prepared` (default) se consume al vender;
// `bakery` se produce en la central y su receta se consume al producir (no al vender).
export type FulfillmentType = 'branch_prepared' | 'bakery';

export type Product = {
  id: string;
  tenantId: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  priceCents: number;
  status: 'active' | 'inactive';
  imageUrl: string | null;
  fulfillmentType: FulfillmentType;
  createdAt: string;
};

type ProductInput = {
  name?: string;
  priceCents?: number;
  categoryId?: string | null;
  imageUrl?: string | null;
  status?: 'active' | 'inactive';
  // M10: solo super_admin puede enviarlo; el backend valida el rol.
  fulfillmentType?: FulfillmentType;
};

// M10: 409 al intentar pasar de bakery → branch_prepared con pedidos abiertos o
// stock de postre. El backend devuelve los conteos para explicar el bloqueo.
export type FulfillmentChangeBlocked = {
  code: 'fulfillment_change_blocked';
  openOrders: number;
  branchesWithStock: number;
};

export const listProducts = () =>
  api.get<{ items: Product[] }>('/products').then((r) => r.items);

export const getProduct = (id: string) =>
  api.get<{ product: Product }>(`/products/${id}`).then((r) => r.product);

export const createProduct = (input: ProductInput) =>
  api.post<{ product: Product }>('/products', input).then((r) => r.product);

export const updateProduct = (id: string, input: ProductInput) =>
  api.patch<{ product: Product }>(`/products/${id}`, input).then((r) => r.product);

// Helpers de precio: la API usa centavos; la UI muestra pesos.
export const toPesos = (cents: number) => (cents / 100).toFixed(2);
export const toCents = (pesos: string) => Math.round(parseFloat(pesos || '0') * 100);
