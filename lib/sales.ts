import { api } from './api';

export type SaleItem = {
  id: string;
  productId: string | null;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type PaymentMethod = 'cash' | 'card';

export type Sale = {
  id: string;
  tenantId: string;
  totalCents: number;
  amountPaidCents: number;
  changeCents: number;
  discountCents: number; // descuento de lealtad calculado en servidor
  promotionName: string | null; // nombre de la promo aplicada (o null)
  paymentMethod: PaymentMethod;
  customerId: string | null;
  customerName: string | null;
  createdAt: string;
  items?: SaleItem[];
};

// El servidor calcula el descuento a partir de la promoción; el cliente solo
// envía la promoción elegida y, opcionalmente, la unidad beneficiada.
export const createSale = (
  items: { productId: string; quantity: number }[],
  paymentMethod: PaymentMethod,
  amountPaidCents: number,
  customerId?: string | null,
  opts?: { promotionId?: string | null; promotionProductId?: string | null },
) =>
  api
    .post<{ sale: Sale }>('/sales', {
      items,
      paymentMethod,
      amountPaidCents,
      customerId: customerId ?? null,
      promotionId: opts?.promotionId ?? null,
      promotionProductId: opts?.promotionProductId ?? null,
    })
    .then((r) => r.sale);

export const listSales = (params?: { from?: string; to?: string }) => {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const qs = q.toString();
  return api.get<{ items: Sale[] }>(`/sales${qs ? `?${qs}` : ''}`).then((r) => r.items);
};

export const getSale = (id: string) => api.get<{ sale: Sale }>(`/sales/${id}`).then((r) => r.sale);
