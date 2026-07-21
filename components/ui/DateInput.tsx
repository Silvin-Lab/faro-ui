import { InputHTMLAttributes, forwardRef } from 'react';
import { Input } from './Input';

// Date input del design system (§M8.5): `type=date` con los tokens de `Input`.
// El valor nativo es `YYYY-MM-DD`, el formato que el backend interpreta para la
// fecha del movimiento (tech-spec §4.4).
export const DateInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function DateInput(props, ref) {
    return <Input ref={ref} type="date" {...props} />;
  },
);

// Fecha de hoy en formato `YYYY-MM-DD` (valor por defecto de los forms).
export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
