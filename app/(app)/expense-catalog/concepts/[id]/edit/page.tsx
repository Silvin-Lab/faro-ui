'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getExpenseConcept,
  updateExpenseConcept,
  listExpenseCategories,
  type ExpenseCategory,
} from '@/lib/expenses';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

type FormState = { name: string; categoryId: string };

export default function EditExpenseConceptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listExpenseCategories()
      .then((c) => setCats(c.filter((x) => x.status === 'active')))
      .catch(() => {});
    getExpenseConcept(id)
      .then((c) => {
        if (c) setForm({ name: c.name, categoryId: c.categoryId });
        else setError('No se pudo cargar el concepto');
      })
      .catch(() => setError('No se pudo cargar el concepto'));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateExpenseConcept(id, { name: form.name, categoryId: form.categoryId });
      router.push('/expense-catalog');
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

  // La categoría original puede estar inactiva: la añadimos al select para no perderla.
  const options =
    cats.some((c) => c.id === form.categoryId) || form.categoryId === ''
      ? cats
      : [...cats, { id: form.categoryId, name: '(categoría inactiva)', status: 'inactive' as const, sortOrder: 0 }];

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Editar concepto de gasto</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FormField>
        <FormField label="Categoría" htmlFor="categoryId">
          <select
            id="categoryId"
            className={selectClass}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
