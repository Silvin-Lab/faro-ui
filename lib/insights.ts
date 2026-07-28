// Cliente API del módulo Insights (M9). Seis endpoints GET de solo lectura sobre
// `/insights/*`, mismo contrato de query que `/reports/sales`
// (`?from&to&tz&branchId`). Los tipos son espejo de los structs de respuesta del
// backend (internal/insights/model.go). Agregación determinística: sin IA/LLM;
// la UI solo formatea lo que el backend ya calculó.
import { api } from './api';

// Parámetros compartidos por los 6 insights. tz se calcula aquí (no altera los
// resultados en v1 —tech-spec §2— pero se envía por consistencia de contrato).
// branchId: undefined = todas · 'none' = sin sucursal · <uuid> = una sucursal.
export type InsightParams = { from: string; to: string; branchId?: string };

function buildQuery(params: InsightParams): string {
  const q = new URLSearchParams({
    from: params.from,
    to: params.to,
    tz: String(new Date().getTimezoneOffset()),
  });
  if (params.branchId) q.set('branchId', params.branchId);
  return q.toString();
}

// ---- Insight 1: Recurrencia (§5.1) ----------------------------------------
export type RecurrenceCohort = { n: number; ret30: number; ret60: number; ret90: number };
export type RecurrenceInsight = {
  withGe1: number;
  withGe2: number;
  ratePct: number;
  anonSales: number;
  totalSales: number;
  anonSharePct: number;
  cohort: RecurrenceCohort;
  empty: boolean;
};
export const getRecurrence = (params: InsightParams) =>
  api.get<RecurrenceInsight>(`/insights/recurrence?${buildQuery(params)}`);

// ---- Insight 2: Producto estrella (§5.2 + addendum categoría) --------------
export type ProductRevenue = { name: string; revenueCents: number; units: number };
export type ProductMargin = { name: string; revenueCents: number; marginCents: number };
// reason: 'no_recipe' (sin receta / borrado) · 'null_cost' (insumo sin costo capturado).
export type ExcludedProduct = { name: string; reason: 'no_recipe' | 'null_cost' };
// CategoryRevenue: fila de los rankings por categoría (ingresos y volumen). name =
// nombre de categoría o 'Sin categoría' (bucket que agrupa productos sin categoría
// y productos borrados; addendum §1.2). No hay ranking de margen por categoría (§0).
export type CategoryRevenue = { name: string; revenueCents: number; units: number };
export type TopProductsInsight = {
  byRevenue: ProductRevenue[];
  byVolume: ProductRevenue[];
  byMargin: ProductMargin[];
  excludedFromMargin: ExcludedProduct[];
  byCategoryRevenue: CategoryRevenue[];
  byCategoryVolume: CategoryRevenue[];
};
export const getTopProducts = (params: InsightParams) =>
  api.get<TopProductsInsight>(`/insights/top-products?${buildQuery(params)}`);

// ---- Insight 3: Ticket por segmento (§5.3) --------------------------------
// avgCents = 0 cuando sales = 0 (la UI muestra "—" en ese caso).
export type TicketSegment = { avgCents: number; sales: number };
export type TicketSegmentsInsight = {
  new: TicketSegment;
  recurring: TicketSegment;
  anonymous: TicketSegment;
};
export const getTicketSegments = (params: InsightParams) =>
  api.get<TicketSegmentsInsight>(`/insights/ticket-segments?${buildQuery(params)}`);

// ---- Insight 4: 2ª visita (§5.4) ------------------------------------------
// overRep = razón de sobre-representación; support = nº de 2ª visitas con el
// producto; of = tamaño de muestra (n2_total).
export type SecondVisitItem = { name: string; overRep: number; support: number; of: number };
export type SecondVisitInsight = {
  insufficient: boolean;
  sampleSize: number;
  items: SecondVisitItem[];
};
export const getSecondVisit = (params: InsightParams) =>
  api.get<SecondVisitInsight>(`/insights/second-visit?${buildQuery(params)}`);

// ---- Insight 5: Afinidad de canasta (§5.5 + addendum categoría) ------------
// support = ventas que contienen ambos; lift = fuerza normalizada.
export type BasketPair = { a: string; b: string; support: number; lift: number };
// CategoryPair: par de categorías co-compradas en la misma venta. Mismo shape que
// BasketPair. categoryInsufficient es INDEPENDIENTE de insufficient (addendum §3.2):
// cada bloque se evalúa por su propio flag.
export type CategoryPair = { a: string; b: string; support: number; lift: number };
export type BasketAffinityInsight = {
  insufficient: boolean;
  items: BasketPair[];
  categoryItems: CategoryPair[];
  categoryInsufficient: boolean;
};
export const getBasketAffinity = (params: InsightParams) =>
  api.get<BasketAffinityInsight>(`/insights/basket-affinity?${buildQuery(params)}`);

// ---- Insight 6: Efectividad de lealtad (§5.6) -----------------------------
// customers = 0 cuando el segmento no tiene clientes (la UI conserva el otro).
export type LoyaltySegment = {
  customers: number;
  salesTotal: number;
  spendTotal: number;
  avgTicketCents: number;
  salesPerCustomer: number;
  spendPerCustomer: number;
};
export type LoyaltyEffectInsight = { redeemed: LoyaltySegment; notRedeemed: LoyaltySegment };
export const getLoyaltyEffect = (params: InsightParams) =>
  api.get<LoyaltyEffectInsight>(`/insights/loyalty-effect?${buildQuery(params)}`);
