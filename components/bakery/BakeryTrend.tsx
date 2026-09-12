'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { getBakeryTrend, type BakeryTrendInsight, type BakeryTrendItem } from '@/lib/insights';
import { listBranches, type Branch } from '@/lib/branches';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Bloque reutilizable "Tendencia de venta de postres" (wireframes P5, F18/F19).
// Un componente, dos hosts: página /bakery/trend (repostero) y sección en
// /insights (super_admin/branch_admin). El filtro de sucursal es visible solo
// para quien puede elegir (repostero/super_admin); branch_admin lo acota el
// servidor. Compara semana en curso vs. anterior (ventanas fijas del backend).

// dd/mm corto para el subtítulo de rango de semana.
function shortRange(from: string, to: string): string {
  const f = new Date(from);
  // `to` es exclusivo (fin de ventana); mostrar el último día incluido.
  const t = new Date(new Date(to).getTime() - 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(f.getDate())}/${p(f.getMonth() + 1)} – ${p(t.getDate())}/${p(t.getMonth() + 1)}`;
}

// Celda de variación (§M10.4): ▲/▼/=/nuevo con Δ absoluto y %.
function VariationCell({ item }: { item: BakeryTrendItem }) {
  const { deltaUnits, deltaPct, unitsPrevious } = item;
  const isNew = unitsPrevious === 0 && deltaUnits > 0;
  const pctText = deltaPct === null ? null : `${deltaPct > 0 ? '+' : ''}${Math.round(deltaPct)}%`;

  if (isNew) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="tabular-nums text-success">▲ nuevo</span>
        <StatusBadge variant="accent">Nuevo</StatusBadge>
      </span>
    );
  }
  if (deltaUnits === 0) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="tabular-nums text-muted">= 0 u</span>
        <StatusBadge variant="muted">Igual</StatusBadge>
      </span>
    );
  }
  const up = deltaUnits > 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
        {up ? '▲' : '▼'} {up ? '+' : '−'}
        {Math.abs(deltaUnits)} u{pctText ? ` (${pctText})` : ''}
      </span>
      <StatusBadge variant={up ? 'success' : 'danger'}>{up ? 'Subió' : 'Bajó'}</StatusBadge>
    </span>
  );
}

export function BakeryTrend({
  showBranchFilter,
  showHeader = true,
}: {
  showBranchFilter: boolean;
  showHeader?: boolean;
}) {
  const [branchId, setBranchId] = useState(''); // '' = todas
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<BakeryTrendInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showBranchFilter) listBranches(true).then(setBranches).catch(() => {});
  }, [showBranchFilter]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBakeryTrend(branchId || undefined)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar la tendencia'))
      .finally(() => setLoading(false));
  }, [branchId]);

  // Titular llano: los 1–2 que más subieron (items vienen ordenados por Δ desc).
  const headline = useMemo(() => {
    if (!data) return null;
    const up = data.items.filter((i) => i.deltaUnits > 0).slice(0, 2);
    if (up.length === 0) return null;
    return `Más subieron: ${up.map((i) => `${i.productName} (+${i.deltaUnits} u)`).join(', ')}.`;
  }, [data]);

  const rangeSub =
    data &&
    `Sem. actual (${shortRange(data.weekCurrent.from, data.weekCurrent.to)}) vs. anterior (${shortRange(
      data.weekPrevious.from,
      data.weekPrevious.to,
    )}).`;

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tendencia de venta de postres</h1>
          <p className="mt-1 text-sm text-muted">
            {rangeSub ?? 'Compara la venta de postres de la semana en curso vs. la anterior.'}
          </p>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!showHeader && (
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Tendencia de venta de postres</h2>
              {rangeSub && <p className="text-xs text-muted">{rangeSub}</p>}
            </div>
          )}
          {/* El filtro de sucursal solo aparece si se pudo cargar la lista de
              sucursales. Para repostero, GET /branches es 403 y la respuesta de
              tendencia no trae dimensión de sucursal, así que ve "Todas". */}
          {showBranchFilter && branches.length > 0 && (
            <Select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Filtrar por sucursal"
              className="sm:w-56"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted">Sin ventas de postres en las últimas dos semanas.</p>
        ) : (
          <>
            {headline && <p className="mb-3 text-sm text-ink">{headline}</p>}
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Postre</th>
                    <th className="px-2 py-2 text-right font-medium">Sem. pasada</th>
                    <th className="px-2 py-2 text-right font-medium">Esta sem.</th>
                    <th className="px-2 py-2 font-medium">Variación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((it) => (
                    <tr key={it.productName} className="text-ink">
                      <td className="px-2 py-2">{it.productName}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{it.unitsPrevious} u</td>
                      <td className="px-2 py-2 text-right tabular-nums">{it.unitsCurrent} u</td>
                      <td className="px-2 py-2">
                        <VariationCell item={it} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="mt-3 text-xs text-muted">
          Compara ventas de la semana en curso vs. la anterior. Histórico, sin predicción.
        </p>
      </Card>
    </div>
  );
}
