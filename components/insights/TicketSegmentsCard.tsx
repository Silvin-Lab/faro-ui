'use client';

import { toPesos } from '@/lib/products';
import {
  getTicketSegments,
  type InsightParams,
  type TicketSegmentsInsight,
  type TicketSegment,
} from '@/lib/insights';
import { useInsight } from './useInsight';
import { InsightCard, Stat, InsightLoading, InsightError } from './primitives';

// F8 · Insight 3 — Ticket promedio por segmento (handoff §3.3). Tres columnas de
// stat (Nuevo · Recurrente · Anónimas), cada una con $ promedio + N ventas.
export function TicketSegmentsCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getTicketSegments, filter);

  return (
    <InsightCard title="Ticket por segmento">
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

function segStat(label: string, seg: TicketSegment) {
  // Segmento sin ventas → "—" (sin división en cero).
  const avg = seg.sales === 0 ? '—' : `$${toPesos(seg.avgCents)}`;
  return <Stat label={label} value={avg} sub={`${seg.sales} ventas`} />;
}

function Body({ data }: { data: TicketSegmentsInsight }) {
  // Contraste opcional: cuánto más gasta el recurrente que el nuevo por ticket.
  const both = data.new.sales > 0 && data.recurring.sales > 0 && data.new.avgCents > 0;
  const contrastPct = both
    ? Math.round(((data.recurring.avgCents - data.new.avgCents) / data.new.avgCents) * 100)
    : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {segStat('Nuevo', data.new)}
        {segStat('Recurrente', data.recurring)}
        {segStat('Anónimas', data.anonymous)}
      </div>
      {contrastPct != null && contrastPct > 0 && (
        <p className="mt-3 text-sm text-muted">
          El recurrente gasta ~<span className="tabular-nums">{contrastPct}%</span> más que el nuevo por
          ticket.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Nuevo y recurrente usan la misma definición que la recurrencia (1 vs. ≥2 compras en el rango).
        Las anónimas son un tercer segmento aparte.
      </p>
    </>
  );
}
