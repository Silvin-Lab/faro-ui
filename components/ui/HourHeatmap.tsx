'use client';

import { useState } from 'react';

export type HourValue = { hour: number; totalCents: number; count: number };

const START_HOUR = 8;
const END_HOUR = 22; // inclusive

// Ancla del heat (mismo criterio que el status del design system: crítico→bien).
const LOW: [number, number, number] = [208, 59, 59]; // #d03b3b
const MID: [number, number, number] = [250, 178, 25]; // #fab219
const HIGH: [number, number, number] = [12, 163, 12]; // #0ca30c

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function heatColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const [a, b] = clamped < 0.5 ? [LOW, MID] : [MID, HIGH];
  const localT = clamped < 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  return [lerp(a[0], b[0], localT), lerp(a[1], b[1], localT), lerp(a[2], b[2], localT)];
}

function rgbCss([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Luminancia relativa aproximada — decide si el texto sobre el color va blanco u ink.
function textOn([r, g, b]: [number, number, number]) {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#1A1A1A' : '#FFFFFF';
}

function formatCompact(cents: number) {
  const pesos = cents / 100;
  if (pesos >= 1000) return `$${(pesos / 1000).toFixed(1)}k`;
  return `$${Math.round(pesos)}`;
}

export function HourHeatmap({ data }: { data: HourValue[] }) {
  const [active, setActive] = useState<number | null>(null);

  const byHour = new Map(data.map((h) => [h.hour, h]));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const cells = hours.map((hour) => byHour.get(hour) ?? { hour, totalCents: 0, count: 0 });
  const max = Math.max(1, ...cells.map((c) => c.totalCents));

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
        {cells.map((c, i) => {
          const t = c.totalCents / max;
          const color = heatColor(t);
          const bg = rgbCss(color);
          const fg = textOn(color);
          return (
            <div
              key={c.hour}
              tabIndex={0}
              role="img"
              aria-label={`${c.hour}:00 a ${c.hour + 1}:00 — ${formatCompact(c.totalCents)}, ${c.count} ${c.count === 1 ? 'venta' : 'ventas'}`}
              className="cursor-default rounded-md px-1 py-2 text-center outline-none transition-transform"
              style={{
                backgroundColor: bg,
                color: fg,
                transform: active === i ? 'scale(1.06)' : undefined,
                boxShadow: active === i ? '0 0 0 2px #FFFFFF, 0 0 0 3px #1A1A1A' : undefined,
              }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <div className="text-xs font-semibold tabular-nums">{c.hour}h</div>
              <div className="text-[11px] font-medium tabular-nums opacity-90">{formatCompact(c.totalCents)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted">Menos ventas</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{ background: `linear-gradient(to right, ${rgbCss(LOW)}, ${rgbCss(MID)}, ${rgbCss(HIGH)})` }}
          aria-hidden
        />
        <span className="text-xs text-muted">Más ventas</span>
      </div>

      {active !== null && (
        <p className="mt-2 text-xs text-ink">
          <span className="font-semibold">{cells[active].hour}:00–{cells[active].hour + 1}:00</span> ·{' '}
          {formatCompact(cells[active].totalCents)} · {cells[active].count}{' '}
          {cells[active].count === 1 ? 'venta' : 'ventas'}
        </p>
      )}
    </div>
  );
}
