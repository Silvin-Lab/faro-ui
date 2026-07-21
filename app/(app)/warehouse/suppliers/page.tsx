'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listSuppliers, updateSupplier, type Supplier } from '@/lib/warehouse';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function SuppliersPage() {
  const me = useUser();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listSuppliers());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    void refresh();
  }, [me.isSuperAdmin]);

  async function toggleStatus(s: Supplier) {
    setTogglingId(s.id);
    try {
      await updateSupplier(s.id, { status: s.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch {
      /* si falla, el estado no cambia; el usuario puede reintentar */
    } finally {
      setTogglingId(null);
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Proveedores</h1>
        <Link href="/warehouse/suppliers/new">
          <Button>Nuevo proveedor</Button>
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">Para seleccionarlos al registrar una compra.</p>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-muted">Aún no hay proveedores.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.status === 'inactive' && (
                      <span className="rounded px-2 py-0.5 text-xs bg-bg text-muted">Inactivo</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {[s.phone, s.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/warehouse/suppliers/${s.id}/edit`}>
                    <Button variant="ghost">Editar</Button>
                  </Link>
                  <Button
                    variant="outline"
                    loading={togglingId === s.id}
                    onClick={() => toggleStatus(s)}
                  >
                    {s.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
