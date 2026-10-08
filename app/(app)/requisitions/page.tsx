'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { useUser } from '@/lib/user-context';
import {
  listRequisitions,
  getRequisition,
  closeRequisition,
  requisitionRemaining,
  requisitionStatusLabel,
  dateLabel,
  type SupplyRequisition,
  type SupplyRequisitionStatus,
  type SupplyRequisitionDetail,
} from '@/lib/requisitions';
import { ageDays } from '@/lib/bakery';
import { formatBase } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Requisiciones de insumos (M11) — super_admin. Calco de bakery/queue: worklist
// FIFO de solicitudes de las sucursales a la matriz, con detalle en modal y el
// surtido delegado a la pantalla de Salidas (via query params).

type StatusFilter = 'por_surtir' | SupplyRequisitionStatus | 'all';

// Umbral visual de antigüedad (mismo criterio que repostería, front-only).
const AGING_THRESHOLD_DAYS = 2;

const STATUS_VARIANT: Record<SupplyRequisitionStatus, 'accent' | 'danger' | 'muted' | 'success'> = {
  pending: 'muted',
  partial: 'accent',
  fulfilled: 'success',
  cancelled: 'danger',
};

function matchesFilter(status: SupplyRequisitionStatus, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'por_surtir') return status === 'pending' || status === 'partial';
  return status === f;
}

