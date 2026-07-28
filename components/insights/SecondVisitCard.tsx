'use client';

import { getSecondVisit, type InsightParams, type SecondVisitInsight } from '@/lib/insights';
import { useInsight } from './useInsight';
import {
  InsightCard,
  InsightLoading,
  InsightError,
  InsightInsufficient,
  InsightFootnote,
} from './primitives';

// F9 · Insight 4 — Qué se pide en la 2ª visita (handoff §3.4). Lista de productos
// sobre-representados en la visita #2 ordenada por desproporción. N=2 fijo.
export function SecondVisitCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getSecondVisit, filter);

  return (
    <InsightCard title="Qué se pide en la 2ª visita">
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

function Body({ data }: { data: SecondVisitInsight }) {
  const footnote = (
    <InsightFootnote>No incluye ventas anónimas (sin cliente no se puede secuenciar visitas).</InsightFootnote>
  );

  // Muestra insuficiente: hubo datos pero muy pocas 2ª visitas para concluir.
  if (data.insufficient) {
    return (
      <>
        <InsightInsufficient>
          Muestra insuficiente: solo <span className="tabular-nums">{data.sampleSize}</span>{' '}
          {data.sampleSize === 1 ? 'cliente tiene' : 'clientes tienen'} una 2ª visita en este rango.
          Amplía el rango.
        </InsightInsufficient>
        {footnote}
      </>
    );
  }

  if (data.items.length === 0) {
    return (
      <>
        <InsightInsufficient>
          Aún no hay productos con suficiente respaldo en las segundas visitas.
        </InsightInsufficient>
        {footnote}
      </>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {data.items.map((it) => (
          <li
            key={it.name}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-line pl-3 text-sm"
          >
            <span className="min-w-0 truncate font-medium text-ink">{it.name}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                {it.overRep.toFixed(1)}× vs. promedio
              </span>
              <span className="text-xs tabular-nums text-muted">
                en {it.support} de {it.of} segundas visitas
              </span>
            </span>
          </li>
        ))}
      </ul>
      {footnote}
    </>
  );
}
