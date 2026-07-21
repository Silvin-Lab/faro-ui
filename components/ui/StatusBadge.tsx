import { ReactNode } from 'react';

// Status badge del design system (§M8.4). Variantes:
//  - accent  → "OK" (lime, texto oscuro)
//  - danger  → "Bajo mínimo" (tinte danger)
//  - muted   → "Sin mínimo" (neutro)
type Variant = 'accent' | 'danger' | 'muted';

const styles: Record<Variant, string> = {
  accent: 'bg-accent text-ink',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-bg text-muted',
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
