import { ReactNode } from 'react';

// Status badge del design system (§M8.4, +M10). Variantes:
//  - accent  → "OK" / en proceso (lime, texto oscuro)
//  - danger  → "Bajo mínimo" / cancelado (tinte danger)
//  - muted   → "Sin mínimo" / pendiente (neutro)
//  - success → completado (surtido/recibido), verde (§M10.4)
type Variant = 'accent' | 'danger' | 'muted' | 'success';

const styles: Record<Variant, string> = {
  accent: 'bg-accent text-ink',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-bg text-muted',
  success: 'bg-success/10 text-success',
};

export function StatusBadge({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
