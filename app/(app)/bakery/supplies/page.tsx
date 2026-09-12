'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { listWarehouseStock, type WarehouseStockItem } from '@/lib/warehouse';
import { listSupplies, listSupplyCategories, formatBase, type SupplyCategory } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Insumos del almacén central (F17) — repostero, SOLO LECTURA. Reusa
// GET /warehouse/stock (abierto a repostero por tech-spec §7.2). Sin edición de
// mín/máx, sin ajuste, sin enlaces a compras/salidas/mermas, y el banner de
// bajo-mínimo es info SIN acción "ver qué comprar" (el repostero no compra, D5).
function StockStatusBadge({ status }: { status: WarehouseStockItem['status'] }) {
  if (status === 'below_min') return <StatusBadge variant="danger">Bajo mínimo</StatusBadge>;
  if (status === 'no_min') return <StatusBadge variant="muted">Sin mínimo</StatusBadge>;
  return <StatusBadge variant="accent">OK</StatusBadge>;
}

export default function BakerySuppliesPage() {
  const me = useUser();
  const canView = me.role === 'repostero' || me.role === 'super_admin';

  const [items, setItems] = useState<WarehouseStockItem[]>([]);
  const [cats, setCats] = useState<SupplyCategory[]>([]);
  const [catMap, setCatMap] = useState<Record<string, string | null>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    listWarehouseStock()
      .then((its) => {
        setItems(its);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar los insumos'))
      .finally(() => setLoading(false));
    // Categorías + mapa insumo→categoría para el filtro. Si el rol no tiene acceso
    // a /supplies (repostero), el filtro degrada a "Todas" sin romper la tabla.
    listSupplyCategories()
      .then((c) => setCats([...c].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setCats([]));
    listSupplies()
      .then((sups) => setCatMap(Object.fromEntries(sups.map((s) => [s.id, s.categoryId]))))
      .catch(() => setCatMap({}));
  }, [canView]);

  const belowMin = items.filter((i) => i.status === 'below_min').length;

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchesName = i.name.toLowerCase().includes(q.trim().toLowerCase());
        const categoryId = catMap[i.supplyId] ?? null;
        const matchesCat =
          cat === 'all' || (cat === 'none' ? categoryId === null : categoryId === cat);
        return matchesName && matchesCat;
      }),
    [items, q, cat, catMap],
  );

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a los insumos del almacén.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Insumos del almacén central</h1>
        <p className="mt-1 text-sm text-muted">
          Solo lectura. Las compras y ajustes los gestiona el administrador.
        </p>
      </div>

      {belowMin > 0 && (
        <Alert variant="info">
          {belowMin} {belowMin === 1 ? 'insumo' : 'insumos'} en o por debajo de su mínimo.
        </Alert>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:flex-1"
            aria-label="Buscar insumo por nombre"
          />
          {cats.length > 0 && (
            <Select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              aria-label="Filtrar por categoría"
              className="sm:w-56"
            >
              <option value="all">Todas las categorías</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">Sin categoría</option>
            </Select>
          )}
        </div>

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-muted">Aún no hay insumos en el catálogo.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 text-right font-medium">Stock</th>
                  <th className="px-2 py-2 text-right font-medium">Mín</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item) => (
                  <tr key={item.supplyId} className="text-ink">
                    <td className="px-2 py-2">{item.name}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBase(item.stockBase)} {item.baseUnit}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted">
                      {item.minQuantity === null
                        ? '—'
                        : `${formatBase(item.minQuantity)} ${item.baseUnit}`}
                    </td>
                    <td className="px-2 py-2">
                      <StockStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-sm text-muted">
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
