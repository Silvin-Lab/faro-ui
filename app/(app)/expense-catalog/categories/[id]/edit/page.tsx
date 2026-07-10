'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getExpenseCategory, updateExpenseCategory } from '@/lib/expenses';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

export default function EditExpenseCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [name, setName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExpenseCategory(id)
      .then((c) => {
        if (c) setName(c.name);
        else setError('No se pudo cargar la categoría');
      })
      .catch(() => setError('No se pudo cargar la categoría'));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateExpenseCategory(id, { name });
      router.push('/expense-catalog');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar');
      setSubmitting(false);
    }
  }

  if (error && name === null) {
    return (
      <Card>
        <p className="text-sm text-danger">{error}</p>
      </Card>
    );
  }
  if (name === null) {
    return (
      <Card>
        <p className="text-muted">Cargando…</p>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Editar categoría de gasto</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/expense-catalog')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
