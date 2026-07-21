'use client';

import { useUser } from '@/lib/user-context';
import { Card } from '@/components/ui/Card';
import { SupplierForm } from '@/components/SupplierForm';

export default function NewSupplierPage() {
  const me = useUser();
  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }
  return <SupplierForm />;
}
