'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser, useSession } from '@/lib/user-context';
import {
  listBakeryStock,
  type ProductBranchStockItem,
  type BakeryStockScope,
} from '@/lib/bakery';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

// Stock de postres (F15). Sucursal ve el suyo; repostero/super_admin ven todas
// las sucursales (filtro + columna Sucursal). El scope lo determina el backend
// según el rol; el front lo lee de la respuesta.
export default function BakeryStockPage() {
  const me = useUser();
  const session = useSession();
  const isProduction = me.role === 'repostero' || me.role === 'super_admin';
  const activeBranchName =
    session.branches.find((b) => b.id === session.activeBranchId)?.name ?? 'tu sucursal';

  const [items, setItems] = useState<ProductBranchStockItem[]>([]);
  const [scope, setScope] = useState<BakeryStockScope>('branch');
  // Opciones de sucursal derivadas de los datos (GET /branches es 403 para
  // repostero; el stock ya trae branchId/branchName). Acumuladas.
  const [branchOpts, setBranchOpts] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState(''); // '' = todas (solo producción)
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listBakeryStock(isProduction && branchId ? { branchId } : undefined)
      .then((r) => {
        setItems(r.items);
        setScope(r.scope);
        if (r.scope === 'all') {
          setBranchOpts((prev) => {
            const map = new Map(prev.map((b) => [b.id, b.name]));
            for (const i of r.items) map.set(i.branchId, i.branchName);
            return [...map.entries()]
              .map(([id, name]) => ({ id, name }))
              .sort((a, b) => a.name.localeCompare(b.name));
          });
        }
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar el stock'))
      .finally(() => setLoading(false));
  }, [isProduction, branchId]);

  const filtered = useMemo(
    () => items.filter((i) => i.productName.toLowerCase().includes(q.trim().toLowerCase())),
    [items, q],
  );

  const showBranchCol = scope === 'all';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Stock de postres</h1>
        <p className="mt-1 text-sm text-muted">
          {showBranchCol
            ? 'Postres disponibles por sucursal.'
            : `Postres disponibles para vender en « ${activeBranchName} ».`}
        </p>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar postre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:flex-1"
            aria-label="Buscar postre por nombre"
          />
          {isProduction && (
            <Select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Filtrar por sucursal"
              className="sm:w-56"
            >
              <option value="">Todas las sucursales</option>
              {branchOpts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            {showBranchCol
              ? 'Aún no hay stock de postres.'
              : 'Aún no tienes postres en stock. Aparecerán aquí cuando la repostería surta tus pedidos.'}
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Postre</th>
                  {showBranchCol && <th className="px-2 py-2 font-medium">Sucursal</th>}
                  <th className="px-2 py-2 text-right font-medium">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((it) => (
                  <tr key={`${it.productId}-${it.branchId}`} className="text-ink">
                    <td className="px-2 py-2">{it.productName}</td>
                    {showBranchCol && <td className="px-2 py-2">{it.branchName}</td>}
                    <td
                      className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${
                        it.stockQty <= 0 ? 'text-muted' : ''
                      }`}
                    >
                      {it.stockQty} u
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showBranchCol ? 3 : 2} className="px-2 py-3 text-sm text-muted">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
