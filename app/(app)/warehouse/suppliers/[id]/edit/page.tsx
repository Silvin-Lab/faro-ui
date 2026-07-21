'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { getSupplier, type Supplier } from '@/lib/warehouse';
import { Card } from '@/components/ui/Card';
import { SupplierForm } from '@/components/SupplierForm';

export default function EditSupplierPage() {
  const me = useUser();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    getSupplier(id)
      .then((s) => {
        if (s) setSupplier(s);
        else setError('No se encontró el proveedor');
      })
      .catch(() => setError('No se pudo cargar el proveedor'));
  }, [id, me.isSuperAdmin]);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-danger">{error}</p>
      </Card>
    );
  }

  if (!supplier) {
    return (
      <Card>
        <p className="text-muted">Cargando…</p>
      </Card>
    );
  }

  return <SupplierForm initial={supplier} />;
}
