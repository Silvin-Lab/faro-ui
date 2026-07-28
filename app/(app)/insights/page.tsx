'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser, useSession } from '@/lib/user-context';
import { listBranches, type Branch } from '@/lib/branches';
import { Card } from '@/components/ui/Card';
import { ReportFilters, INSIGHTS_PRESETS, type AppliedFilter } from '@/components/ReportFilters';
import type { InsightParams } from '@/lib/insights';
import { RecurrenceCard } from '@/components/insights/RecurrenceCard';
import { TopProductsCard } from '@/components/insights/TopProductsCard';
import { TicketSegmentsCard } from '@/components/insights/TicketSegmentsCard';
import { SecondVisitCard } from '@/components/insights/SecondVisitCard';
import { BasketAffinityCard } from '@/components/insights/BasketAffinityCard';
import { LoyaltyEffectCard } from '@/components/insights/LoyaltyEffectCard';

// M9 · Insights. Un selector compartido (rango + sucursal) gobierna las 6
// tarjetas; cada una carga de forma aislada (una que falla no tumba la página).
// Gating réplica de Reportes: super_admin (filtro libre) + branch_admin (acotado
// por el servidor, sin select); cashier/barista sin acceso. Sin IA/LLM: la UI
// solo formatea agregados deterministas del backend.
export default function InsightsPage() {
  const me = useUser();
  const session = useSession();
  const isSuperAdmin = me.role === 'super_admin';
  const isBranchAdmin = me.role === 'branch_admin';
  const canView = isSuperAdmin || isBranchAdmin;
  const activeBranchName =
    session.branches.find((b) => b.id === session.activeBranchId)?.name ?? 'Mi sucursal';

  const [branches, setBranches] = useState<Branch[]>([]);
  // Filtro aplicado que comparten las 6 tarjetas (branchId '' → undefined = todas).
  const [filter, setFilter] = useState<InsightParams | null>(null);

  useEffect(() => {
    if (isSuperAdmin) listBranches().then(setBranches).catch(() => {});
  }, [isSuperAdmin]);

  const handleApply = useCallback((f: AppliedFilter) => {
    setFilter({ from: f.from, to: f.to, branchId: f.branchId || undefined });
  }, []);

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a los insights.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ReportFilters
        presets={INSIGHTS_PRESETS}
        showBranchFilter={isSuperAdmin}
        branches={branches}
        onApply={handleApply}
        header={
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-ink">
              {isBranchAdmin ? `Insights · ${activeBranchName}` : 'Insights'}
            </h1>
            <p className="text-sm text-muted">
              Patrones de comportamiento de tus clientes. Agregación determinista, sin proyecciones.
            </p>
          </div>
        }
      />

      {/* Orden del PRD (1→6). Carga aislada por tarjeta. */}
      <div className="space-y-4">
        <RecurrenceCard filter={filter} />
        <TopProductsCard filter={filter} />
        <TicketSegmentsCard filter={filter} />
        <SecondVisitCard filter={filter} />
        <BasketAffinityCard filter={filter} />
        <LoyaltyEffectCard filter={filter} />
      </div>
    </div>
  );
}
