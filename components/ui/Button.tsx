import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-strong', // lime con texto oscuro
  secondary: 'bg-bg text-ink border border-line hover:bg-line', // neutro (secundario)
  outline: 'bg-surface text-ink border border-line hover:bg-bg',
  ghost: 'bg-transparent text-muted hover:text-ink',
};

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? 'Cargando…' : children}
    </button>
  );
}
