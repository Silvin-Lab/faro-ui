'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  listBakeryOrders,
  produceBakeryOrder,
  remaining,
  dateLabel,
  isAging,
  type BakeryOrder,
  type BakeryOrderStatus,
} from '@/lib/bakery';
import { getRecipe, formatBase, type RecipeItem } from '@/lib/supplies';
import { listWarehouseStock, type WarehouseStockItem } from '@/lib/warehouse';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { OrderStatusBadge, ShipmentProgress, AgingIndicator } from '@/components/bakery/BakeryBits';

// Cola de producción (F5-F11) — repostero + super_admin. Worklist FIFO de todas
// las sucursales con el modal de "Registrar producción" (preview en vivo del
// doble efecto).

type StatusFilter =
  | 'por_surtir'
  | 'pending'
  | 'in_production'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'all';

// Mapea el filtro de UI a los `status` que se envían al backend (CSV).
function statusParam(f: StatusFilter): BakeryOrderStatus[] | undefined {
  switch (f) {
    case 'por_surtir':
      return ['pending', 'in_production'];
    case 'all':
      return undefined;
    default:
      return [f];
  }
}

export default function BakeryQueuePage() {
  const me = useUser();
  const canView = me.role === 'repostero' || me.role === 'super_admin';

  const [orders, setOrders] = useState<BakeryOrder[]>([]);
  // Opciones de sucursal derivadas de los datos (acumuladas): GET /branches es
  // 403 para repostero, y los pedidos ya traen branchId/branchName. Se acumulan
  // para que filtrar por una no colapse el resto del dropdown.
  const [branchOpts, setBranchOpts] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<StatusFilter>('por_surtir');
  const [branchId, setBranchId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [producing, setProducing] = useState<BakeryOrder | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listBakeryOrders({ status: statusParam(status), branchId: branchId || undefined })
      .then((os) => {
        setOrders(os);
        setBranchOpts((prev) => {
          const map = new Map(prev.map((b) => [b.id, b.name]));
          for (const o of os) map.set(o.branchId, o.branchName);
          return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        });
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar la cola'))
      .finally(() => setLoading(false));
  }, [status, branchId]);

  useEffect(() => {
    if (canView) refresh();
  }, [canView, refresh]);

  const filtered = useMemo(
    () => orders.filter((o) => o.productName.toLowerCase().includes(q.trim().toLowerCase())),
    [orders, q],
  );

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a la cola de producción.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cola de producción</h1>
        <p className="mt-1 text-sm text-muted">
          Pedidos de postres de todas las sucursales. Los más antiguos primero.
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
          <option value="in_production">En producción</option>
          <option value="shipped">Surtidos</option>
          <option value="received">Recibidos</option>
          <option value="cancelled">Cancelados</option>
          <option value="all">Todos</option>
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
          placeholder="Buscar postre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:flex-1"
          aria-label="Buscar postre por nombre"
        />
      </div>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            {status === 'por_surtir' && q.trim() === '' && branchId === ''
              ? 'Cola al día. No hay pedidos por surtir.'
              : 'Sin pedidos con estos filtros.'}
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Antig.</th>
                  <th className="px-2 py-2 font-medium">Sucursal</th>
                  <th className="px-2 py-2 font-medium">Postre</th>
                  <th className="px-2 py-2 text-right font-medium">Pedido</th>
                  <th className="px-2 py-2 font-medium">Surtido</th>
                  <th className="px-2 py-2 text-right font-medium">Falta</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((o) => {
                  const producible = o.status === 'pending' || o.status === 'in_production';
                  return (
                    <tr key={o.id} className="align-top text-ink">
                      <td className="whitespace-nowrap px-2 py-2">
                        {isAging(o) ? (
                          <AgingIndicator createdAt={o.createdAt} />
                        ) : (
                          <span className="text-muted">{dateLabel(o.createdAt)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">{o.branchName}</td>
                      <td className="px-2 py-2">{o.productName}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{o.quantityOrdered}</td>
                      <td className="px-2 py-2">
                        <ShipmentProgress shipped={o.quantityShipped} ordered={o.quantityOrdered} />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">
                        {remaining(o)}
                      </td>
                      <td className="px-2 py-2">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-2 py-2">
                        {producible ? (
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => setProducing(o)}
                          >
                            Producir
                          </Button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {producing && (
        <ProduceModal
          order={producing}
          onClose={() => setProducing(null)}
          onDone={() => {
            setProducing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// --- Modal "Registrar producción" (F7-F11) ---------------------------------
function ProduceModal({
  order,
  onClose,
  onDone,
}: {
  order: BakeryOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const falta = remaining(order);
  const [qtyStr, setQtyStr] = useState(String(falta > 0 ? falta : 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview en vivo: receta del postre + stock actual del almacén (para el aviso
  // de insumos insuficientes). Ambos degradan con gracia si no se pueden cargar.
  const [recipe, setRecipe] = useState<RecipeItem[] | null>(null);
  const [stock, setStock] = useState<WarehouseStockItem[] | null>(null);
  const [recipeError, setRecipeError] = useState(false);

  useEffect(() => {
    getRecipe(order.productId)
      .then((r) => setRecipe(r))
      .catch(() => {
        setRecipe([]);
        setRecipeError(true);
      });
    listWarehouseStock()
      .then((s) => setStock(s))
      .catch(() => setStock([]));
  }, [order.productId]);

  const qty = Math.round(Number(qtyStr));
  const validQty = Number.isFinite(qty) && qty > 0;

  // Insumos que bajarán = receta × cantidad (misma semántica que rowQuantityBase).
  const consumption = useMemo(() => {
    if (!recipe) return [];
    return recipe.map((r) => {
      const consumed = r.quantityBase * (validQty ? qty : 0);
      const stockItem = stock?.find((s) => s.supplyId === r.supplyId);
      const after = stockItem ? stockItem.stockBase - consumed : null;
      return {
        supplyName: r.supplyName,
        baseUnit: r.baseUnit,
        consumed,
        short: after !== null && after < 0 ? -after : 0,
      };
    });
  }, [recipe, stock, qty, validQty]);

  const insufficient = consumption.filter((c) => c.short > 0);

  const resultShipped = order.quantityShipped + (validQty ? qty : 0);
  const willComplete = resultShipped >= order.quantityOrdered;

  async function onSubmit() {
    if (!validQty) return;
    setSaving(true);
    setError(null);
    try {
      await produceBakeryOrder(order.id, qty);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // El pedido cambió de estado por debajo (concurrencia): informar y cerrar
        // refrescando la cola para reflejar el estado real.
        setError('El pedido ya no se puede producir (cambió de estado). Se actualizará la cola.');
        setTimeout(onDone, 1200);
      } else {
        setError(e instanceof ApiError ? e.message : 'No se pudo registrar la producción.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Registrar producción" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-ink">
            {order.productName} · para « {order.branchName} »
          </p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            Pedido: {order.quantityOrdered} · Ya surtido: {order.quantityShipped} · Falta: {falta}
          </p>
        </div>

        <FormField label="Cantidad producida ahora" htmlFor="produce-qty">
          <Input
            id="produce-qty"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            className="tabular-nums"
            autoFocus
          />
        </FormField>
        <p className="-mt-2 text-xs text-muted">
          Puede ser menor a lo que falta (producción parcial).
        </p>

        <div className="space-y-2 border-t border-line pt-3 text-sm">
          <p className="font-medium text-ink">Al registrar:</p>
          {recipe === null ? (
            <p className="text-muted">Calculando insumos…</p>
          ) : recipeError ? (
            <p className="text-muted">
              No se pudo cargar la receta para el preview; el descuento de insumos lo hará el
              servidor al registrar.
            </p>
          ) : recipe.length === 0 ? (
            <p className="text-muted">Este postre no tiene receta; no se descontarán insumos.</p>
          ) : (
            <p className="text-muted">
              <span className="text-ink">Consumirá del almacén central:</span>{' '}
              {consumption
                .map((c) => `${c.supplyName} ${formatBase(c.consumed)} ${c.baseUnit}`)
                .join(' · ')}
            </p>
          )}
          <p className="text-muted">
            <span className="text-ink">Acreditará</span>{' '}
            <span className="tabular-nums text-ink">{validQty ? qty : 0} u.</span> de{' '}
            {order.productName} a « {order.branchName} ».
          </p>
          <p className="text-muted">
            El pedido quedará{' '}
            {willComplete ? (
              <span className="font-medium text-success">Surtido</span>
            ) : (
              <>
                <span className="font-medium text-accent-strong">En producción</span>, faltarán{' '}
                <span className="tabular-nums text-ink">
                  {Math.max(0, order.quantityOrdered - resultShipped)}
                </span>
              </>
            )}
            .
          </p>
        </div>

        {insufficient.length > 0 && (
          <Alert variant="warning">
            El almacén no tiene suficiente{' '}
            {insufficient
              .map((c) => `${c.supplyName} (faltan ${formatBase(c.short)} ${c.baseUnit})`)
              .join(', ')}
            . Se registrará igual y el stock quedará en negativo.
          </Alert>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="button" onClick={onSubmit} loading={saving} disabled={!validQty}>
            Registrar producción
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
