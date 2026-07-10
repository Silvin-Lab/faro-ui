'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import {
  createSupply,
  listSupplyCategories,
  type BaseUnit,
  type SupplyCategory,
} from '@/lib/supplies';
import { toCents } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SupplyCategorySelect } from '@/components/SupplyCategorySelect';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

export default function NewSupplyPage() {
  const router = useRouter();
  const me = useUser();
  const [form, setForm] = useState({
    name: '',
    baseUnit: 'g' as BaseUnit,
    packageName: '',
    packageContent: '',
    packageCost: '',
    categoryId: '',
  });
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    listSupplyCategories()
      .then((cats) =>
        setCategories(cats.filter((c) => c.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder)),
      )
      .catch(() => setCategories([]));
  }, [me.isSuperAdmin]);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los insumos.</p>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSupply({
        name: form.name,
        baseUnit: form.baseUnit,
        packageName: form.packageName,
        packageContent: Math.round(Number(form.packageContent)),
        packageCostCents: form.packageCost.trim() === '' ? null : toCents(form.packageCost),
        categoryId: form.categoryId || null,
      });
      router.push('/supplies');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear insumo');
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Nuevo insumo</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Categoría" htmlFor="categoryId">
          <SupplyCategorySelect
            id="categoryId"
            categories={categories}
            value={form.categoryId}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
            onCreated={(c) => setCategories((prev) => [...prev, c])}
          />
        </FormField>
        <FormField label="Unidad base" htmlFor="baseUnit">
          <select
            id="baseUnit"
            className={selectClass}
            value={form.baseUnit}
            onChange={(e) => setForm({ ...form, baseUnit: e.target.value as BaseUnit })}
          >
            <option value="g">g (gramos)</option>
            <option value="ml">ml (mililitros)</option>
            <option value="pieza">pieza</option>
          </select>
          <p className="mt-1 text-xs text-muted">
            Se define una vez y no se puede cambiar después.
          </p>
        </FormField>
        <FormField label="Nombre de la presentación" htmlFor="packageName">
          <Input
            id="packageName"
            placeholder="Ej. Bote 900 ml"
            value={form.packageName}
            onChange={(e) => setForm({ ...form, packageName: e.target.value })}
            required
          />
        </FormField>
        <FormField label={`Contenido de la presentación (${form.baseUnit})`} htmlFor="packageContent">
          <Input
            id="packageContent"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="Ej. 900"
            value={form.packageContent}
            onChange={(e) => setForm({ ...form, packageContent: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Costo de la presentación (pesos)" htmlFor="packageCost">
          <Input
            id="packageCost"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Ej. 85.00"
            value={form.packageCost}
            onChange={(e) => setForm({ ...form, packageCost: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted">Opcional. Déjalo vacío si no lo tienes.</p>
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting}>
            Crear insumo
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/supplies')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
