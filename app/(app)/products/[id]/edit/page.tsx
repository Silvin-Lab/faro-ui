'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProduct, updateProduct, toCents, toPesos } from '@/lib/products';
import { listCategories, type Category } from '@/lib/categories';
import {
  listSupplies,
  getRecipe,
  saveRecipe,
  formatBase,
  formatQuantityBase,
  ingredientLabel,
  unitCostCents,
  formatSmallMoney,
  round3,
  parseDecimalInput,
  decimalPlaces,
  type Supply,
  type RecipeItemInput,
} from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { ImageUpload } from '@/components/ImageUpload';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

type FormState = { name: string; price: string; categoryId: string; imageUrl: string };

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProduct(id), listCategories()])
      .then(([p, c]) => {
        setForm({
          name: p.name,
          price: toPesos(p.priceCents),
          categoryId: p.categoryId ?? '',
          imageUrl: p.imageUrl ?? '',
        });
        setCats(c.filter((x) => x.status === 'active'));
      })
      .catch(() => setError('No se pudo cargar el producto'));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateProduct(id, {
        name: form.name,
        priceCents: toCents(form.price),
        categoryId: form.categoryId || null,
        imageUrl: form.imageUrl || null,
      });
      router.push('/products');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar');
      setSubmitting(false);
    }
  }

  if (error && !form) {
    return (
      <Card>
        <p className="text-sm text-danger">{error}</p>
      </Card>
    );
  }
  if (!form) {
    return (
      <Card>
        <p className="text-muted">Cargando…</p>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
    <Card>
      <h1 className="mb-4 text-xl font-semibold text-ink">Editar producto</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FormField>
        <FormField label="Precio" htmlFor="price">
          <Input
            id="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Categoría" htmlFor="categoryId">
          <select
            id="categoryId"
            className={selectClass}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">Sin categoría</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Imagen">
          <ImageUpload value={form.imageUrl || null} onChange={(url) => setForm({ ...form, imageUrl: url })} />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/products')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>

    <RecipeSection productId={id} />
    </div>
  );
}

// --- Sección "Receta" ---
// Insumos que consume el producto vendible (receta global). Guarda con PUT replace-all,
// con su propio botón: no se mezcla con el submit del producto. Solo existe en el editor
// (products/new no tiene id todavía).
//
// Cada línea puede capturarse en la unidad base del insumo (g/ml/pieza) o por una
// "medida de uso" del insumo (ej. "1 scoop" = 25 g). `measureId === ''` significa
// unidad base; en ese caso `quantity` es la cantidad base. Si hay medida, `quantity`
// es el número de medidas (admite fraccionales) y la cantidad base se computa local
// como round(count × baseQuantity) para el preview y el costo en vivo.
type RecipeRow = { supplyId: string; measureId: string; quantity: string };

