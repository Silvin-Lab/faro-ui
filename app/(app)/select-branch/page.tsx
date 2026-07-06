'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/user-context';
import { selectBranch, roleLandingPath } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';

// Selección / cambio de sucursal (ADR-007). Al elegir se re-emite la cookie con el claim
// activeBranchId; se navega al POS con recarga completa para que el layout relea la sesión.
export default function SelectBranchPage() {
  const session = useSession();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branches = session.branches;

  async function choose(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await selectBranch(id);
      // Recarga completa: el layout vuelve a /auth/me con la sucursal activa ya fijada.
      // Aterrizaje por rol: branch_admin → /reports; cashier/barista → /pos.
      window.location.assign(roleLandingPath(session.user.role));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo seleccionar la sucursal');
      setBusyId(null);
    }
  }

  // Super admin no opera sucursales.
  if (session.user.isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card>
          <p className="text-muted">Como super admin administras el negocio, no operas sucursales.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-ink">
            Faro<span className="text-accent-strong">.</span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-ink">Elige tu sucursal</h1>
          <p className="text-sm text-muted">Selecciona la sucursal en la que vas a operar.</p>
        </div>

        <Card>
          {branches.length === 0 ? (
            <p className="text-sm text-muted">
              No tienes sucursales asignadas. Pide a un administrador que te asigne una.
            </p>
          ) : (
            <ul className="space-y-2">
              {branches.map((b) => {
                const active = session.activeBranchId === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => choose(b.id)}
                      disabled={busyId !== null}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                        active
                          ? 'border-accent-strong bg-accent text-ink'
                          : 'border-line bg-surface text-ink hover:bg-bg'
                      }`}
                    >
                      <span>{b.name}</span>
                      <span className="text-xs text-muted">
                        {busyId === b.id ? 'Entrando…' : active ? 'Actual' : 'Elegir'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
