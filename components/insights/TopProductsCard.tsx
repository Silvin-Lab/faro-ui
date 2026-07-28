'use client';

import { toPesos } from '@/lib/products';
import { Alert } from '@/components/ui/Alert';
import {
  getTopProducts,
  type InsightParams,
  type TopProductsInsight,
  type ProductRevenue,
  type ProductMargin,
} from '@/lib/insights';
import { useInsight } from './useInsight';
import { InsightCard, RankingList, InsightLoading, InsightError, InsightEmpty, type RankingRow } from './primitives';

// F7 · Insight 2 — Producto estrella (handoff §3.2). Tres rankings lado a lado
// (ingresos $ · volumen u · margen $) con barra proporcional al máximo de su
// columna + aviso de productos excluidos del margen por "sin costo capturado".
export function TopProductsCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getTopProducts, filter);

  return (
    <InsightCard title="Producto estrella">
      {loading && !data ? (
        <InsightLoading />
      ) : error ? (
        <InsightError message={error} />
      ) : data ? (
        <Body data={data} />
      ) : null}
    </InsightCard>
  );
}

function RankingColumn({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: RankingRow[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {items.length === 0 ? <InsightEmpty>{emptyText}</InsightEmpty> : <RankingList items={items} />}
    </div>
  );
}

function Body({ data }: { data: TopProductsInsight }) {
  const revenueRows = (rows: ProductRevenue[]): RankingRow[] =>
    rows.map((r) => ({
      label: r.name,
      value: `$${toPesos(r.revenueCents)}`,
      amount: r.revenueCents,
      ariaLabel: `${r.name}: $${toPesos(r.revenueCents)} en ingresos`,
    }));
  const volumeRows = (rows: ProductRevenue[]): RankingRow[] =>
    rows.map((r) => ({
      label: r.name,
      value: `${r.units} u`,
      amount: r.units,
      ariaLabel: `${r.name}: ${r.units} unidades`,
    }));
  const marginRows = (rows: ProductMargin[]): RankingRow[] =>
    rows.map((r) => ({
      label: r.name,
      value: `$${toPesos(r.marginCents)}`,
      amount: r.marginCents,
      ariaLabel: `${r.name}: $${toPesos(r.marginCents)} de margen`,
    }));

  // El margen puede estar vacío con ingresos presentes (sin costo de receta).
  const hasSales = data.byRevenue.length > 0;
  const marginEmptyText =
    hasSales && data.byMargin.length === 0
      ? 'Aún no hay productos con costo de receta completo.'
      : 'Sin ventas en el rango.';

  return (
    <div className="space-y-3">
      <div className="grid gap-5 sm:grid-cols-3">
        <RankingColumn label="Por ingresos ($)" items={revenueRows(data.byRevenue)} emptyText="Sin ventas en el rango." />
        <RankingColumn label="Por volumen (u)" items={volumeRows(data.byVolume)} emptyText="Sin ventas en el rango." />
        <RankingColumn label="Por margen ($)" items={marginRows(data.byMargin)} emptyText={marginEmptyText} />
      </div>

      {data.excludedFromMargin.length > 0 && (
        <Alert variant="warning">
          <span className="tabular-nums">{data.excludedFromMargin.length}</span>{' '}
          {data.excludedFromMargin.length === 1 ? 'producto' : 'productos'} sin costo capturado —
          excluidos del margen: {data.excludedFromMargin.map((p) => p.name).join(', ')}.
        </Alert>
      )}
    </div>
  );
}
