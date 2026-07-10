'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createExpenseConcept,
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

export default function NewExpenseConceptPage() {
  const router = useRouter();
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState({ name: '', categoryId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listExpenseCategories()
      .then((c) => setCats(c.filter((x) => x.status === 'active')))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createExpenseConcept({ name: form.name, categoryId: form.categoryId });
      router.push('/expense-catalog');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear concepto');
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-ink">Nuevo concepto de gasto</h1>
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
            <option value="" disabled>
              Selecciona una categoría…
            </option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={submitting} disabled={!form.categoryId}>
            Crear concepto
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/expense-catalog')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
