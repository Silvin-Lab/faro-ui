'use client';

import { useMemo, useState } from 'react';

export type DistributionItem = { label: string; value: number };

// Paleta categórica validada (dataviz skill, references/palette.md): 8 tonos en
// orden fijo, nunca ciclados — el orden es el mecanismo de seguridad CVD, no
// cosmético. "Otras" (más de 7 categorías) usa un gris de-emphasis, no una 9na
// tonalidad generada. Se calcula una sola vez y se reusa en pie y en barras —
// el color sigue a la categoría, nunca a la vista activa (no repinta al cambiar).
const CATEGORICAL = [
  '#2a78d6', // azul
  '#008300', // verde
  '#e87ba4', // magenta
  '#eda100', // amarillo
  '#1baf7a', // aqua
  '#eb6834', // naranja
  '#4a3aa7', // violeta
  '#e34948', // rojo
];
const OTHER_COLOR = '#8C8C8C'; // = token `muted` del design system
const SURFACE = '#FFFFFF'; // = token `surface`; separa slices (2px de superficie, no un stroke de dato)

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function colorFor(index: number) {
  // Máx 7 slots de identidad + "Otras"; nunca más de 8 en juego a la vez.
  return index < 7 ? CATEGORICAL[index] : OTHER_COLOR;
}

type View = 'pie' | 'bar';

export function DistributionChart({
  title,
  data,
  formatValue,
}: {
  title: string;
  data: DistributionItem[];
  formatValue: (v: number) => string;
}) {
  const [view, setView] = useState<View>('pie');
  const [active, setActive] = useState<number | null>(null);

  const { items, total, max } = useMemo(() => {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    let bucketed = sorted;
    if (sorted.length > 8) {
      const top = sorted.slice(0, 7);
      const restSum = sorted.slice(7).reduce((s, d) => s + d.value, 0);
      bucketed = [...top, { label: 'Otras categorías', value: restSum }];
    }
    const total = bucketed.reduce((s, d) => s + d.value, 0);
    const max = Math.max(1, ...bucketed.map((d) => d.value));
    const items = bucketed.map((d, i) => ({
      ...d,
      color: colorFor(i),
      pct: total > 0 ? d.value / total : 0,
    }));
    return { items, total, max };
  }, [data]);

  const toggleBtn = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        view === v ? 'bg-accent text-ink' : 'text-muted hover:bg-bg hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="flex shrink-0 gap-1 rounded-lg bg-bg p-1">
          {toggleBtn('bar', 'Barras')}
          {toggleBtn('pie', 'Pie')}
        </div>
      </div>

      {items.length === 0 || total === 0 ? (
        <p className="text-sm text-muted">Sin datos en el rango.</p>
      ) : view === 'pie' ? (
        <PieView title={title} items={items} formatValue={formatValue} active={active} setActive={setActive} />
      ) : (
        <BarView items={items} max={max} formatValue={formatValue} active={active} setActive={setActive} />
      )}
    </div>
  );
}

type Item = DistributionItem & { color: string; pct: number };

function PieView({
  title,
  items,
  formatValue,
  active,
  setActive,
}: {
  title: string;
  items: Item[];
  formatValue: (v: number) => string;
  active: number | null;
  setActive: (i: number | null) => void;
}) {
  const cx = 100;
  const cy = 100;
  const r = 90;
  let cursor = 0;
  const paths = items.map((it) => {
    const startAngle = cursor * 360;
    cursor += it.pct;
    const endAngle = cursor * 360;
    const start = polarToXY(cx, cy, r, startAngle);
    const end = polarToXY(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d =
      it.pct >= 0.999
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` // círculo completo (1 sola categoría)
        : `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    return { d, it, mid: startAngle + (endAngle - startAngle) / 2 };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <svg viewBox="0 0 200 200" className="h-52 w-52 shrink-0" role="img" aria-label={title}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={p.it.color}
            stroke={SURFACE}
            strokeWidth={2}
            tabIndex={0}
            role="button"
            aria-label={`${p.it.label}: ${formatValue(p.it.value)}, ${(p.it.pct * 100).toFixed(0)}%`}
            className="cursor-pointer outline-none transition-opacity"
            style={{ opacity: active === null || active === i ? 1 : 0.45 }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
        ))}
        {/* Etiquetas directas solo en slices grandes (≥8%) — nunca un número en cada punto. */}
        {paths
          .filter((p) => p.it.pct >= 0.08)
          .map((p, i) => {
            const pos = polarToXY(cx, cy, r * 0.65, p.mid);
            return (
              <text
                key={i}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                style={{ fontSize: 11, fontWeight: 600, fill: '#FFFFFF' }}
              >
                {(p.it.pct * 100).toFixed(0)}%
              </text>
            );
          })}
      </svg>

      <ul className="w-full min-w-0 space-y-1.5" aria-label={`${title} — detalle`}>
        {items.map((it, i) => (
          <LegendRow key={i} it={it} formatValue={formatValue} active={active === i} onHover={(h) => setActive(h ? i : null)} />
        ))}
      </ul>
    </div>
  );
}

function BarView({
  items,
  max,
  formatValue,
  active,
  setActive,
}: {
  items: Item[];
  max: number;
  formatValue: (v: number) => string;
  active: number | null;
  setActive: (i: number | null) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li
          key={i}
          className={`rounded-md px-1.5 py-1 transition-colors ${active === i ? 'bg-bg' : ''}`}
          onMouseEnter={() => setActive(i)}
          onMouseLeave={() => setActive(null)}
        >
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} aria-hidden />
              <span className="min-w-0 truncate text-ink">{it.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-muted">{formatValue(it.value)}</span>
              <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                {(it.pct * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="h-2 rounded bg-bg" role="img" aria-label={`${it.label}: ${formatValue(it.value)}, ${(it.pct * 100).toFixed(0)}%`}>
            <div
              className="h-2 rounded transition-all"
              style={{ width: `${(it.value / max) * 100}%`, backgroundColor: it.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function LegendRow({
  it,
  formatValue,
  active,
  onHover,
}: {
  it: Item;
  formatValue: (v: number) => string;
  active: boolean;
  onHover: (hovered: boolean) => void;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${active ? 'bg-bg' : ''}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} aria-hidden />
        <span className="min-w-0 truncate text-ink">{it.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-muted">{formatValue(it.value)}</span>
        <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
          {(it.pct * 100).toFixed(0)}%
        </span>
      </span>
    </li>
  );
}