function RecipeSection({ productId }: { productId: string }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([listSupplies(), getRecipe(productId)])
      .then(([sup, recipe]) => {
        setSupplies(sup);
        setRows(
          recipe.map((r) =>
            r.measureId
              ? { supplyId: r.supplyId, measureId: r.measureId, quantity: String(r.measureCount ?? '') }
              : { supplyId: r.supplyId, measureId: '', quantity: String(r.quantityBase) },
          ),
        );
      })
      .catch(() => setError('No se pudo cargar la receta'))
      .finally(() => setLoading(false));
  }, [productId]);

  // Insumos activos disponibles para elegir. Se conservan los ya seleccionados aunque
  // se hayan desactivado, para no perder una receta existente.
  const activeSupplies = supplies.filter((s) => s.status === 'active');

  const supplyOf = (id: string) => supplies.find((s) => s.id === id);

  // Cantidad en unidad base de una fila (fuente de verdad del descuento y del costo).
  // Admite decimales (≤3). Por medida: round3(count × baseQuantity). En unidad
  // base: la cantidad capturada, redondeada a 3 decimales.
  function rowQuantityBase(row: RecipeRow): number {
    const sup = supplyOf(row.supplyId);
    const qty = parseDecimalInput(row.quantity);
    if (!sup || !Number.isFinite(qty) || qty <= 0) return 0;
    if (row.measureId) {
      const m = sup.measures.find((x) => x.id === row.measureId);
      if (!m) return 0;
      return round3(qty * m.baseQuantity);
    }
    return round3(qty);
  }

  // Costo de una fila en centavos fraccionales (sin redondear):
  //   quantityBase × (packageCostCents / packageContent).
  // Insumo sin costo capturado → null (la línea no suma y se marca).
  function rowCostCents(row: RecipeRow): number | null {
    const sup = supplyOf(row.supplyId);
    if (!sup) return null;
    const unit = unitCostCents(sup);
    const qb = rowQuantityBase(row);
    if (unit == null || qb <= 0) return null;
    return qb * unit;
  }

  const totalCents = rows.reduce((sum, r) => sum + (rowCostCents(r) ?? 0), 0);
  // Insumos con cantidad válida pero sin costo capturado (no suman al total).
  const missingCost = rows.some((r) => {
    const sup = supplyOf(r.supplyId);
    return sup != null && rowQuantityBase(r) > 0 && unitCostCents(sup) == null;
  });

  function addRow() {
    setSaved(false);
    setRows((r) => [...r, { supplyId: '', measureId: '', quantity: '' }]);
  }

  function removeRow(idx: number) {
    setSaved(false);
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<RecipeRow>) {
    setSaved(false);
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  // Al cambiar de insumo, se reinicia la unidad a base y la cantidad: las medidas
  // pertenecen al insumo, así que la selección previa deja de tener sentido.
  function changeSupply(idx: number, supplyId: string) {
    updateRow(idx, { supplyId, measureId: '', quantity: '' });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const usable = rows.filter((r) => r.supplyId !== '' && rowQuantityBase(r) > 0);
      // Validación local: las cantidades admiten hasta 3 decimales (coma o punto).
      if (usable.some((r) => decimalPlaces(r.quantity) > 3)) {
        setError('Las cantidades admiten hasta 3 decimales.');
        setSaving(false);
        return;
      }
      const items: RecipeItemInput[] = usable.map((r) =>
        r.measureId
          ? { supplyId: r.supplyId, measureId: r.measureId, measureCount: parseDecimalInput(r.quantity) }
          : { supplyId: r.supplyId, quantityBase: round3(parseDecimalInput(r.quantity)) },
      );
      await saveRecipe(productId, items);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-ink">Receta</h2>
      <p className="mb-3 text-xs text-muted">
        Insumos que consume una unidad de este producto. Definen el costo de la receta (se usa en
        Recetario y Precios). Las cantidades admiten decimales (coma o punto), hasta 3.
      </p>
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Sin insumos en la receta.</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-2 py-2 text-left font-medium text-muted">Ingrediente</th>
                    <th className="whitespace-nowrap px-2 py-2 text-left font-medium text-muted">
                      Cantidad
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-muted">
                      Precio unitario
                    </th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium text-muted">
                      Costo
                    </th>
                    <th className="px-2 py-2" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row, idx) => {
                    const sup = supplyOf(row.supplyId);
                    const measures = sup?.measures ?? [];
                    const measure = row.measureId
                      ? measures.find((m) => m.id === row.measureId)
                      : undefined;
                    const qb = rowQuantityBase(row);
                    const cost = rowCostCents(row);
                    const unit = sup ? unitCostCents(sup) : null;
                    return (
                      <tr key={idx} className="align-top">
                        {/* Ingrediente */}
                        <td className="px-2 py-2 min-w-[11rem]">
                          <select
                            id={`supply-${idx}`}
                            aria-label="Insumo"
                            className={selectClass}
                            value={row.supplyId}
                            onChange={(e) => changeSupply(idx, e.target.value)}
                          >
                            <option value="">Selecciona un insumo…</option>
                            {activeSupplies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {ingredientLabel(s)}
                              </option>
                            ))}
                            {/* Insumo ya en la receta pero inactivo: conservar la opción. */}
                            {row.supplyId !== '' &&
                              !activeSupplies.some((s) => s.id === row.supplyId) && (
                                <option value={row.supplyId}>
                                  {sup ? `${ingredientLabel(sup)} (inactivo)` : 'Insumo (inactivo)'}
                                </option>
                              )}
                          </select>
                        </td>
                        {/* Cantidad (+ medida compacta si el insumo tiene medidas) */}
                        <td className="px-2 py-2">
                          {row.supplyId === '' ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Input
                                id={`qty-${idx}`}
                                type="text"
                                inputMode="decimal"
                                placeholder={measure ? 'Ej. 1.5' : 'Ej. 0.8'}
                                value={row.quantity}
                                onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                                className="w-20 px-2 py-1.5 text-right tabular-nums"
                                aria-label="Cantidad"
                              />
                              {measures.length > 0 ? (
                                <select
                                  id={`unit-${idx}`}
                                  aria-label="Unidad o medida"
                                  className={`${selectClass} w-auto min-w-[6rem] px-2 py-1.5`}
                                  value={row.measureId}
                                  onChange={(e) => updateRow(idx, { measureId: e.target.value })}
                                >
                                  <option value="">{sup?.baseUnit}</option>
                                  {measures.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({formatBase(m.baseQuantity)} {sup?.baseUnit})
                                    </option>
                                  ))}
                                  {/* Medida ya usada pero ausente (borrada): conservar la opción. */}
                                  {row.measureId !== '' &&
                                    !measures.some((m) => m.id === row.measureId) && (
                                      <option value={row.measureId}>Medida eliminada</option>
                                    )}
                                </select>
                              ) : (
                                <span className="text-xs text-muted">{sup?.baseUnit}</span>
                              )}
                            </div>
                          )}
                          {measure && qb > 0 && (
                            <p className="mt-1 text-xs text-muted">
                              = {formatQuantityBase(qb)} {sup?.baseUnit}
                            </p>
                          )}
                        </td>
                        {/* Precio unitario */}
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {row.supplyId === '' ? (
                            <span className="text-muted">—</span>
                          ) : unit == null ? (
                            <span className="text-danger">Sin costo</span>
                          ) : (
                            <span className="text-muted">
                              ${formatSmallMoney(unit)}/{sup?.baseUnit}
                            </span>
                          )}
                        </td>
                        {/* Costo de línea */}
                        <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums text-ink">
                          {cost == null ? <span className="text-muted">—</span> : `$${toPesos(cost)}`}
                        </td>
                        {/* Quitar */}
                        <td className="px-2 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 py-1"
                            onClick={() => removeRow(idx)}
                            aria-label="Quitar insumo de la receta"
                          >
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td className="px-2 py-2 text-sm text-muted" colSpan={3}>
                      Costo de la receta
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-sm font-semibold tabular-nums text-ink">
                      ${toPesos(totalCents)}
                    </td>
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {missingCost && (
            <p className="text-xs text-danger">
              Hay insumos sin costo capturado: el total es parcial.
            </p>
          )}
          <Button type="button" variant="outline" onClick={addRow}>
            Agregar insumo
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
          {saved && <p className="text-sm text-muted">Receta guardada.</p>}
          <div>
            <Button type="button" onClick={onSave} loading={saving}>
              Guardar receta
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
