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
import { Input } from '@/components/ui/Input';
import { DistributionChart } from '@/components/ui/PieChart';
import { HourHeatmap } from '@/components/ui/HourHeatmap';
import { RefreshRing } from '@/components/ui/RefreshRing';
import { SaleTicket } from '@/components/SaleTicket';

const AUTO_REFRESH_SECONDS = 60;
const SALES_LIST_MAX_RANGE_MS = 48 * 60 * 60 * 1000;

const selectClass =
  'min-h-[40px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong sm:w-auto';

type Range = 'today' | 'yesterday' | 'custom';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Rango [from, to) para hoy/ayer (medianoche local).
function dayRange(r: 'today' | 'yesterday') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (r === 'yesterday') start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Rango personalizado a partir de dos fechas 'YYYY-MM-DD' (incluye el día 'to' completo).
function customRange(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

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
  const [range, setRange] = useState<Range>('today');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const [report, setReport] = useState<SalesReport | null>(null);
  // Gastos: se cargan junto a las ventas pero fallan de forma aislada (sección con su error).
  const [expenses, setExpenses] = useState<ExpensesReport | null>(null);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // M7: filtro por sucursal. '' = Todas · 'none' = Sin sucursal · <uuid> = una sucursal.
  const [branchFilter, setBranchFilter] = useState('');
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

  // Hoy/Ayer (y el filtro de sucursal) cargan automáticamente; Personalizado espera "Aplicar".
  useEffect(() => {
    if (canView && range !== 'custom') doLoad(dayRange(range), branchFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, range, branchFilter]);

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

  const rangeBtn = (a: boolean) =>
    `min-h-[40px] flex-1 rounded-lg px-3 py-1.5 text-sm font-medium sm:flex-none ${
      a ? 'bg-accent text-ink' : 'bg-bg text-muted'
    }`;
  const maxCat = Math.max(1, ...(report?.byCategory.map((c) => c.totalCents) ?? [1]));
  const maxExpCat = Math.max(1, ...(expenses?.byCategory.map((c) => c.totalCents) ?? [1]));
  const invalidCustom = customFrom > customTo;
  const rangeTooLargeForList = activeParams
    ? new Date(activeParams.range.to).getTime() - new Date(activeParams.range.from).getTime() >
      SALES_LIST_MAX_RANGE_MS
    : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {isSuperAdmin && (
            <select
              aria-label="Filtrar por sucursal"
              className={selectClass}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="none">Sin sucursal</option>
            </select>
          )}
          <div className="flex gap-2">
            <button className={rangeBtn(range === 'today')} onClick={() => setRange('today')}>
              Hoy
            </button>
            <button className={rangeBtn(range === 'yesterday')} onClick={() => setRange('yesterday')}>
              Ayer
            </button>
            <button className={rangeBtn(range === 'custom')} onClick={() => setRange('custom')}>
              Personalizado
            </button>
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-auto">
              <label htmlFor="from" className="mb-1 block text-sm font-medium text-ink">
                Desde
              </label>
              <Input id="from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="to" className="mb-1 block text-sm font-medium text-ink">
                Hasta
              </label>
              <Input id="to" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button
              disabled={invalidCustom}
              className="min-h-[40px] w-full sm:w-auto"
              onClick={() => doLoad(customRange(customFrom, customTo), branchFilter)}
            >
              Aplicar
            </Button>
          </div>
          {invalidCustom && <p className="mt-2 text-sm text-danger">La fecha "Desde" no puede ser mayor que "Hasta".</p>}
        </Card>
      )}

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
