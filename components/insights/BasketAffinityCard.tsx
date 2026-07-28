'use client';

import { ReactNode } from 'react';
import {
  getBasketAffinity,
  type InsightParams,
  type BasketAffinityInsight,
  type BasketPair,
  type CategoryPair,
} from '@/lib/insights';
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

// F10 · Insight 5 — Afinidad de canasta (handoff §3.5 + addendum categoría). Dos
// sub-secciones con el mismo lenguaje visual: "Por producto" (pares de producto) y
// "Por categoría" (pares de categoría). Cada bloque se gobierna por su propio flag
// de suficiencia (insufficient / categoryInsufficient son independientes, §3.2).
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

// Encabezado de sub-sección (Por producto / Por categoría).
function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-ink">{children}</h3>;
}

// BasketPair y CategoryPair comparten shape (a/b/support/lift): una sola lista sirve
// para pares de producto y de categoría.
function PairList({ pairs }: { pairs: (BasketPair | CategoryPair)[] }) {
  return (
    <ul className="space-y-2">
      {pairs.map((p) => (
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
  );
}

function Body({ data }: { data: BasketAffinityInsight }) {
  const productInsufficient = data.insufficient || data.items.length === 0;
  const categoryInsufficient = data.categoryInsufficient || data.categoryItems.length === 0;
  // El pie ("solo pares con respaldo suficiente") aplica a ambos bloques por igual;
  // se muestra una sola vez si al menos uno tiene pares.
  const anyPairs = !productInsufficient || !categoryInsufficient;

  return (
    <div className="space-y-5">
      <section>
        <SubHeading>Por producto</SubHeading>
        {productInsufficient ? (
          <InsightInsufficient>
            Aún no hay pares de productos con suficiente respaldo en este rango.
          </InsightInsufficient>
        ) : (
          <PairList pairs={data.items} />
        )}
      </section>

      <section className="border-t border-line pt-4">
        <SubHeading>Por categoría</SubHeading>
        {categoryInsufficient ? (
          <InsightInsufficient>
            Aún no hay pares de categorías con suficiente respaldo en este rango.
          </InsightInsufficient>
        ) : (
          <PairList pairs={data.categoryItems} />
        )}
      </section>

      {anyPairs && (
        <p className="text-xs text-muted">Solo se muestran pares con respaldo suficiente.</p>
      )}
    </div>
  );
}
