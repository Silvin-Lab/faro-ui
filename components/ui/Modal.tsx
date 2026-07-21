'use client';

import { ReactNode, useEffect } from 'react';

// Overlay genérico y cerrable (click en backdrop, botón "×", o Escape). Misma
// convención visual que components/SessionExpiredGate.tsx (backdrop bg-black/60,
// contenedor bg-surface con borde y sombra), pero ese es bloqueante y este no.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border border-line bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md px-2 py-1 text-lg leading-none text-muted hover:bg-bg hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
