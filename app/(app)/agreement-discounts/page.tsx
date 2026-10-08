'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  listAgreementDiscounts,
  createAgreementDiscount,
  updateAgreementDiscount,
  archiveAgreementDiscount,
  type AgreementDiscount,
} from '@/lib/agreementDiscounts';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Mensaje claro al chocar con el índice de % único activo (409).
const DUPLICATE_MSG = 'Ya existe un descuento activo con ese porcentaje.';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'agreement_discount_duplicate') return DUPLICATE_MSG;
    if (e.code === 'validation_error') return 'El porcentaje debe ser un número entre 1 y 100.';
    return e.message;
  }
  return 'No se pudo guardar el descuento.';
}

function DiscountModal({
  initial,
  onSave,
  onClose,
}: {
  initial: AgreementDiscount | null;
  onSave: (percent: number) => Promise<void>;
  onClose: () => void;
}) {
  const [percent, setPercent] = useState<number>(initial?.percent ?? 10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = !Number.isInteger(percent) || percent < 1 || percent > 100;

  async function submit() {
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(percent);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-ink">
          {initial ? 'Editar descuento' : 'Nuevo descuento'}
        </h3>

        <div>
          <label htmlFor="adpct" className="mb-1 block text-sm font-medium text-ink">
            Porcentaje (%)
          </label>
          <Input
            id="adpct"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => {
              setPercent(Math.floor(Number(e.target.value) || 0));
              // Limpia el error de duplicado/validación al editar el campo.
              if (error) setError(null);
            }}
            className="w-32"
            autoFocus
          />
          <p className="mt-1 text-xs text-muted">Un número entero entre 1 y 100.</p>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" loading={saving} disabled={invalid} onClick={submit}>
            {initial ? 'Guardar cambios' : 'Crear descuento'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AgreementDiscountsPage() {
  const me = useUser();
  const [discounts, setDiscounts] = useState<AgreementDiscount[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgreementDiscount | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      const items = await listAgreementDiscounts(showArchived ? 'all' : 'active');
      setDiscounts(items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    setDiscounts(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.isSuperAdmin, showArchived]);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio configura los convenios.</p>
      </Card>
    );
  }

  async function save(percent: number) {
    if (editing) await updateAgreementDiscount(editing.id, percent);
    else await createAgreementDiscount(percent);
    setEditing(null);
    setCreating(false);
    await reload();
  }

  async function archive(d: AgreementDiscount) {
    setBusyId(d.id);
    setError(null);
    try {
      await archiveAgreementDiscount(d.id);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo archivar');
    } finally {
      setBusyId(null);
    }
  }

  // Reactivar un % archivado = recrearlo activo (la columna tiene índice único
  // parcial solo entre activos, por lo que el mismo % se puede volver a crear).
  async function reactivate(d: AgreementDiscount) {
    setBusyId(d.id);
    setError(null);
    try {
      await createAgreementDiscount(d.percent);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">Convenios</h1>
        <Button onClick={() => setCreating(true)}>+ Nuevo descuento</Button>
      </div>

      <Card className="bg-accent/10">
        <p className="text-sm text-ink">
          Los descuentos de convenio se aplican en el punto de venta cuando la venta tiene un{' '}
          <span className="font-medium">cliente asociado</span>. El cajero toca el botón del
          porcentaje y el descuento se aplica sobre el total (se suma a la promoción de lealtad).
        </p>
      </Card>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-accent-strong"
          />
          Ver archivados
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {discounts === null ? (
        <Card>
          <p className="text-muted">Cargando…</p>
        </Card>
      ) : discounts.length === 0 ? (
        <Card>
          <p className="text-muted">
            No hay descuentos{showArchived ? '' : ' activos'}. Crea el primero para empezar.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {discounts.map((d) => {
            const archived = d.status === 'inactive';
            return (
              <li key={d.id}>
                <Card className={archived ? 'opacity-60' : ''}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold tabular-nums text-ink">{d.percent}%</span>
                      {archived && (
                        <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
                          Archivado
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {archived ? (
                        <Button
                          variant="outline"
                          loading={busyId === d.id}
                          onClick={() => reactivate(d)}
                        >
                          Reactivar
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setEditing(d)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            loading={busyId === d.id}
                            onClick={() => archive(d)}
                          >
                            Archivar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <DiscountModal
          initial={editing}
          onSave={save}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
