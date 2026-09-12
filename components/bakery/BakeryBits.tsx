import { Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ageDays, type BakeryOrderStatus } from '@/lib/bakery';

// Piezas de presentación del módulo Repostería (design-system §M10). Solo
// formato; ningún cálculo de negocio (lo hace el backend). Tokens del sistema.

// --- §M10.3 Badge de estado del pedido -------------------------------------
// pending→muted · in_production→accent · shipped→success · received→success(+✓)
// · cancelled→danger.
const STATUS_LABEL: Record<BakeryOrderStatus, string> = {
  pending: 'Pendiente',
  in_production: 'En producción',
  shipped: 'Surtido',
  received: 'Recibido ✓',
  cancelled: 'Cancelado',
};

const STATUS_VARIANT: Record<BakeryOrderStatus, 'muted' | 'accent' | 'success' | 'danger'> = {
  pending: 'muted',
  in_production: 'accent',
  shipped: 'success',
  received: 'success',
  cancelled: 'danger',
};

export function OrderStatusBadge({ status }: { status: BakeryOrderStatus }) {
  return <StatusBadge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</StatusBadge>;
}

// --- §M10.2 Indicador de antigüedad (aging) --------------------------------
// Reloj + "N días" en tono atención (no Alert). El caller decide cuándo mostrarlo
// (helper isAging). Informativo: prioriza sin gritar error.
export function AgingIndicator({ createdAt }: { createdAt: string }) {
  const days = ageDays(createdAt);
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-danger"
      title={`Pedido hace ${days} ${days === 1 ? 'día' : 'días'} sin surtir por completo`}
    >
      <Clock size={14} strokeWidth={2} className="shrink-0" aria-hidden />
      <span className="tabular-nums">
        {days} {days === 1 ? 'día' : 'días'}
      </span>
    </span>
  );
}

// --- §M10.1 Progreso de surtido (n/m + barra) ------------------------------
// Texto despachado/pedido (tabular-nums) + barra proporcional. Estado 0 = barra
// vacía. aria-label descriptivo ("3 de 10 surtidos").
export function ShipmentProgress({ shipped, ordered }: { shipped: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(100, Math.max(0, (shipped / ordered) * 100)) : 0;
  return (
    <div className="min-w-[7rem]">
      <div className="tabular-nums text-ink">
        {shipped}/{ordered}
      </div>
      <div
        className="mt-1 h-2 rounded bg-bg"
        role="img"
        aria-label={`${shipped} de ${ordered} surtidos`}
      >
        <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
