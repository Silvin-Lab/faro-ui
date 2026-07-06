'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listCategories, updateCategory, type Category } from '@/lib/categories';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/Avatar';

export default function CategoriesPage() {
  const me = useUser();
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listCategories());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar categorías');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  async function toggleStatus(c: Category) {
    try {
      await updateCategory(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona las categorías.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Categorías</h1>
        <Link href="/categories/new">
          <Button>Nueva categoría</Button>
        </Link>
      </div>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <Avatar name={c.name} imageUrl={c.imageUrl} className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <span className="truncate">{c.name}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      c.status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link href={`/categories/${c.id}/edit`}>
                  <Button variant="ghost">Editar</Button>
                </Link>
                <Button variant="outline" onClick={() => toggleStatus(c)}>
                  {c.status === 'active' ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="py-2 text-sm text-muted">Sin categorías todavía.</li>}
        </ul>
      </Card>
    </div>
  );
}
