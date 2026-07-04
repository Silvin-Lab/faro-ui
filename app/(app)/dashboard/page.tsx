'use client';

import { useUser } from '@/lib/user-context';
import { Card } from '@/components/ui/Card';

export default function DashboardPage() {
  const user = useUser();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Hola, {user.name}</h1>
      <Card>
        <p className="text-muted">
          Bienvenido a Faro.{' '}
          {user.isSuperAdmin
            ? 'Eres el administrador del negocio: gestiona catálogo, sucursales y usuarios desde el menú.'
            : 'Opera el punto de venta desde el menú lateral.'}
        </p>
      </Card>
    </div>
  );
}
