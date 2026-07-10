'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupplyCategory } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

export default function NewSupplyCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSupplyCategory({ name });
      router.push('/supplies/categories');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear categoría');
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Nueva categoría de insumo</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting}>
            Crear categoría
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/supplies/categories')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
