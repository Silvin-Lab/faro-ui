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
    <div className="max-w-lg space-y-4">
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
  // Por medida: round(count × baseQuantity). En unidad base: la cantidad capturada.
  function rowQuantityBase(row: RecipeRow): number {
    const sup = supplyOf(row.supplyId);
    const qty = Number(row.quantity);
    if (!sup || !Number.isFinite(qty) || qty <= 0) return 0;
    if (row.measureId) {
      const m = sup.measures.find((x) => x.id === row.measureId);
      if (!m) return 0;
      return Math.round(qty * m.baseQuantity);
    }
    return Math.round(qty);
  }

  // Costo de una fila en centavos fraccionales (sin redondear):
  //   quantityBase × (packageCostCents / packageContent).
  // packageCostCents null/0 o packageContent no válido → $0 (decisión: asumir cero).
  function rowCostCents(row: RecipeRow): number {
    const sup = supplyOf(row.supplyId);
    if (!sup) return 0;
    const cost = sup.packageCostCents ?? 0;
    const qb = rowQuantityBase(row);
    if (!cost || !sup.packageContent || qb <= 0) return 0;
    return qb * (cost / sup.packageContent);
  }

  const totalCents = rows.reduce((sum, r) => sum + rowCostCents(r), 0);

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
      const items: RecipeItemInput[] = rows
        .filter((r) => r.supplyId !== '' && rowQuantityBase(r) > 0)
        .map((r) =>
          r.measureId
            ? { supplyId: r.supplyId, measureId: r.measureId, measureCount: Number(r.quantity) }
            : { supplyId: r.supplyId, quantityBase: Math.round(Number(r.quantity)) },
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
        Insumos que consume una unidad de este producto. Se descuentan del stock al vender.
      </p>
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-muted">Sin insumos en la receta.</p>}
          {rows.map((row, idx) => {
            const sup = supplyOf(row.supplyId);
            const measures = sup?.measures ?? [];
            const measure = row.measureId ? measures.find((m) => m.id === row.measureId) : undefined;
            const qtyUnitLabel = measure ? measure.name : sup?.baseUnit ?? '';
            const qb = rowQuantityBase(row);
            const cost = rowCostCents(row);
            return (
              <div key={idx} className="rounded-md border border-line p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`supply-${idx}`} className="mb-1 block text-xs text-muted">
                      Insumo
                    </label>
                    <select
                      id={`supply-${idx}`}
                      className={selectClass}
                      value={row.supplyId}
                      onChange={(e) => changeSupply(idx, e.target.value)}
                    >
                      <option value="">Selecciona un insumo…</option>
                      {activeSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      {/* Insumo ya en la receta pero inactivo: conservar la opción. */}
                      {row.supplyId !== '' && !activeSupplies.some((s) => s.id === row.supplyId) && (
                        <option value={row.supplyId}>
                          {sup?.name ?? 'Insumo'} (inactivo)
                        </option>
                      )}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => removeRow(idx)}
                    aria-label="Quitar insumo de la receta"
                  >
                    Quitar
                  </Button>
                </div>

                {row.supplyId !== '' && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {measures.length > 0 && (
                      <div className="w-40 shrink-0">
                        <label htmlFor={`unit-${idx}`} className="mb-1 block text-xs text-muted">
                          Unidad
                        </label>
                        <select
                          id={`unit-${idx}`}
                          className={selectClass}
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
                          {row.measureId !== '' && !measures.some((m) => m.id === row.measureId) && (
                            <option value={row.measureId}>Medida eliminada</option>
                          )}
                        </select>
                      </div>
                    )}
                    <div className="w-28 shrink-0">
                      <label htmlFor={`qty-${idx}`} className="mb-1 block text-xs text-muted">
                        Cantidad{qtyUnitLabel ? ` (${qtyUnitLabel})` : ''}
                      </label>
                      <Input
                        id={`qty-${idx}`}
                        type="number"
                        inputMode={measure ? 'decimal' : 'numeric'}
                        step={measure ? 'any' : '1'}
                        min={measure ? '0' : '1'}
                        placeholder={measure ? 'Ej. 1.5' : 'Ej. 18'}
                        value={row.quantity}
                        onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                      />
                    </div>
                    {measure && qb > 0 && (
                      <p className="pb-2 text-xs text-muted">
                        = {formatBase(qb)} {sup?.baseUnit}
                      </p>
                    )}
                  </div>
                )}

                {cost > 0 && <p className="mt-2 text-xs text-muted">≈ ${toPesos(cost)}</p>}
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addRow}>
            Agregar insumo
          </Button>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">Costo de la receta</span>
            <span className="text-sm font-semibold text-ink">${toPesos(totalCents)}</span>
          </div>
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
