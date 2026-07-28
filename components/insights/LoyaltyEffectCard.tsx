'use client';

import { toPesos } from '@/lib/products';
import {
  getLoyaltyEffect,
  type InsightParams,
  type LoyaltyEffectInsight,
  type LoyaltySegment,
} from '@/lib/insights';
import { useInsight } from './useInsight';
import {
  InsightCard,
  SegmentComparison,
  InsightLoading,
  InsightError,
  InsightFootnote,
  type ComparisonColumn,
  type ComparisonRow,
} from './primitives';

// Contraste canjeó vs. no canjeó como ▲/▼ %. Null si algún lado no tiene datos.
function contrast(red: number, notred: number): { node: string; negative: boolean } | null {
  if (notred <= 0 || red <= 0) return null;
  const pct = Math.round(((red - notred) / notred) * 100);
  if (pct === 0) return { node: '=', negative: false };
  return { node: pct > 0 ? `▲${pct}%` : `▼${Math.abs(pct)}%`, negative: pct < 0 };
}

// F11 · Insight 6 — Efectividad de lealtad (handoff §3.6). Comparación de dos
// columnas (Canjeó vs. No canjeó) con filas Ticket / Ventas por cliente / Gasto
// por cliente + columna de contraste.
export function LoyaltyEffectCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getLoyaltyEffect, filter);

  return (
    <InsightCard title="Efectividad de lealtad">
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

function Body({ data }: { data: LoyaltyEffectInsight }) {
  const r: LoyaltySegment = data.redeemed;
  const n: LoyaltySegment = data.notRedeemed;

  const columns: ComparisonColumn[] = [
    {
      key: 'redeemed',
      label: 'Canjeó lealtad',
      sub: `${r.customers} clientes`,
      empty: r.customers === 0,
      emptyText: 'Sin canjes de lealtad en este rango.',
    },
    {
      key: 'notRedeemed',
      label: 'No canjeó',
      sub: `${n.customers} clientes`,
      empty: n.customers === 0,
      emptyText: 'Sin clientes sin canje en este rango.',
    },
  ];

  const cTicket = contrast(r.avgTicketCents, n.avgTicketCents);
  const cSales = contrast(r.salesPerCustomer, n.salesPerCustomer);
  const cSpend = contrast(r.spendPerCustomer, n.spendPerCustomer);

  const rows: ComparisonRow[] = [
    {
      label: 'Ticket promedio',
      values: { redeemed: `$${toPesos(r.avgTicketCents)}`, notRedeemed: `$${toPesos(n.avgTicketCents)}` },
      contrast: cTicket?.node,
      contrastNegative: cTicket?.negative,
    },
    {
      label: 'Ventas por cliente',
      values: {
        redeemed: r.salesPerCustomer.toFixed(1),
        notRedeemed: n.salesPerCustomer.toFixed(1),
      },
      contrast: cSales?.node,
      contrastNegative: cSales?.negative,
    },
    {
      label: 'Gasto por cliente',
      values: {
        redeemed: `$${toPesos(r.spendPerCustomer)}`,
        notRedeemed: `$${toPesos(n.spendPerCustomer)}`,
      },
      contrast: cSpend?.node,
      contrastNegative: cSpend?.negative,
    },
  ];

  return (
    <>
      <SegmentComparison columns={columns} rows={rows} />
      <p className="mt-3 text-xs text-muted">
        Basado en <span className="tabular-nums">{r.customers}</span> clientes que canjearon ·{' '}
        <span className="tabular-nums">{n.customers}</span> que no.
      </p>
      <InsightFootnote>No incluye ventas anónimas (sin cliente no hay canje que atribuir).</InsightFootnote>
    </>
  );
}
