'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listExpenseConcepts,
  listExpenses,
  createExpense,
  deleteExpense,
  type ExpenseConcept,
  type Expense,
} from '@/lib/expenses';
import { toPesos, toCents } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

// Rango [from, to) para HOY (medianoche local). Calcado de dayRange('today') en reports/page.tsx.
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ExpensesPage() {
  const [concepts, setConcepts] = useState<ExpenseConcept[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [conceptId, setConceptId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshExpenses = useCallback(async () => {
    setListError(null);
    try {
      setExpenses(await listExpenses(todayRange()));
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : 'Error al cargar los gastos de hoy');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // Solo conceptos activos para capturar.
      const conceptsP = listExpenseConcepts()
        .then((items) => items.filter((c) => c.status === 'active'))
        .catch(() => [] as ExpenseConcept[]);
      const [c] = await Promise.all([conceptsP, refreshExpenses()]);
      if (!active) return;
      setConcepts(c);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshExpenses]);

  // Conceptos agrupados por categoría para los <optgroup>.
  const grouped = useMemo(() => {
    const byCat = new Map<string, ExpenseConcept[]>();
    for (const c of concepts) {
      const arr = byCat.get(c.categoryName) ?? [];
      arr.push(c);
      byCat.set(c.categoryName, arr);
    }
    return [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [concepts]);

  const amountCents = toCents(amount);
  const canSubmit = conceptId !== '' && amountCents > 0 && !submitting;
  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createExpense({ conceptId, amountCents });
      setAmount('');
      setConceptId('');
      await refreshExpenses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar el gasto');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(exp: Expense) {
    if (!window.confirm(`¿Borrar el gasto "${exp.conceptName}" por $${toPesos(exp.amountCents)}?`)) return;
    setDeletingId(exp.id);
    try {
      await deleteExpense(exp.id);
      await refreshExpenses();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'No se pudo borrar el gasto');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Gastos</h1>

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <FormField label="Concepto" htmlFor="conceptId">
            <select
              id="conceptId"
              className={selectClass}
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecciona un concepto…
              </option>
              {grouped.map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label="Monto" htmlFor="amount">
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
          {concepts.length === 0 && !loading && (
            <p className="text-sm text-muted">No hay conceptos de gasto disponibles.</p>
          )}
          <Button type="submit" loading={submitting} disabled={!canSubmit} className="min-h-[44px]">
            Registrar
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Gastos de hoy</h2>
          <span className="shrink-0 text-sm text-muted">
            Total: <span className="font-semibold tabular-nums text-ink">${toPesos(totalCents)}</span>
          </span>
        </div>
        {listError && <p className="mb-2 text-sm text-danger">{listError}</p>}
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted">Sin gastos hoy.</p>
        ) : (
          <ul className="divide-y divide-line">
            {expenses.map((exp) => (
              <li key={exp.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{exp.conceptName}</div>
                  <div className="text-xs text-muted">
                    {hourLabel(exp.createdAt)} · {exp.createdByName}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                  ${toPesos(exp.amountCents)}
                </span>
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => onDelete(exp)}
                  loading={deletingId === exp.id}
                  aria-label={`Borrar gasto ${exp.conceptName}`}
                >
                  Borrar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
