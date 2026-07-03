'use client';

import { InputHTMLAttributes, useState } from 'react';
import { Input } from './Input';

// Campo de contraseña con botón "Ver/Ocultar" para revelar lo tecleado.
export function PasswordInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={`pr-16 ${className}`} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-muted hover:text-ink"
      >
        {show ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  );
}
