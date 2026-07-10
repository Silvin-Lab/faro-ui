'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listSupplies, updateSupply, stockLabel, type Supply } from '@/lib/supplies';
import { toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SuppliesPage() {
  const me = useUser();
  const [items, setItems] = useState<Supply[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setItems(await listSupplies());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar insumos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    void refresh();
  }, [me.isSuperAdmin]);

  async function toggleStatus(s: Supply) {
    try {
      await updateSupply(s.id, { status: s.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* noop */
    }
  }

  const filtered = useMemo(
    () => items.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())),
    [items, q],
  );

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los insumos.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Insumos</h1>
        <Link href="/supplies/new">
          <Button>Nuevo insumo</Button>
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Las recetas (insumos por producto) se definen en{' '}
        <Link href="/products" className="underline hover:text-ink">
          Productos → editar producto
        </Link>
        .
      </p>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar insumo por nombre"
          />
        </div>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <span className="truncate font-medium">{s.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        s.status === 'active' ? 'bg-accent text-ink' : 'bg-bg text-muted'
                      }`}
                    >
                      {s.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {s.packageName} · {s.packageContent} {s.baseUnit}
                    {(s.packageCostCents ?? null) !== null &&
                      ` · $${toPesos(s.packageCostCents as number)}`}
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {(s.stock ?? []).length === 0 ? (
                      <li className="text-xs text-muted">Sin existencias registradas.</li>
                    ) : (
                      (s.stock ?? []).map((st) => (
                        <li key={st.branchId} className="text-xs text-muted">
                          <span className="text-ink">{st.branchName}:</span>{' '}
                          <span className="tabular-nums">{stockLabel(s, st.stockBase)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/supplies/${s.id}/edit`}>
                    <Button variant="ghost">Editar</Button>
                  </Link>
                  <Button variant="outline" onClick={() => toggleStatus(s)}>
                    {s.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            ))}
            {filtered.length === 0 && <li className="py-2 text-sm text-muted">Sin resultados.</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}
