'use client';

import { useUser } from '@/lib/user-context';
import { Card } from '@/components/ui/Card';
import { BakeryTrend } from '@/components/bakery/BakeryTrend';

// Tendencia de venta de postres — landing secundaria del repostero (F18).
// super_admin la ve además dentro de /insights; branch_admin solo en /insights.
export default function BakeryTrendPage() {
  const me = useUser();
  const canView = me.role === 'repostero' || me.role === 'super_admin';

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a la tendencia de postres.</p>
      </Card>
    );
  }

  // Repostero y super_admin ven todas las sucursales, con filtro.
  return <BakeryTrend showBranchFilter />;
}
