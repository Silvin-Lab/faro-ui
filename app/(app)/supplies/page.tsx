'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  listSupplies,
  updateSupply,
  listSupplyCategories,
  stockLabel,
  type Supply,
  type SupplyCategory,
} from '@/lib/supplies';
import { toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Mismos tokens que el <select> del formulario de insumo (design system).
const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong sm:w-56';

export default function SuppliesPage() {
  const me = useUser();
  const [items, setItems] = useState<Supply[]>([]);
  const [cats, setCats] = useState<SupplyCategory[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' | 'none' | categoryId
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setItems(await listSupplies());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar insumos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    void refresh();
    // Todas las categorías (incluidas inactivas): hay insumos que aún referencian
    // categorías desactivadas y deben poder filtrarse. Si falla, el filtro degrada
    // a "Todas" y la página sigue funcionando.
    listSupplyCategories()
      .then((c) => setCats([...c].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setCats([]));
  }, [me.isSuperAdmin]);

  async function toggleStatus(s: Supply) {
    try {
      await updateSupply(s.id, { status: s.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  const filtered = useMemo(
    () =>
      items.filter((s) => {
        const matchesName = s.name.toLowerCase().includes(q.trim().toLowerCase());
        const matchesCat =
          cat === 'all' || (cat === 'none' ? s.categoryId === null : s.categoryId === cat);
        return matchesName && matchesCat;
      }),
    [items, q, cat],
  );

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los insumos.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Insumos</h1>
        <Link href="/supplies/new">
          <Button>Nuevo insumo</Button>
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Las recetas (insumos por producto) se definen en{' '}
        <Link href="/products" className="underline hover:text-ink">
          Productos → editar producto
        </Link>
        .
      </p>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:flex-1"
            aria-label="Buscar insumo por nombre"
          />
          <select
            className={selectClass}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="all">Todas las categorías</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Sin categoría</option>
          </select>
        </div>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <span className="truncate font-medium">{s.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        s.status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'
                      }`}
                    >
                      {s.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {s.packageName} · {s.packageContent} {s.baseUnit}
                    {(s.packageCostCents ?? null) !== null &&
                      ` · $${toPesos(s.packageCostCents as number)}`}
                    {' · '}
                    {s.categoryName ?? 'sin categoría'}
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {(s.stock ?? []).length === 0 ? (
                      <li className="text-xs text-muted">Sin existencias registradas.</li>
                    ) : (
                      (s.stock ?? []).map((st) => (
                        <li key={st.branchId} className="text-xs text-muted">
                          <span className="text-ink">{st.branchName}:</span>{' '}
                          <span className="tabular-nums">{stockLabel(s, st.stockBase)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/supplies/${s.id}/edit`}>
                    <Button variant="ghost">Editar</Button>
                  </Link>
                  <Button variant="outline" onClick={() => toggleStatus(s)}>
                    {s.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            ))}
            {filtered.length === 0 && <li className="py-2 text-sm text-muted">Sin resultados.</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}
