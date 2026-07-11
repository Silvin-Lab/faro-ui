'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  subscribeSessionExpired,
  getSessionExpiredSnapshot,
  resetSessionExpired,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';

// Aviso global de sesión expirada (401). Se monta en el layout autenticado y
// aparece sobre CUALQUIER pantalla en cuanto una respuesta 401 marca la sesión
// como vencida. Es bloqueante (overlay z alto + backdrop) y sin forma de
// descartarlo salvo reingresar: un 401 debe ser imposible de ignorar.
export function SessionExpiredGate() {
  const router = useRouter();
  // El snapshot es el detalle del aviso ('' = oculto). Un cambio de detalle
  // (p.ej. el POS enriquece el mensaje) re-renderiza este componente.
  const detail = useSyncExternalStore(
    subscribeSessionExpired,
    getSessionExpiredSnapshot,
    () => '',
  );

  if (!detail) return null;

  function goLogin() {
    resetSessionExpired();
    router.replace('/login');
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-detail"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div className="relative w-full max-w-md rounded-lg border-2 border-danger bg-surface p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none" aria-hidden>
            ⚠️
          </span>
          <div className="min-w-0">
            <h2 id="session-expired-title" className="text-xl font-bold text-ink">
              Tu sesión expiró
            </h2>
            <p id="session-expired-detail" className="mt-2 text-base text-ink">
              {detail}
            </p>
          </div>
        </div>
        <Button className="mt-6 w-full py-3 text-base" onClick={goLogin} autoFocus>
          Iniciar sesión
        </Button>
      </div>
    </div>
  );
}
