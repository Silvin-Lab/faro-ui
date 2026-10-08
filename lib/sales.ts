import { api } from './api';

export type SaleItem = {
  id: string;
  productId: string | null;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'didi';

// Etiqueta canónica por método de pago. Fuente única para toda la UI
// (panel de cobro, ticket, historial, reportes) — no duplicar ternarios.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  didi: 'Didi',
};

// Etiqueta legible del método; tolera valores desconocidos (backends previos).
export const paymentMethodLabel = (m: PaymentMethod | string): string =>
  PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? String(m);

export type Sale = {
  id: string;
  tenantId: string;
  totalCents: number; // neto de AMBOS descuentos (lealtad + convenio)
  amountPaidCents: number;
  changeCents: number;
  discountCents: number; // descuento de lealtad calculado en servidor (SOLO lealtad)
  promotionName: string | null; // nombre de la promo aplicada (o null)
  // M12 convenio-discounts: descuento de convenio (separado del de lealtad).
  agreementDiscountId: string | null;
  agreementDiscountPercent: number | null; // snapshot del % aplicado (o null)
  agreementDiscountCents: number; // monto del descuento de convenio (0 si no hubo)
  // M12: usuario que cobró la venta. null en ventas históricas ⇒ "Sin registro".
  soldByUserId: string | null;
  soldByName: string | null;
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
  opts?: {
    promotionId?: string | null;
    promotionProductId?: string | null;
    // M12: id del descuento de convenio elegido (requiere customerId; el monto
    // lo calcula el servidor). Sin cliente ⇒ 422 agreement_discount_not_eligible.
    agreementDiscountId?: string | null;
  },
) =>
  api
    .post<{ sale: Sale }>('/sales', {
      items,
      paymentMethod,
      amountPaidCents,
      customerId: customerId ?? null,
      promotionId: opts?.promotionId ?? null,
      promotionProductId: opts?.promotionProductId ?? null,
      agreementDiscountId: opts?.agreementDiscountId ?? null,
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
