'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProduct, updateProduct, toCents, toPesos } from '@/lib/products';
import { listCategories, type Category } from '@/lib/categories';
import { listSupplies, getRecipe, saveRecipe, type Supply } from '@/lib/supplies';
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
type RecipeRow = { supplyId: string; quantityBase: string };

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
        setRows(recipe.map((r) => ({ supplyId: r.supplyId, quantityBase: String(r.quantityBase) })));
      })
      .catch(() => setError('No se pudo cargar la receta'))
      .finally(() => setLoading(false));
  }, [productId]);

  // Insumos activos disponibles para elegir. Se conservan los ya seleccionados aunque
  // se hayan desactivado, para no perder una receta existente.
  const activeSupplies = supplies.filter((s) => s.status === 'active');

  function unitOf(supplyId: string): string {
    return supplies.find((s) => s.id === supplyId)?.baseUnit ?? '';
  }

  // Costo de una fila en centavos fraccionales (sin redondear):
  //   quantityBase × (packageCostCents / packageContent).
  // packageCostCents null/0 o packageContent no válido → $0 (decisión: asumir cero).
  function rowCostCents(row: RecipeRow): number {
    const sup = supplies.find((s) => s.id === row.supplyId);
    if (!sup) return 0;
    const cost = sup.packageCostCents ?? 0;
    const qty = Number(row.quantityBase);
    if (!cost || !sup.packageContent || !Number.isFinite(qty) || qty <= 0) return 0;
    return qty * (cost / sup.packageContent);
  }

  const totalCents = rows.reduce((sum, r) => sum + rowCostCents(r), 0);

  function addRow() {
    setSaved(false);
    setRows((r) => [...r, { supplyId: '', quantityBase: '' }]);
  }

  function removeRow(idx: number) {
    setSaved(false);
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<RecipeRow>) {
    setSaved(false);
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const items = rows
        .filter((r) => r.supplyId !== '' && Math.round(Number(r.quantityBase)) > 0)
        .map((r) => ({ supplyId: r.supplyId, quantityBase: Math.round(Number(r.quantityBase)) }));
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
          {rows.map((row, idx) => (
            <div key={idx}>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={`supply-${idx}`} className="mb-1 block text-xs text-muted">
                  Insumo
                </label>
                <select
                  id={`supply-${idx}`}
                  className={selectClass}
                  value={row.supplyId}
                  onChange={(e) => updateRow(idx, { supplyId: e.target.value })}
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
                      {supplies.find((s) => s.id === row.supplyId)?.name ?? 'Insumo'} (inactivo)
                    </option>
                  )}
                </select>
              </div>
              <div className="w-28 shrink-0">
                <label htmlFor={`qty-${idx}`} className="mb-1 block text-xs text-muted">
                  Cantidad{row.supplyId ? ` (${unitOf(row.supplyId)})` : ''}
                </label>
                <Input
                  id={`qty-${idx}`}
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  placeholder="Ej. 18"
                  value={row.quantityBase}
                  onChange={(e) => updateRow(idx, { quantityBase: e.target.value })}
                />
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
            {rowCostCents(row) > 0 && (
              <p className="mt-1 text-xs text-muted">≈ ${toPesos(rowCostCents(row))}</p>
            )}
            </div>
          ))}
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
