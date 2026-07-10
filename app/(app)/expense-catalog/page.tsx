'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  listExpenseCategories,
  updateExpenseCategory,
  listExpenseConcepts,
  updateExpenseConcept,
  type ExpenseCategory,
  type ExpenseConcept,
} from '@/lib/expenses';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Tab = 'categories' | 'concepts';

const statusBadge = (status: 'active' | 'inactive') =>
  `rounded px-2 py-0.5 text-xs ${status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'}`;

export default function ExpenseCatalogPage() {
  const me = useUser();
  const [tab, setTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [concepts, setConcepts] = useState<ExpenseConcept[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [cats, cons] = await Promise.all([listExpenseCategories(), listExpenseConcepts()]);
      setCategories(cats);
      setConcepts(cons);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar el catálogo de gastos');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  async function toggleCategory(c: ExpenseCategory) {
    try {
      await updateExpenseCategory(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  async function toggleConcept(c: ExpenseConcept) {
    try {
      await updateExpenseConcept(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el catálogo de gastos.</p>
      </Card>
    );
  }

  const tabBtn = (active: boolean) =>
    `min-h-[40px] flex-1 rounded-lg px-3 py-1.5 text-sm font-medium sm:flex-none ${
      active ? 'bg-accent text-ink' : 'bg-bg text-muted'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">Catálogo de gastos</h1>
        <div className="flex gap-2">
          <button className={tabBtn(tab === 'categories')} onClick={() => setTab('categories')}>
            Categorías
          </button>
          <button className={tabBtn(tab === 'concepts')} onClick={() => setTab('concepts')}>
            Conceptos
          </button>
        </div>
      </div>

      {error && (
        <Card>
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      {tab === 'categories' ? (
        <div>
          <div className="mb-4 flex justify-end">
            <Link href="/expense-catalog/categories/new">
              <Button>Nueva categoría</Button>
            </Link>
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <span className="truncate">{c.name}</span>
                      <span className={statusBadge(c.status)}>{c.status}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link href={`/expense-catalog/categories/${c.id}/edit`}>
                      <Button variant="ghost">Editar</Button>
                    </Link>
                    <Button variant="outline" onClick={() => toggleCategory(c)}>
                      {c.status === 'active' ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </li>
              ))}
              {categories.length === 0 && (
                <li className="py-2 text-sm text-muted">Sin categorías de gasto todavía.</li>
              )}
            </ul>
          </Card>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <Link href="/expense-catalog/concepts/new">
              <Button>Nuevo concepto</Button>
            </Link>
          </div>
          <Card>
            <ul className="divide-y divide-line">
              {concepts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <span className="truncate">{c.name}</span>
                      <span className={statusBadge(c.status)}>{c.status}</span>
                    </div>
                    <div className="text-xs text-muted">{c.categoryName}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link href={`/expense-catalog/concepts/${c.id}/edit`}>
                      <Button variant="ghost">Editar</Button>
                    </Link>
                    <Button variant="outline" onClick={() => toggleConcept(c)}>
                      {c.status === 'active' ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </li>
              ))}
              {concepts.length === 0 && (
                <li className="py-2 text-sm text-muted">Sin conceptos de gasto todavía.</li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
