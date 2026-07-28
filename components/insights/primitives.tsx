'use client';

import { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';

// Primitivas de presentación del módulo Insights (design-system §M9.2–6.6). Solo
// formato: ningún cálculo de negocio vive aquí (lo hace el backend). Reusan los
// tokens del sistema (text-ink/muted/danger, bg-accent/bg-bg/border-line),
// tabular-nums en números y áreas táctiles ≥44px donde aplica.

// --- §M9.2 Tarjeta de insight: Card con eyebrow → titular/detalle → estados ---
export function InsightCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </Card>
  );
}

// --- §M9.3 Stat / KPI block: label muted + número grande + sub-línea de respaldo -
export function Stat({
  label,
  value,
  sub,
  negative,
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  negative?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl';
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={`break-words font-bold tabular-nums ${valueSize} ${negative ? 'text-danger' : 'text-ink'}`}>
        {value}
      </p>
      {sub != null && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

// --- §M9.4 Ranking list con barra: rank · label · valor + barra proporcional ----
// amount alimenta la barra (proporcional al máximo de la lista); value es el texto
// ya formateado que se muestra a la derecha. ariaLabel da la lectura textual.
export type RankingRow = { label: string; value: string; amount: number; ariaLabel?: string };

export function RankingList({ items }: { items: RankingRow[] }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.amount)));
  return (
    <ol className="space-y-2">
      {items.map((it, idx) => (
        <li key={`${it.label}-${idx}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 tabular-nums text-muted">{idx + 1}.</span>
              <span className="min-w-0 truncate text-ink">{it.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{it.value}</span>
          </div>
          <div
            className="mt-1 h-2 rounded bg-bg"
            role="img"
            aria-label={it.ariaLabel ?? `${it.label}: ${it.value}`}
          >
            <div
              className="h-2 rounded bg-accent"
              style={{ width: `${Math.max(2, (Math.abs(it.amount) / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- §M9.5 Comparación por segmentos: 2–3 columnas + fila de contraste (▲/▼/×) --
// Una columna con `empty:true` muestra su `emptyText` (conservando las demás,
// handoff §3.6). El contraste se oculta si alguna columna está vacía.
export type ComparisonColumn = {
  key: string;
  label: string;
  sub?: ReactNode;
  empty?: boolean;
  emptyText?: string;
};
export type ComparisonRow = {
  label: string;
  values: Record<string, ReactNode>;
  contrast?: ReactNode;
  contrastNegative?: boolean;
};

export function SegmentComparison({
  columns,
  rows,
}: {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}) {
  const anyEmpty = columns.some((c) => c.empty);
  const withContrast = !anyEmpty && rows.some((r) => r.contrast != null);

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[360px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 font-medium" />
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right font-medium">
                <span className="block text-ink">{c.label}</span>
                {c.sub != null && <span className="block font-normal normal-case text-muted">{c.sub}</span>}
              </th>
            ))}
            {withContrast && <th className="px-2 py-2 text-right font-medium">Contraste</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, ri) => (
            <tr key={row.label}>
              <th scope="row" className="px-2 py-2 text-left font-normal text-muted">
                {row.label}
              </th>
              {columns.map((c) =>
                c.empty ? (
                  ri === 0 ? (
                    <td
                      key={c.key}
                      rowSpan={rows.length}
                      className="px-2 py-2 text-center align-middle text-muted"
                    >
                      {c.emptyText}
                    </td>
                  ) : null
                ) : (
                  <td key={c.key} className="px-2 py-2 text-right font-medium tabular-nums text-ink">
                    {row.values[c.key]}
                  </td>
                ),
              )}
              {withContrast && (
                <td
                  className={`px-2 py-2 text-right font-medium tabular-nums ${
                    row.contrastNegative ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {row.contrast}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- §M9.2 Estados por tarjeta -----------------------------------------------
export function InsightLoading() {
  return <p className="text-sm text-muted">Cargando…</p>;
}

export function InsightError({ message }: { message: string }) {
  return <p className="text-sm text-danger">{message}</p>;
}

// Vacío = no hubo datos en el rango. Texto muted plano.
export function InsightEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

// §M9.6 Muestra insuficiente = hubo datos pero muy pocos para concluir. Variante
// visualmente distinta de "vacío": callout punteado con icono (nunca un número
// espurio).
export function InsightInsufficient({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-line bg-bg px-3 py-2.5">
      <Info size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

// Nota al pie muted (exclusión estructural de anónimas en Insights 4 y 6). Info,
// no error (handoff §4).
export function InsightFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-muted">{children}</p>;
}
