'use client';

import { getBasketAffinity, type InsightParams, type BasketAffinityInsight } from '@/lib/insights';
import { useInsight } from './useInsight';
import { InsightCard, InsightLoading, InsightError, InsightInsufficient } from './primitives';

// Etiqueta cualitativa de la fuerza a partir del lift (normalizado). El número
// exacto también se muestra ("Alta (2.4×)").
function liftLabel(lift: number): string {
  if (lift >= 3) return 'Muy alta';
  if (lift >= 2) return 'Alta';
  if (lift >= 1.3) return 'Media';
  return 'Baja';
}

// F10 · Insight 5 — Afinidad de canasta (handoff §3.5). Lista de pares co-comprados
// ordenada por fuerza; solo se muestran pares con respaldo suficiente.
export function BasketAffinityCard({ filter }: { filter: InsightParams | null }) {
  const { data, error, loading } = useInsight(getBasketAffinity, filter);

  return (
    <InsightCard title="Afinidad de canasta">
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

function Body({ data }: { data: BasketAffinityInsight }) {
  if (data.insufficient || data.items.length === 0) {
    return (
      <InsightInsufficient>
        Aún no hay pares de productos con suficiente respaldo en este rango.
      </InsightInsufficient>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {data.items.map((p) => (
          <li
            key={`${p.a}—${p.b}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-line pl-3 text-sm"
          >
            <span className="min-w-0 truncate font-medium text-ink">
              {p.a} + {p.b}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                {liftLabel(p.lift)} ({p.lift.toFixed(1)}×)
              </span>
              <span className="text-xs tabular-nums text-muted">{p.support} ventas juntas</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Solo se muestran pares con respaldo suficiente.</p>
    </>
  );
}
