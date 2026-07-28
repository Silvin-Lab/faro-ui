'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useUser, useSession } from '@/lib/user-context';
import {
  getSalesReport,
  getExpensesReport,
  getSalesList,
  type SalesReport,
  type ExpensesReport,
  type ProductBreakdown,
  type SaleListItem,
} from '@/lib/reports';
import { paymentMethodLabel, getSale, type Sale } from '@/lib/sales';
import { listBranches, type Branch } from '@/lib/branches';
import { toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DistributionChart } from '@/components/ui/PieChart';
import { HourHeatmap } from '@/components/ui/HourHeatmap';
import { RefreshRing } from '@/components/ui/RefreshRing';
import { SaleTicket } from '@/components/SaleTicket';
import { ReportFilters, REPORTS_PRESETS, type AppliedFilter } from '@/components/ReportFilters';

const AUTO_REFRESH_SECONDS = 60;
const SALES_LIST_MAX_RANGE_MS = 48 * 60 * 60 * 1000;

export default function ReportsPage() {
  const me = useUser();
  const session = useSession();
  // M8: acceden super_admin (con filtro y "Por sucursal") y branch_admin (scoped por el servidor).
  const isSuperAdmin = me.role === 'super_admin';
  const isBranchAdmin = me.role === 'branch_admin';
  const canView = isSuperAdmin || isBranchAdmin;
  // Nombre de la sucursal activa (para el encabezado del branch_admin).
  const activeBranchName =
    session.branches.find((b) => b.id === session.activeBranchId)?.name ?? 'Mi sucursal';
  const [report, setReport] = useState<SalesReport | null>(null);
  // Gastos: se cargan junto a las ventas pero fallan de forma aislada (sección con su error).
  const [expenses, setExpenses] = useState<ExpensesReport | null>(null);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // M7: sucursales para el filtro de super_admin (lo gestiona ReportFilters).
  const [branches, setBranches] = useState<Branch[]>([]);

  // Historial de ventas (solo si el rango activo es ≤48h).
  const [salesList, setSalesList] = useState<SaleListItem[] | null>(null);
  const [salesListError, setSalesListError] = useState<string | null>(null);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [openSaleError, setOpenSaleError] = useState<string | null>(null);

  // Rango efectivamente cargado (no el del formulario "Personalizado" a medio
  // editar) — es lo que reusa el auto-refresh. reloadToken fuerza un reload
  // (manual o automático) sin cambiar el rango; también reinicia el anillo.
  const [activeParams, setActiveParams] = useState<{ range: { from: string; to: string }; branchId: string } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (r: { from: string; to: string }, branchId: string) => {
      setLoading(true);
      setError(null);
      setExpensesError(null);
      const params = {
        ...r,
        tz: new Date().getTimezoneOffset(),
        branchId: branchId || undefined,
      };
      try {
        const [sales, exp] = await Promise.all([
          getSalesReport(params),
          // El fallo de gastos no debe romper el reporte de ventas.
          getExpensesReport(params).catch((e) => {
            setExpensesError(e instanceof ApiError ? e.message : 'Error al cargar los gastos');
            return null;
          }),
        ]);
        setReport(sales);
        setExpenses(exp);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Error al cargar el reporte');
      } finally {
        setLoading(false);
      }

      const withinListRange = new Date(r.to).getTime() - new Date(r.from).getTime() <= SALES_LIST_MAX_RANGE_MS;
      if (withinListRange) {
        try {
          setSalesList(await getSalesList({ from: r.from, to: r.to, branchId: branchId || undefined }));
          setSalesListError(null);
        } catch (e) {
          setSalesListError(e instanceof ApiError ? e.message : 'No se pudo cargar el historial de ventas');
        }
      } else {
        setSalesList(null);
        setSalesListError(null);
      }
    },
    [],
  );

  // Punto de entrada único para (re)cargar: fija el rango activo y dispara load().
  const doLoad = useCallback(
    (r: { from: string; to: string }, branchId: string) => {
      setActiveParams({ range: r, branchId });
      void load(r, branchId);
    },
    [load],
  );

  // Solo el super admin filtra por sucursal (branch_admin queda scoped por el servidor).
  useEffect(() => {
    if (isSuperAdmin) listBranches().then(setBranches).catch(() => {});
  }, [isSuperAdmin]);

  // ReportFilters resuelve el rango + sucursal y lo emite aquí (Hoy/Ayer cargan al
  // seleccionarlos o al cambiar sucursal; Personalizado espera "Aplicar").
  const handleApply = useCallback(
    (f: AppliedFilter) => doLoad({ from: f.from, to: f.to }, f.branchId),
    [doLoad],
  );

  // Auto-refresh cada 60s del rango activo. reloadToken>0 es un refresco (auto o
  // manual) sobre el MISMO rango — no un cambio de rango, por eso usa load()
  // directo (no doLoad, que reescribiría activeParams innecesariamente). El
  // timeout se reprograma cada vez que reloadToken cambia, así un refresco
  // manual reinicia el conteo de 60s (y el anillo, que comparte la misma key).
  useEffect(() => {
    if (!activeParams) return;
    if (reloadToken > 0) void load(activeParams.range, activeParams.branchId);
    const id = setTimeout(() => setReloadToken((t) => t + 1), AUTO_REFRESH_SECONDS * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, activeParams]);

  async function openSaleDetail(id: string) {
    setOpenSaleId(id);
    setOpenSale(null);
    setOpenSaleError(null);
    try {
      setOpenSale(await getSale(id));
    } catch (e) {
      setOpenSaleError(e instanceof ApiError ? e.message : 'No se pudo cargar el detalle de la venta');
    }
  }

  if (!canView) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a los reportes.</p>
      </Card>
    );
  }

  const maxCat = Math.max(1, ...(report?.byCategory.map((c) => c.totalCents) ?? [1]));
  const maxExpCat = Math.max(1, ...(expenses?.byCategory.map((c) => c.totalCents) ?? [1]));
  const rangeTooLargeForList = activeParams
    ? new Date(activeParams.range.to).getTime() - new Date(activeParams.range.from).getTime() >
      SALES_LIST_MAX_RANGE_MS
    : false;

  return (
    <div className="space-y-4">
      <ReportFilters
        presets={REPORTS_PRESETS}
        showBranchFilter={isSuperAdmin}
        branches={branches}
        onApply={handleApply}
        header={
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold text-ink">
              {isBranchAdmin ? `Reportes · ${activeBranchName}` : 'Reportes'}
            </h1>
            {activeParams && (
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                disabled={loading}
                aria-label="Actualizar ahora"
                title="Actualizar ahora"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2 pr-1 text-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
                <RefreshRing seconds={AUTO_REFRESH_SECONDS} cycleKey={reloadToken} />
              </button>
            )}
          </div>
        }
      />

      {error && (
        <Card>
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}
      {loading && !report && (
        <Card>
          <p className="text-muted">Cargando…</p>
        </Card>
      )}

      {report && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm text-muted">Total vendido</p>
              <p className="break-words text-3xl font-bold tabular-nums text-ink sm:text-4xl">
                ${toPesos(report.totalCents)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted">Ventas</p>
              <p className="break-words text-3xl font-bold tabular-nums text-ink sm:text-4xl">
                {report.salesCount}
              </p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Por forma de pago</h2>
            {report.byPaymentMethod.length === 0 ? (
              <p className="text-sm text-muted">Sin ventas en el rango.</p>
            ) : (
              <ul className="space-y-1">
                {report.byPaymentMethod.map((p) => (
                  <li key={p.method} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      {paymentMethodLabel(p.method)} <span className="text-muted">· {p.count}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-ink">${toPesos(p.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isSuperAdmin && report.byBranch && report.byBranch.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-ink">Por sucursal</h2>
              <ul className="space-y-1">
                {report.byBranch.map((b) => (
                  <li
                    key={b.branchId ?? 'none'}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      {b.branchName} <span className="text-muted">· {b.salesCount}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-ink">${toPesos(b.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Por categoría</h2>
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-muted">Sin ventas en el rango.</p>
            ) : (
              <ul className="space-y-2">
                {report.byCategory.map((c) => (
                  <li key={c.categoryName}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-ink">
                        {c.categoryName} <span className="text-muted">· {c.quantity} u</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-ink">${toPesos(c.totalCents)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-bg">
                      <div className="h-2 rounded bg-accent" style={{ width: `${(c.totalCents / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Por horario</h2>
            <HourHeatmap data={report.byHour} />
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Gastos</h2>
              {expenses && (
                <span className="shrink-0 text-sm text-muted">
                  {expenses.summary.expensesCount}{' '}
                  {expenses.summary.expensesCount === 1 ? 'gasto' : 'gastos'}
                </span>
              )}
            </div>
            {expensesError ? (
              <p className="text-sm text-danger">{expensesError}</p>
            ) : !expenses ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : (
              <>
                <p className="mb-4 break-words text-3xl font-bold tabular-nums text-ink sm:text-4xl">
                  ${toPesos(expenses.summary.totalCents)}
                </p>
                <h3 className="mb-2 text-sm font-semibold text-ink">Por categoría</h3>
                {expenses.byCategory.length === 0 ? (
                  <p className="text-sm text-muted">Sin gastos en el rango.</p>
                ) : (
                  <ul className="space-y-2">
                    {expenses.byCategory.map((c) => (
                      <li key={c.categoryName}>
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-ink">
                            {c.categoryName} <span className="text-muted">· {c.count}</span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-ink">
                            ${toPesos(c.totalCents)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded bg-bg">
                          <div
                            className="h-2 rounded bg-accent"
                            style={{ width: `${(c.totalCents / maxExpCat) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isSuperAdmin && expenses.byBranch.length > 0 && (
                  <>
                    <h3 className="mb-2 mt-4 text-sm font-semibold text-ink">Por sucursal</h3>
                    <ul className="space-y-1">
                      {expenses.byBranch.map((b) => (
                        <li key={b.branchId} className="flex justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-ink">
                            {b.branchName} <span className="text-muted">· {b.count}</span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-ink">
                            ${toPesos(b.totalCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Resumen por producto</h2>
            {!report.byProduct || report.byProduct.length === 0 ? (
              <p className="text-sm text-muted">Sin ventas en el rango.</p>
            ) : (
              <div className="space-y-5">
                {groupByCategory(report.byProduct).map(([categoryName, products]) => {
                  const categoryQty = products.reduce((sum, p) => sum + p.quantity, 0);
                  return (
                    <div key={categoryName}>
                      <h3 className="mb-2 text-sm font-semibold text-ink">{categoryName}</h3>
                      <ul className="space-y-1.5">
                        {products.map((p) => {
                          const pct = categoryQty > 0 ? (p.quantity / categoryQty) * 100 : 0;
                          return (
                            <li
                              key={p.productName}
                              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-l-2 border-line pl-3 text-sm"
                            >
                              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="min-w-0 truncate text-ink">{p.productName}</span>
                                <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                                  {p.quantity} u
                                </span>
                                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
                                  {pct.toFixed(0)}%
                                </span>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-ink">
                                ${toPesos(p.totalCents)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <DistributionChart
              title="Distribución de ventas por categoría"
              data={report.byCategory.map((c) => ({ label: c.categoryName, value: c.totalCents }))}
              formatValue={(v) => `$${toPesos(v)}`}
            />
          </Card>

          <Card>
            <DistributionChart
              title="Distribución por número de productos vendidos"
              data={report.byCategory.map((c) => ({ label: c.categoryName, value: c.quantity }))}
              formatValue={(v) => `${v} u`}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Historial de ventas</h2>
            {rangeTooLargeForList ? (
              <p className="text-sm text-muted">
                Disponible solo para rangos de hasta 2 días — acota el rango para verlo.
              </p>
            ) : salesListError ? (
              <p className="text-sm text-danger">{salesListError}</p>
            ) : !salesList ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : salesList.length === 0 ? (
              <p className="text-sm text-muted">Sin ventas en el rango.</p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2 font-medium">Fecha y hora</th>
                      <th className="px-2 py-2 font-medium">Cliente</th>
                      <th className="px-2 py-2 text-right font-medium">Monto</th>
                      <th className="px-2 py-2 font-medium">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {salesList.map((s) => (
                      <tr
                        key={s.id}
                        tabIndex={0}
                        onClick={() => openSaleDetail(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openSaleDetail(s.id);
                        }}
                        className="cursor-pointer text-ink outline-none transition-colors hover:bg-bg focus:bg-bg"
                      >
                        <td className="whitespace-nowrap px-2 py-2 text-muted">
                          {new Date(s.createdAt).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-2 py-2">{s.customerName ?? '—'}</td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">${toPesos(s.totalCents)}</td>
                        <td className="px-2 py-2">{paymentMethodLabel(s.paymentMethod)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {openSaleId &&
        (openSale ? (
          <SaleTicket
            sale={openSale}
            onClose={() => {
              setOpenSaleId(null);
              setOpenSale(null);
            }}
          />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpenSaleId(null)}
              aria-hidden
            />
            <div className="relative w-full max-w-xs rounded-lg bg-surface p-5 text-center shadow-lg">
              {openSaleError ? (
                <>
                  <p className="text-sm text-danger">{openSaleError}</p>
                  <Button variant="ghost" className="mt-3" onClick={() => setOpenSaleId(null)}>
                    Cerrar
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">Cargando…</p>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

// Agrupa el desglose plano por producto en [categoría, productos[]], preservando
// el orden en que ya viene del backend (por categoría, luego por total desc).
function groupByCategory(items: ProductBreakdown[]): [string, ProductBreakdown[]][] {
  const groups: [string, ProductBreakdown[]][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.categoryName) last[1].push(item);
    else groups.push([item.categoryName, [item]]);
  }
  return groups;
}
