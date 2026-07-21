'use client';

import { useMemo, useState } from 'react';

export type PieSlice = { label: string; value: number };

// Paleta categórica validada (dataviz skill, references/palette.md): 8 tonos en
// orden fijo, nunca ciclados — el orden es el mecanismo de seguridad CVD, no
// cosmético. "Otras" (más de 7 categorías) usa un gris de-emphasis, no una 9na
// tonalidad generada.
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

function sliceParts(index: number, total: number) {
  // Máx 7 slots de identidad + "Otras"; nunca más de 8 en juego a la vez.
  if (index < 7) return CATEGORICAL[index];
  return OTHER_COLOR;
}

export function PieChart({
  title,
  data,
  formatValue,
}: {
  title: string;
  data: PieSlice[];
  formatValue: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const { slices, total } = useMemo(() => {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    let items = sorted;
    if (sorted.length > 8) {
      const top = sorted.slice(0, 7);
      const restSum = sorted.slice(7).reduce((s, d) => s + d.value, 0);
      items = [...top, { label: 'Otras categorías', value: restSum }];
    }
    const total = items.reduce((s, d) => s + d.value, 0);
    return { slices: items, total };
  }, [data]);

  if (slices.length === 0 || total === 0) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
        <p className="text-sm text-muted">Sin datos en el rango.</p>
      </div>
    );
  }

  const cx = 100;
  const cy = 100;
  const r = 90;
  let cursor = 0;
  const paths = slices.map((s, i) => {
    const pct = s.value / total;
    const startAngle = cursor * 360;
    cursor += pct;
    const endAngle = cursor * 360;
    const start = polarToXY(cx, cy, r, startAngle);
    const end = polarToXY(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d =
      pct >= 0.999
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` // círculo completo (1 sola categoría)
        : `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    return { d, pct, color: sliceParts(i, slices.length), s, mid: startAngle + (endAngle - startAngle) / 2 };
  });

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <svg
          viewBox="0 0 200 200"
          className="h-52 w-52 shrink-0"
          role="img"
          aria-label={title}
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.color}
              stroke={SURFACE}
              strokeWidth={2}
              tabIndex={0}
              role="button"
              aria-label={`${p.s.label}: ${formatValue(p.s.value)}, ${(p.pct * 100).toFixed(0)}%`}
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
            .filter((p) => p.pct >= 0.08)
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
                  {(p.pct * 100).toFixed(0)}%
                </text>
              );
            })}
        </svg>

        <ul className="w-full min-w-0 space-y-1.5" aria-label={`${title} — detalle`}>
          {paths.map((p, i) => (
            <li
              key={i}
              className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${
                active === i ? 'bg-bg' : ''
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-ink">{p.s.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-muted">{formatValue(p.s.value)}</span>
                <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                  {(p.pct * 100).toFixed(0)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
