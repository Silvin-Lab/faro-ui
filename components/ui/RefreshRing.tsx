'use client';

// Anillo tipo Metabase: se llena de vacío a lleno (verde) durante `seconds`,
// indicando cuánto falta para la próxima actualización automática. `cycleKey`
// cambia cada vez que arranca un ciclo (auto o manual) — al cambiar, el
// `key` del <circle> lo remonta y la animación CSS vuelve a empezar vacía.
export function RefreshRing({ seconds, cycleKey }: { seconds: number; cycleKey: number }) {
  const size = 28;
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6E6E4" strokeWidth={3} />
      <circle
        key={cycleKey}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#2E7D32"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ animation: `ring-fill ${seconds}s linear forwards` }}
      />
    </svg>
  );
}
