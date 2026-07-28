'use client';

import { type ReactNode } from 'react';
import { toPesos } from '@/lib/products';
import { Alert } from '@/components/ui/Alert';
import {
  getTopProducts,
  type InsightParams,
  type TopProductsInsight,
  type ProductRevenue,
  type ProductMargin,
  type CategoryRevenue,
} from '@/lib/insights';
import { useInsight } from './useInsight';
import { InsightCard, RankingList, InsightLoading, InsightError, InsightEmpty, type RankingRow } from './primitives';

// F7 · Insight 2 — Producto estrella (handoff §3.2 + addendum categoría). Dos
// sub-secciones: "Por producto" (tres rankings: ingresos $ · volumen u · margen $,
// con aviso de excluidos del margen por "sin costo capturado") y "Por categoría"
// (dos rankings: ingresos $ · volumen u; sin margen por categoría — addendum §0).
// Cada ranking usa la misma RankingList con barra proporcional al máx de su columna.
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

// name/revenueCents/units es común a ProductRevenue y CategoryRevenue: un solo mapper
// sirve para los rankings de producto y de categoría (addendum §1.1).
const revenueRows = (rows: (ProductRevenue | CategoryRevenue)[]): RankingRow[] =>
  rows.map((r) => ({
    label: r.name,
    value: `$${toPesos(r.revenueCents)}`,
    amount: r.revenueCents,
    ariaLabel: `${r.name}: $${toPesos(r.revenueCents)} en ingresos`,
  }));
const volumeRows = (rows: (ProductRevenue | CategoryRevenue)[]): RankingRow[] =>
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

// Encabezado de sub-sección (Por producto / Por categoría). Diferencia visualmente
// los dos bloques dentro de la misma tarjeta (título de tarjeta es uppercase muted).
function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-ink">{children}</h3>;
}

function Body({ data }: { data: TopProductsInsight }) {
  // El margen puede estar vacío con ingresos presentes (sin costo de receta).
  const hasSales = data.byRevenue.length > 0;
  const marginEmptyText =
    hasSales && data.byMargin.length === 0
      ? 'Aún no hay productos con costo de receta completo.'
      : 'Sin ventas en el rango.';

  return (
    <div className="space-y-5">
      <section>
        <SubHeading>Por producto</SubHeading>
        <div className="grid gap-5 sm:grid-cols-3">
          <RankingColumn label="Por ingresos ($)" items={revenueRows(data.byRevenue)} emptyText="Sin ventas en el rango." />
          <RankingColumn label="Por volumen (u)" items={volumeRows(data.byVolume)} emptyText="Sin ventas en el rango." />
          <RankingColumn label="Por margen ($)" items={marginRows(data.byMargin)} emptyText={marginEmptyText} />
        </div>

        {data.excludedFromMargin.length > 0 && (
          <div className="mt-3">
            <Alert variant="warning">
              <span className="tabular-nums">{data.excludedFromMargin.length}</span>{' '}
              {data.excludedFromMargin.length === 1 ? 'producto' : 'productos'} sin costo capturado —
              excluidos del margen: {data.excludedFromMargin.map((p) => p.name).join(', ')}.
            </Alert>
          </div>
        )}
      </section>

      <section className="border-t border-line pt-4">
        <SubHeading>Por categoría</SubHeading>
        <div className="grid gap-5 sm:grid-cols-2">
          <RankingColumn label="Por ingresos ($)" items={revenueRows(data.byCategoryRevenue)} emptyText="Sin ventas en el rango." />
          <RankingColumn label="Por volumen (u)" items={volumeRows(data.byCategoryVolume)} emptyText="Sin ventas en el rango." />
        </div>
      </section>
    </div>
  );
}
