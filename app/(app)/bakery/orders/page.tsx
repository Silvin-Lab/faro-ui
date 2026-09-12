'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser, useSession } from '@/lib/user-context';
import { listProducts, type Product } from '@/lib/products';
import {
  listBakeryOrders,
  createBakeryOrder,
  cancelBakeryOrder,
  receiveBakeryOrder,
  dateLabel,
  isToday,
  isAging,
  type BakeryOrder,
} from '@/lib/bakery';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { FormField } from '@/components/ui/FormField';
import { OrderStatusBadge, ShipmentProgress, AgingIndicator } from '@/components/bakery/BakeryBits';

// Pedidos a repostería (sucursal) — F3, F4, F6, F12-F14. Form + historial en la
// misma ruta (patrón M8). Solo roles de sucursal operan esta pantalla; el backend
// gatea (super_admin/repostero no tienen sucursal a nombre de quién pedir).
export default function BakeryOrdersPage() {
  const me = useUser();
  const session = useSession();
  const isBranchUser =
    me.role === 'branch_admin' || me.role === 'cashier' || me.role === 'barista';
  const activeBranchName =
    session.branches.find((b) => b.id === session.activeBranchId)?.name ?? 'tu sucursal';

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<BakeryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const bakeryProducts = useMemo(
    () => products.filter((p) => p.fulfillmentType === 'bakery' && p.status === 'active'),
    [products],
  );

  async function refresh() {
    try {
      setOrders(await listBakeryOrders());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Error al cargar tus pedidos');
    }
  }

  useEffect(() => {
    if (!isBranchUser) return;
    Promise.all([listProducts(), listBakeryOrders()])
      .then(([ps, os]) => {
        setProducts(ps);
        setOrders(os);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Error al cargar la pantalla'))
      .finally(() => setLoading(false));
  }, [isBranchUser]);

  const qty = Math.round(Number(quantity));
  const canSubmit = productId !== '' && qty > 0 && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setFormError(null);
    try {
      await createBakeryOrder({ productId, quantity: qty, note });
      setProductId('');
      setQuantity('');
      setNote('');
      await refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Error al crear el pedido');
    } finally {
      setSaving(false);
    }
  }

  // Historial en orden inverso (más reciente arriba). El backend devuelve FIFO.
  const historyDesc = useMemo(() => [...orders].reverse(), [orders]);

  if (!isBranchUser) {
    return (
      <Card>
        <p className="text-muted">
          Los pedidos a repostería se crean desde una sucursal. Como cola de producción, revisa{' '}
          <span className="text-ink">Cola de producción</span>.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pedidos a repostería</h1>
        <p className="mt-1 text-sm text-muted">
          Pide postres a la repostería central. Se surten a « {activeBranchName} ».
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Nuevo pedido</h2>
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : bakeryProducts.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no hay postres de repostería. Pídele al administrador que marque los productos que
            surte la central.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField label="Postre" htmlFor="productId">
              <SearchableSelect
                id="productId"
                options={bakeryProducts.map((p) => ({ id: p.id, label: p.name }))}
                value={productId}
                onChange={setProductId}
                placeholder="Buscar postre…"
                emptyLabel="Sin postres con ese nombre."
                required
              />
            </FormField>

            <FormField label="Cantidad" htmlFor="quantity">
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField label="Nota (opcional)" htmlFor="note">
              <Input
                id="note"
                placeholder="Ej. para el fin de semana"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>

            <p className="border-t border-line pt-3 text-xs text-muted">
              Se enviará a la repostería a nombre de « {activeBranchName} ».
            </p>

            {formError && <p className="text-sm text-danger">{formError}</p>}
            <Button type="submit" loading={saving} disabled={!canSubmit}>
              Crear pedido
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Mis pedidos</h2>
        {loadError && <p className="mb-2 text-sm text-danger">{loadError}</p>}
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : historyDesc.length === 0 ? (
          <p className="text-sm text-muted">Aún no has hecho pedidos.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Postre</th>
                  <th className="px-2 py-2 text-right font-medium">Pedido</th>
                  <th className="px-2 py-2 font-medium">Surtido</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Nota</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {historyDesc.map((o) => (
                  <OrderRow key={o.id} order={o} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function OrderRow({ order, onChanged }: { order: BakeryOrder; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = isToday(order.createdAt);
  const aging = isAging(order);

  async function act(fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      // 409 invalid_state: el estado cambió por debajo → refrescar para reflejarlo.
      if (e instanceof ApiError && e.status === 409) {
        setErr('El pedido cambió de estado. Se actualizó la lista.');
        await onChanged();
      } else {
        setErr(e instanceof ApiError ? e.message : 'No se pudo completar la acción.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="align-top text-ink">
      <td className={`whitespace-nowrap px-2 py-2 ${today ? 'font-semibold' : 'text-muted'}`}>
        <div className="flex flex-col gap-0.5">
          <span>{dateLabel(order.createdAt)}</span>
          {aging && <AgingIndicator createdAt={order.createdAt} />}
        </div>
      </td>
      <td className={`px-2 py-2 ${today ? 'font-semibold' : ''}`}>{order.productName}</td>
      <td className="px-2 py-2 text-right tabular-nums">{order.quantityOrdered}</td>
      <td className="px-2 py-2">
        <ShipmentProgress shipped={order.quantityShipped} ordered={order.quantityOrdered} />
      </td>
      <td className="px-2 py-2">
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="px-2 py-2 text-muted">{order.note?.trim() ? order.note : '—'}</td>
      <td className="px-2 py-2">
        {order.status === 'pending' ? (
          <Button
            type="button"
            variant="outline"
            loading={busy}
            onClick={() =>
              void act(
                () => cancelBakeryOrder(order.id),
                `¿Cancelar el pedido de ${order.quantityOrdered} × ${order.productName}?`,
              )
            }
          >
            Cancelar
          </Button>
        ) : order.status === 'shipped' ? (
          <Button
            type="button"
            variant="outline"
            loading={busy}
            onClick={() => void act(() => receiveBakeryOrder(order.id))}
          >
            Marcar recibido
          </Button>
        ) : (
          <span className="text-muted">—</span>
        )}
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </td>
    </tr>
  );
}
