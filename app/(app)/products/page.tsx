'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listProducts, updateProduct, toPesos, type Product } from '@/lib/products';
import { imageSrc } from '@/lib/uploads';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ProductsPage() {
  const me = useUser();
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listProducts());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar productos');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  async function toggleStatus(p: Product) {
    try {
      await updateProduct(p.id, { status: p.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  const filtered = useMemo(
    () => items.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [items, q],
  );

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los productos.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Productos</h1>
        <Link href="/products/new">
          <Button>Nuevo producto</Button>
        </Link>
      </div>

      <Card>
        <Input
          placeholder="Buscar producto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-4"
        />
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <ul className="divide-y divide-line">
          {filtered.map((p) => {
            const src = imageSrc(p.imageUrl);
            return (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg text-[10px] text-muted">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    'Sin foto'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <span className="truncate">{p.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        p.status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    ${toPesos(p.priceCents)} · {p.categoryName ?? 'sin categoría'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/products/${p.id}/edit`}>
                    <Button variant="ghost">Editar</Button>
                  </Link>
                  <Button variant="outline" onClick={() => toggleStatus(p)}>
                    {p.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="py-2 text-sm text-muted">Sin resultados.</li>}
        </ul>
      </Card>
    </div>
  );
}
