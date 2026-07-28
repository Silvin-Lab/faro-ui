'use client';

import { getRecurrence, type InsightParams, type RecurrenceInsight } from '@/lib/insights';
import { useInsight } from './useInsight';
import { InsightCard, Stat, InsightLoading, InsightError, InsightEmpty } from './primitives';

const round = (n: number) => Math.round(n);

// F6 · Insight 1 — Recurrencia de clientes (handoff §3.1). Titular llano derivado
// de la tasa + línea num/den, cohorte 30/60/90 y bucket anónimas separado.
export function RecurrenceCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getRecurrence, filter);

  return (
    <InsightCard title="Recurrencia de clientes">
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

function AnonLine({ data }: { data: RecurrenceInsight }) {
  if (data.totalSales === 0) return null;
  return (
    <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
      Ventas anónimas: <span className="tabular-nums">{data.anonSales}</span> ventas ·{' '}
      <span className="tabular-nums">{round(data.anonSharePct)}%</span> del total (no cuentan para
      recurrencia).
    </p>
  );
}

function Body({ data }: { data: RecurrenceInsight }) {
  // Vacío = no hay clientes identificados; conservamos el bucket de anónimas.
  if (data.empty || data.withGe1 === 0) {
    return (
      <>
        <InsightEmpty>Aún no hay clientes identificados en este rango.</InsightEmpty>
        <AnonLine data={data} />
      </>
    );
  }

  const perTen = round(data.ratePct / 10);
  const cohortStat = (label: string, ret: number) => {
    const n = data.cohort.n;
    return (
      <Stat
        key={label}
        size="sm"
        label={label}
        value={n === 0 ? '—' : `${round((ret / n) * 100)}%`}
        sub={`${ret}/${n} nuevos`}
      />
    );
  };

  return (
    <>
      <p className="text-lg font-semibold text-ink sm:text-xl">
        ≈{perTen} de cada 10 clientes vuelven
      </p>
      <p className="mt-1 text-sm text-muted">
        <span className="font-medium tabular-nums text-ink">{round(data.ratePct)}%</span> ·{' '}
        <span className="tabular-nums">{data.withGe2}</span> de{' '}
        <span className="tabular-nums">{data.withGe1}</span> clientes con ≥2 compras
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Cohorte de nuevos: ¿vuelven?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {cohortStat('30 días', data.cohort.ret30)}
          {cohortStat('60 días', data.cohort.ret60)}
          {cohortStat('90 días', data.cohort.ret90)}
        </div>
        <p className="mt-2 text-xs text-muted">
          La ventana puede mirar más allá del rango si el cliente ya volvió.
        </p>
      </div>

      <AnonLine data={data} />
    </>
  );
}
