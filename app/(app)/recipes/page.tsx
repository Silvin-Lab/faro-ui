'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listRecipeCosts, type RecipeCost } from '@/lib/supplies';
import { toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const filterSelectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong sm:w-56';

// Valor del filtro de categoría cuando el producto no tiene categoría.
const NO_CAT = '__none__';

export default function RecipesPage() {
  const me = useUser();
  const [items, setItems] = useState<RecipeCost[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    listRecipeCosts()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar recetas'))
      .finally(() => setLoading(false));
  }, [me.isSuperAdmin]);

  // Categorías presentes (para el filtro), ordenadas alfabéticamente.
  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const it of items) if (it.categoryName) names.add(it.categoryName);
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        const matchesName = it.name.toLowerCase().includes(q.trim().toLowerCase());
        const matchesCat =
          cat === 'all' ||
          (cat === NO_CAT ? it.categoryName === null : it.categoryName === cat);
        return matchesName && matchesCat;
      }),
    [items, q, cat],
  );

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el recetario.</p>
      </Card>
    );
  }

  const thClass = 'whitespace-nowrap px-2 py-2 text-left font-medium text-muted';
  const tdClass = 'px-2 py-2 align-middle';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Recetario</h1>
        <Link href="/recipes/prices" className="text-sm text-muted underline hover:text-ink">
          Ver precios
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Costo de cada producto según su receta. Toca una fila para editar la receta.
      </p>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:flex-1"
            aria-label="Buscar producto por nombre"
          />
          <select
            className={filterSelectClass}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NO_CAT}>Sin categoría</option>
          </select>
        </div>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thClass}>Producto</th>
                  <th className={thClass}>Categoría</th>
                  <th className={`${thClass} text-right`}>Ingredientes</th>
                  <th className={`${thClass} text-right`}>Costo de receta</th>
                  <th className={thClass}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((it) => {
                  const noRecipe = it.recipeLines === 0;
                  const missing = it.missingCostSupplies > 0;
                  return (
                    <tr key={it.id} className="hover:bg-bg">
                      <td className={tdClass}>
                        <Link
                          href={`/products/${it.id}/edit`}
                          className="font-medium text-ink hover:underline"
                        >
                          {it.name}
                        </Link>
                      </td>
                      <td className={`${tdClass} text-muted`}>{it.categoryName ?? 'sin categoría'}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{it.recipeLines}</td>
                      <td className={`${tdClass} text-right tabular-nums text-ink`}>
                        {noRecipe ? <span className="text-muted">—</span> : `$${toPesos(it.costCents)}`}
                      </td>
                      <td className={tdClass}>
                        {noRecipe ? (
                          <span className="rounded bg-bg px-2 py-0.5 text-xs text-muted">Sin receta</span>
                        ) : missing ? (
                          <span className="rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">
                            Insumo sin costo
                          </span>
                        ) : (
                          <span className="rounded bg-accent px-2 py-0.5 text-xs text-ink">Completa</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-sm text-muted">
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
