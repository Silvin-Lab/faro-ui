import { ReactNode } from 'react';

// Alert / Callout banner del design system (§M8.2): icono + texto + acción
// opcional. Variantes info (accent) / warning (danger tint). Solo presentación.
type Variant = 'info' | 'warning';

const styles: Record<Variant, { box: string; icon: string }> = {
  info: { box: 'border-line bg-bg text-ink', icon: 'text-accent-strong' },
  warning: { box: 'border-danger/30 bg-danger/10 text-ink', icon: 'text-danger' },
};

export function Alert({
  variant = 'info',
  children,
  action,
}: {
  variant?: Variant;
  children: ReactNode;
  action?: ReactNode;
}) {
  const s = styles[variant];
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${s.box}`}
    >
      <div className="flex items-center gap-2">
        <svg
          className={`h-5 w-5 shrink-0 ${s.icon}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 7a1 1 0 100 2 1 1 0 000-2z"
            clipRule="evenodd"
          />
        </svg>
        <span>{children}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
