'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  listSupplies,
  createSupply,
  updateSupply,
  deleteSupply,
  listSupplyCategories,
  ingredientLabel,
  unitCostCents,
  formatSmallMoney,
  type BaseUnit,
  type Supply,
  type SupplyCategory,
} from '@/lib/supplies';
import { toPesos, toCents } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent-strong';
const filterSelectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong sm:w-56';

// Campos editables en línea de una fila (strings, como el usuario los escribe).
type RowEdit = { name: string; packageContent: string; packageCost: string; categoryId: string };

function toRowEdit(s: Supply): RowEdit {
  return {
    name: s.name,
    packageContent: String(s.packageContent),
    packageCost: s.packageCostCents == null ? '' : toPesos(s.packageCostCents),
    categoryId: s.categoryId ?? '',
  };
}

// Costo por unidad en vivo (centavos, decimal) a partir de lo escrito en la fila.
function liveUnitCostCents(content: string, cost: string): number | null {
  const c = Number(content);
  if (!Number.isFinite(c) || c <= 0) return null;
  const costCents = cost.trim() === '' ? null : toCents(cost);
  if (costCents == null || !Number.isFinite(costCents)) return null;
  return costCents / c;
}

const EMPTY_NEW: { name: string; baseUnit: BaseUnit; packageContent: string; packageCost: string; categoryId: string } =
  { name: '', baseUnit: 'g', packageContent: '', packageCost: '', categoryId: '' };