export default function RequisitionsPage() {
  const me = useUser();
  const canView = me.role === 'super_admin';

  const router = useRouter();
  const [requisitions, setRequisitions] = useState<SupplyRequisition[]>([]);
  // Opciones de sucursal derivadas de los datos (acumuladas): GET /branches puede
  // no estar disponible aquí y las requisiciones ya traen branchId/branchName.
  const [branchOpts, setBranchOpts] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<StatusFilter>('por_surtir');
  const [branchId, setBranchId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  // El backend filtra por un solo estado; el combinado "por surtir" (pending+partial)
  // se resuelve en cliente, así que se piden todas (sin ?status) y se filtra local.
  // branchId y q sí van al servidor.
  const refresh = useCallback(() => {
    setLoading(true);
    listRequisitions({ branchId: branchId || undefined, q: q.trim() || undefined })
      .then((rs) => {
        setRequisitions(rs);
        setBranchOpts((prev) => {
          const map = new Map(prev.map((b) => [b.id, b.name]));
          for (const r of rs) map.set(r.branchId, r.branchName);
          return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        });
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Error al cargar las requisiciones'),
      )
      .finally(() => setLoading(false));
  }, [branchId, q]);

  useEffect(() => {
    if (canView) refresh();
  }, [canView, refresh]);

  const filtered = useMemo(
    () => requisitions.filter((r) => matchesFilter(r.status, status)),
    [requisitions, status],
  );

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona las requisiciones.</p>
      </Card>
    );
  }

  const emptyDefault = status === 'por_surtir' && q.trim() === '' && branchId === '';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Requisiciones</h1>
        <p className="mt-1 text-sm text-muted">
          Insumos que las sucursales piden a la matriz. Las más antiguas primero.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filtrar por estado"
          className="sm:w-52"
        >
          <option value="por_surtir">Por surtir</option>
          <option value="pending">Pendientes</option>
          <option value="partial">Parciales</option>
          <option value="fulfilled">Surtidas</option>
          <option value="cancelled">Canceladas</option>
          <option value="all">Todas</option>
        </Select>
        <Select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Filtrar por sucursal"
          className="sm:w-52"
        >
          <option value="">Todas las sucursales</option>
          {branchOpts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Buscar insumo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:flex-1"
          aria-label="Buscar por nombre de insumo"
        />
      </div>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            {emptyDefault
              ? 'Cola al día. No hay requisiciones por surtir.'
              : 'Sin requisiciones con estos filtros.'}
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Antig.</th>
                  <th className="px-2 py-2 font-medium">Sucursal</th>
                  <th className="px-2 py-2 font-medium">Solicitante</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => {
                  const days = ageDays(r.createdAt);
                  const aging =
                    (r.status === 'pending' || r.status === 'partial') &&
                    days >= AGING_THRESHOLD_DAYS;
                  return (
                    <tr key={r.id} className="align-top text-ink">
                      <td className="whitespace-nowrap px-2 py-2">
                        {aging ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                            title={`Solicitada hace ${days} ${days === 1 ? 'día' : 'días'} sin surtir por completo`}
                          >
                            <Clock size={14} strokeWidth={2} className="shrink-0" aria-hidden />
                            {days} {days === 1 ? 'día' : 'días'}
                          </span>
                        ) : (
                          <span className="text-muted">{dateLabel(r.createdAt)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">{r.branchName}</td>
                      <td className="px-2 py-2 text-muted">{r.requestedByName ?? '—'}</td>
                      <td className="px-2 py-2">
                        <StatusBadge variant={STATUS_VARIANT[r.status]}>
                          {requisitionStatusLabel(r.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-2 py-2">
                        <Button type="button" variant="outline" onClick={() => setOpenId(r.id)}>
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openId && (
        <RequisitionModal
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onDispatch={(item, req) => {
            const falta = requisitionRemaining(item);
            const params = new URLSearchParams({
              requisitionItemId: item.id,
              supplyId: item.supplyId,
              branchId: req.branchId,
              quantityBase: String(falta),
            });
            router.push(`/warehouse/dispatches?${params.toString()}`);
          }}
        />
      )}
    </div>
  );
}

// --- Modal de detalle -------------------------------------------------------
function RequisitionModal({
  id,
  onClose,
  onChanged,
  onDispatch,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onDispatch: (
    item: SupplyRequisitionDetail['items'][number],
    req: SupplyRequisitionDetail['requisition'],
  ) => void;
}) {
  const [detail, setDetail] = useState<SupplyRequisitionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    getRequisition(id)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la requisición'));
  }, [id]);

  async function onClose409() {
    if (!detail) return;
    setClosing(true);
    setCloseError(null);
    try {
      await closeRequisition(detail.requisition.id);
      onChanged();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setCloseError('La requisición cambió de estado. Se actualizará la lista.');
        onChanged();
      } else {
        setCloseError(e instanceof ApiError ? e.message : 'No se pudo cerrar la requisición.');
      }
    } finally {
      setClosing(false);
    }
  }

  return (
    <Modal title="Detalle de requisición" onClose={onClose}>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !detail ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-ink">« {detail.requisition.branchName} »</p>
            <p className="mt-1 text-sm text-muted">
              Solicitada el {dateLabel(detail.requisition.createdAt)}
              {detail.requisition.requestedByName ? ` por ${detail.requisition.requestedByName}` : ''}
              {' · '}
              {requisitionStatusLabel(detail.requisition.status)}
            </p>
            {detail.requisition.note?.trim() && (
              <p className="mt-1 text-sm text-muted">Nota: {detail.requisition.note}</p>
            )}
          </div>

          <div className="-mx-1 overflow-x-auto border-t border-line pt-3">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-1 py-2 font-medium">Insumo</th>
                  <th className="px-1 py-2 text-right font-medium">Pedido</th>
                  <th className="px-1 py-2 text-right font-medium">Surtido</th>
                  <th className="px-1 py-2 text-right font-medium">Falta</th>
                  <th className="px-1 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.items.map((it) => {
                  const falta = requisitionRemaining(it);
                  return (
                    <tr key={it.id} className="align-top text-ink">
                      <td className="px-1 py-2">{it.supplyName}</td>
                      <td className="px-1 py-2 text-right tabular-nums">
                        {formatBase(it.quantityRequested)} {it.baseUnit}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-muted">
                        {formatBase(it.quantityFulfilled)} {it.baseUnit}
                      </td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums">
                        {formatBase(falta)} {it.baseUnit}
                      </td>
                      <td className="px-1 py-2">
                        {falta > 0 ? (
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => onDispatch(it, detail.requisition)}
                          >
                            Surtir
                          </Button>
                        ) : (
                          <span className="text-success">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {closeError && <p className="text-sm text-danger">{closeError}</p>}

          <div className="flex gap-2 border-t border-line pt-3">
            {detail.requisition.status === 'partial' && (
              <Button type="button" onClick={onClose409} loading={closing}>
                Cerrar requisición
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
          {detail.requisition.status === 'partial' && (
            <p className="-mt-2 text-xs text-muted">
              Cerrar da por terminada la requisición aunque no se haya surtido todo lo pedido.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
