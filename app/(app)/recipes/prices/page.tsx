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

const NO_CAT = '__none__';
const MARGIN_KEY = 'recipes.prices.marginPct';
const DEFAULT_MARGIN = '200';

// Lee el % de ganancia recordado (localStorage). Degrada al default si no hay o falla.
function loadMargin(): string {
  try {
    return localStorage.getItem(MARGIN_KEY) ?? DEFAULT_MARGIN;
  } catch {
    return DEFAULT_MARGIN;
  }
}

export default function PricesPage() {
  const me = useUser();
  const [items, setItems] = useState<RecipeCost[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [marginStr, setMarginStr] = useState(DEFAULT_MARGIN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // El input de % se inicializa en cliente (evita desajuste de hidratación SSR).
  useEffect(() => {
    setMarginStr(loadMargin());
  }, []);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    listRecipeCosts()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar precios'))
      .finally(() => setLoading(false));
  }, [me.isSuperAdmin]);

  function onMarginChange(v: string) {
    setMarginStr(v);
    try {
      localStorage.setItem(MARGIN_KEY, v);
    } catch {
      /* sin persistencia: el valor sigue vivo en memoria */
    }
  }

  // % como número para el cálculo; vacío/no numérico → 0.
  const marginPct = useMemo(() => {
    const n = Number(marginStr.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [marginStr]);

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
        <p className="text-muted">Solo el administrador del negocio consulta los precios.</p>
      </Card>
    );
  }

  const thClass = 'whitespace-nowrap px-2 py-2 text-left font-medium text-muted';
  const tdClass = 'px-2 py-2 align-middle whitespace-nowrap';
  const dash = <span className="text-muted">—</span>;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Precios</h1>
        <Link href="/recipes" className="text-sm text-muted underline hover:text-ink">
          Volver al recetario
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Vista de referencia. No modifica ningún precio: el precio sugerido es orientativo.
      </p>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
          <div className="sm:w-48">
            <label htmlFor="margin" className="mb-1 block text-xs text-muted">
              % de ganancia general
            </label>
            <Input
              id="margin"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={marginStr}
              onChange={(e) => onMarginChange(e.target.value)}
              className="text-right tabular-nums"
            />
          </div>
        </div>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thClass}>Producto</th>
                  <th className={thClass}>Categoría</th>
                  <th className={`${thClass} text-right`}>Costo</th>
                  <th className={`${thClass} text-right`}>Precio sugerido</th>
                  <th className={`${thClass} text-right`}>Precio actual</th>
                  <th className={`${thClass} text-right`}>Ganancia bruta</th>
                  <th className={`${thClass} text-right`}>% ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((it) => {
                  const noRecipe = it.recipeLines === 0;
                  // "Sin costo" cuando no hay receta o el costo capturado es 0 (todos
                  // los insumos de la receta sin costo): no se puede derivar margen.
                  const hasCost = it.costCents > 0;
                  const suggestedCents = hasCost ? it.costCents * (1 + marginPct / 100) : null;
                  const grossCents = hasCost ? it.priceCents - it.costCents : null;
                  const marginRatio = hasCost ? (it.priceCents - it.costCents) / it.costCents : null;
                  return (
                    <tr key={it.id} className="hover:bg-bg">
                      <td className={tdClass}>
                        <Link
                          href={`/products/${it.id}/edit`}
                          className="font-medium text-ink hover:underline"
                        >
                          {it.name}
                        </Link>
                        {noRecipe && (
                          <span className="ml-2 rounded bg-bg px-2 py-0.5 text-xs text-muted">
                            Sin receta
                          </span>
                        )}
                        {!noRecipe && !hasCost && (
                          <span className="ml-2 rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">
                            Insumo sin costo
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-muted`}>{it.categoryName ?? 'sin categoría'}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {hasCost ? `$${toPesos(it.costCents)}` : dash}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {suggestedCents == null ? dash : `$${toPesos(suggestedCents)}`}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-ink`}>
                        ${toPesos(it.priceCents)}
                      </td>
                      <td
                        className={`${tdClass} text-right tabular-nums ${
                          grossCents != null && grossCents < 0 ? 'text-danger' : ''
                        }`}
                      >
                        {grossCents == null ? dash : `$${toPesos(grossCents)}`}
                      </td>
                      <td
                        className={`${tdClass} text-right tabular-nums ${
                          marginRatio != null && marginRatio < 0 ? 'text-danger' : ''
                        }`}
                      >
                        {marginRatio == null ? dash : `${(marginRatio * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-sm text-muted">
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