export default function SuppliesPage() {
  const me = useUser();
  const [items, setItems] = useState<Supply[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [cats, setCats] = useState<SupplyCategory[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' | 'none' | categoryId
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fila de alta en línea.
  const [newRow, setNewRow] = useState(EMPTY_NEW);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await listSupplies();
      setItems(list);
      setEdits(Object.fromEntries(list.map((s) => [s.id, toRowEdit(s)])));
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
    listSupplyCategories()
      .then((c) => setCats([...c].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setCats([]));
  }, [me.isSuperAdmin]);

  const catName = (id: string | null) =>
    id ? (cats.find((c) => c.id === id)?.name ?? 'sin categoría') : 'sin categoría';

  function patchEdit(id: string, patch: Partial<RowEdit>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function isDirty(s: Supply): boolean {
    const e = edits[s.id];
    if (!e) return false;
    const base = toRowEdit(s);
    return (
      e.name.trim() !== base.name ||
      e.packageContent !== base.packageContent ||
      e.packageCost.trim() !== base.packageCost ||
      e.categoryId !== base.categoryId
    );
  }

  async function saveRow(s: Supply) {
    const e = edits[s.id];
    if (!e) return;
    const content = Number(e.packageContent);
    if (!e.name.trim() || !Number.isFinite(content) || content <= 0) {
      setError(`Revisa el nombre y la cantidad de "${s.name}".`);
      return;
    }
    setBusyId(s.id);
    setError(null);
    try {
      await updateSupply(s.id, {
        name: e.name.trim(),
        packageContent: Math.round(content),
        packageCostCents: e.packageCost.trim() === '' ? null : toCents(e.packageCost),
        categoryId: e.categoryId || null,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `No se pudo guardar "${s.name}".`);
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(s: Supply) {
    if (
      !window.confirm(
        `¿Eliminar el insumo "${s.name}"? Quedará inactivo y dejará de ofrecerse en recetas. Podrás reactivarlo después.`,
      )
    )
      return;
    setBusyId(s.id);
    try {
      await deleteSupply(s.id);
      await refresh();
    } catch {
      /* el insumo sigue activo; el usuario puede reintentar */
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(s: Supply) {
    setBusyId(s.id);
    try {
      await updateSupply(s.id, { status: 'active' });
      await refresh();
    } catch {
      /* noop */
    } finally {
      setBusyId(null);
    }
  }

  async function addRow() {
    const content = Number(newRow.packageContent);
    if (!newRow.name.trim()) {
      setAddError('Escribe el nombre del insumo.');
      return;
    }
    if (!Number.isFinite(content) || content <= 0) {
      setAddError('La cantidad comprada debe ser mayor a cero.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      // packageName se omite: el backend lo autogenera ("{contenido} {unidad}").
      await createSupply({
        name: newRow.name.trim(),
        baseUnit: newRow.baseUnit,
        packageContent: Math.round(content),
        packageCostCents: newRow.packageCost.trim() === '' ? null : toCents(newRow.packageCost),
        categoryId: newRow.categoryId || null,
      });
      setNewRow(EMPTY_NEW);
      await refresh();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'No se pudo crear el insumo.');
    } finally {
      setAdding(false);
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

  const thClass = 'whitespace-nowrap px-2 py-2 text-left font-medium text-muted';
  const tdClass = 'px-2 py-1.5 align-middle';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Insumos</h1>
        <Link href="/supplies/new">
          <Button variant="outline">Alta detallada</Button>
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Edita precio, cantidad o categoría directo en la tabla (Enter para guardar). Para medidas de
        uso usa <span className="text-ink">Editar</span>. Las recetas se definen en{' '}
        <Link href="/recipes" className="underline hover:text-ink">
          Recetario
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
            className={filterSelectClass}
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
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={thClass}>Producto</th>
                  <th className={thClass}>Unidad de compra</th>
                  <th className={thClass}>Cantidad comprada</th>
                  <th className={thClass}>Precio de compra ($)</th>
                  <th className={thClass}>Costo por unidad ($)</th>
                  <th className={thClass}>Ingrediente (unidad)</th>
                  <th className={thClass}>Categoría</th>
                  <th className={`${thClass} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((s) => {
                  const e = edits[s.id] ?? toRowEdit(s);
                  const dirty = isDirty(s);
                  const unit = liveUnitCostCents(e.packageContent, e.packageCost);
                  const inactive = s.status !== 'active';
                  return (
                    <tr key={s.id} className={inactive ? 'opacity-60' : undefined}>
                      <td className={`${tdClass} min-w-[9rem]`}>
                        <Input
                          value={e.name}
                          onChange={(ev) => patchEdit(s.id, { name: ev.target.value })}
                          onKeyDown={(ev) => ev.key === 'Enter' && saveRow(s)}
                          className="px-2 py-1.5"
                          aria-label={`Nombre de ${s.name}`}
                        />
                        {inactive && <span className="text-xs text-muted">Inactivo</span>}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{s.baseUnit}</td>
                      <td className={`${tdClass} w-28`}>
                        <Input
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="1"
                          value={e.packageContent}
                          onChange={(ev) => patchEdit(s.id, { packageContent: ev.target.value })}
                          onKeyDown={(ev) => ev.key === 'Enter' && saveRow(s)}
                          className="px-2 py-1.5 text-right tabular-nums"
                          aria-label={`Cantidad comprada de ${s.name}`}
                        />
                      </td>
                      <td className={`${tdClass} w-28`}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="—"
                          value={e.packageCost}
                          onChange={(ev) => patchEdit(s.id, { packageCost: ev.target.value })}
                          onKeyDown={(ev) => ev.key === 'Enter' && saveRow(s)}
                          className="px-2 py-1.5 text-right tabular-nums"
                          aria-label={`Precio de compra de ${s.name}`}
                        />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums text-ink`}>
                        {unit == null ? <span className="text-muted">—</span> : `$${formatSmallMoney(unit)}`}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>
                        {ingredientLabel({ name: e.name.trim() || s.name, baseUnit: s.baseUnit })}
                      </td>
                      <td className={`${tdClass} min-w-[8rem]`}>
                        <select
                          className={selectClass}
                          value={e.categoryId}
                          onChange={(ev) => patchEdit(s.id, { categoryId: ev.target.value })}
                          aria-label={`Categoría de ${s.name}`}
                        >
                          <option value="">Sin categoría</option>
                          {cats.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          {/* categoría inactiva ya asignada: conservar la opción */}
                          {e.categoryId !== '' && !cats.some((c) => c.id === e.categoryId) && (
                            <option value={e.categoryId}>{catName(e.categoryId)}</option>
                          )}
                        </select>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <div className="inline-flex items-center gap-1">
                          {dirty ? (
                            <>
                              <Button
                                variant="primary"
                                loading={busyId === s.id}
                                onClick={() => saveRow(s)}
                                className="px-2 py-1"
                              >
                                Guardar
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => patchEdit(s.id, toRowEdit(s))}
                                className="px-2 py-1"
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link href={`/supplies/${s.id}/edit`}>
                                <Button variant="ghost" className="px-2 py-1">
                                  Editar
                                </Button>
                              </Link>
                              {s.status === 'active' ? (
                                <Button
                                  variant="outline"
                                  loading={busyId === s.id}
                                  onClick={() => onDelete(s)}
                                  className="px-2 py-1"
                                >
                                  Eliminar
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  loading={busyId === s.id}
                                  onClick={() => reactivate(s)}
                                  className="px-2 py-1"
                                >
                                  Activar
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-3 text-sm text-muted">
                      Sin resultados.
                    </td>
                  </tr>
                )}

                {/* Fila de alta en línea */}
                <tr className="border-t-2 border-line bg-bg/40">
                  <td className={`${tdClass} min-w-[9rem]`}>
                    <Input
                      placeholder="+ Agregar insumo"
                      value={newRow.name}
                      onChange={(ev) => setNewRow({ ...newRow, name: ev.target.value })}
                      onKeyDown={(ev) => ev.key === 'Enter' && addRow()}
                      className="px-2 py-1.5"
                      aria-label="Nombre del nuevo insumo"
                    />
                  </td>
                  <td className={`${tdClass} w-28`}>
                    <select
                      className={selectClass}
                      value={newRow.baseUnit}
                      onChange={(ev) => setNewRow({ ...newRow, baseUnit: ev.target.value as BaseUnit })}
                      aria-label="Unidad de compra del nuevo insumo"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="pieza">pieza</option>
                    </select>
                  </td>
                  <td className={`${tdClass} w-28`}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      placeholder="Ej. 1000"
                      value={newRow.packageContent}
                      onChange={(ev) => setNewRow({ ...newRow, packageContent: ev.target.value })}
                      onKeyDown={(ev) => ev.key === 'Enter' && addRow()}
                      className="px-2 py-1.5 text-right tabular-nums"
                      aria-label="Cantidad comprada del nuevo insumo"
                    />
                  </td>
                  <td className={`${tdClass} w-28`}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="Ej. 85.00"
                      value={newRow.packageCost}
                      onChange={(ev) => setNewRow({ ...newRow, packageCost: ev.target.value })}
                      onKeyDown={(ev) => ev.key === 'Enter' && addRow()}
                      className="px-2 py-1.5 text-right tabular-nums"
                      aria-label="Precio de compra del nuevo insumo"
                    />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right tabular-nums text-ink`}>
                    {(() => {
                      const u = liveUnitCostCents(newRow.packageContent, newRow.packageCost);
                      return u == null ? <span className="text-muted">—</span> : `$${formatSmallMoney(u)}`;
                    })()}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-muted`}>
                    {newRow.name.trim()
                      ? ingredientLabel({ name: newRow.name.trim(), baseUnit: newRow.baseUnit })
                      : '—'}
                  </td>
                  <td className={`${tdClass} min-w-[8rem]`}>
                    <select
                      className={selectClass}
                      value={newRow.categoryId}
                      onChange={(ev) => setNewRow({ ...newRow, categoryId: ev.target.value })}
                      aria-label="Categoría del nuevo insumo"
                    >
                      <option value="">Sin categoría</option>
                      {cats
                        .filter((c) => c.status === 'active')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <Button loading={adding} onClick={addRow} className="px-2 py-1">
                      Agregar
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {addError && <p className="mt-2 text-sm text-danger">{addError}</p>}
      </Card>
    </div>
  );
}
