import { SelectHTMLAttributes, forwardRef } from 'react';

// Select field del design system (§M8.1). Extrae el `selectClass` repetido en
// `supplies` a un componente reutilizable con los mismos tokens que `Input`.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
