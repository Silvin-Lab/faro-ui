'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  listSupplyCategories,
  updateSupplyCategory,
  type SupplyCategory,
} from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const statusBadge = (status: 'active' | 'inactive') =>
  `rounded px-2 py-0.5 text-xs ${status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'}`;

export default function SupplyCategoriesPage() {
  const me = useUser();
  const [items, setItems] = useState<SupplyCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const cats = await listSupplyCategories();
      setItems([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar las categorías de insumo');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  async function toggleStatus(c: SupplyCategory) {
    try {
      await updateSupplyCategory(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona las categorías de insumo.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Categorías de insumo</h1>
        <Link href="/supplies/categories/new">
          <Button>Nueva categoría</Button>
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Clasifican los insumos del catálogo.{' '}
        <Link href="/supplies" className="underline hover:text-ink">
          Volver a Insumos
        </Link>
        .
      </p>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <span className="truncate">{c.name}</span>
                  <span className={statusBadge(c.status)}>{c.status}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link href={`/supplies/categories/${c.id}/edit`}>
                  <Button variant="ghost">Editar</Button>
                </Link>
                <Button variant="outline" onClick={() => toggleStatus(c)}>
                  {c.status === 'active' ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-2 text-sm text-muted">Sin categorías de insumo todavía.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
