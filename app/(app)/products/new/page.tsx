'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { createProduct, toCents, type FulfillmentType } from '@/lib/products';
import { listCategories, type Category } from '@/lib/categories';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { ImageUpload } from '@/components/ImageUpload';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

export default function NewProductPage() {
  const router = useRouter();
  const me = useUser();
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState<{
    name: string;
    price: string;
    categoryId: string;
    imageUrl: string;
    fulfillmentType: FulfillmentType;
  }>({ name: '', price: '', categoryId: '', imageUrl: '', fulfillmentType: 'branch_prepared' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategories()
      .then((c) => setCats(c.filter((x) => x.status === 'active')))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createProduct({
        name: form.name,
        priceCents: toCents(form.price),
        categoryId: form.categoryId || null,
        imageUrl: form.imageUrl || null,
        ...(me.isSuperAdmin && form.fulfillmentType !== 'branch_prepared'
          ? { fulfillmentType: form.fulfillmentType }
          : {}),
      });
      router.push('/products');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear producto');
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Nuevo producto</h1>
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
        {me.isSuperAdmin && (
          <FormField label="¿Cómo se surte?" htmlFor="fulfillmentType">
            <select
              id="fulfillmentType"
              className={selectClass}
              value={form.fulfillmentType}
              onChange={(e) =>
                setForm({ ...form, fulfillmentType: e.target.value as FulfillmentType })
              }
            >
              <option value="branch_prepared">Preparado en sucursal</option>
              <option value="bakery">De repostería central</option>
            </select>
            <p className="mt-1 text-xs text-muted">
              {form.fulfillmentType === 'bakery'
                ? 'El postre se produce en la central y se surte a las sucursales por pedido; su receta se consume al producir.'
                : 'El producto se prepara en la sucursal; su receta se descuenta del stock al vender.'}
            </p>
          </FormField>
        )}
        <FormField label="Imagen">
          <ImageUpload value={form.imageUrl || null} onChange={(url) => setForm({ ...form, imageUrl: url })} />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting}>
            Crear producto
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/products')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
