'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser, useSession } from '@/lib/user-context';
import { getSalesReport, getExpensesReport, type SalesReport, type ExpensesReport } from '@/lib/reports';
import { paymentMethodLabel } from '@/lib/sales';
import { listBranches, type Branch } from '@/lib/branches';
import { toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
    },
    [],
  );

  // Solo el super admin filtra por sucursal (branch_admin queda scoped por el servidor).
  useEffect(() => {
    if (isSuperAdmin) listBranches().then(setBranches).catch(() => {});
  }, [isSuperAdmin]);

  // Hoy/Ayer (y el filtro de sucursal) cargan automáticamente; Personalizado espera "Aplicar".
  useEffect(() => {
    if (canView && range !== 'custom') void load(dayRange(range), branchFilter);
  }, [canView, range, branchFilter, load]);

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
  const maxHour = Math.max(1, ...(report?.byHour.map((h) => h.totalCents) ?? [1]));
  const maxExpCat = Math.max(1, ...(expenses?.byCategory.map((c) => c.totalCents) ?? [1]));
  const invalidCustom = customFrom > customTo;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="min-w-0 break-words text-2xl font-semibold text-ink">
          {isBranchAdmin ? `Reportes · ${activeBranchName}` : 'Reportes'}
        </h1>
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
              onClick={() => load(customRange(customFrom, customTo), branchFilter)}
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
      {loading && (
        <Card>
          <p className="text-muted">Cargando…</p>
        </Card>
      )}

      {report && !loading && (
        <>
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
            {report.byHour.length === 0 ? (
              <p className="text-sm text-muted">Sin ventas en el rango.</p>
            ) : (
              <ul className="space-y-1">
                {report.byHour.map((h) => (
                  <li key={h.hour} className="flex items-center gap-2 text-xs">
                    <span className="w-10 shrink-0 tabular-nums text-muted">{String(h.hour).padStart(2, '0')}h</span>
                    <div className="h-3 min-w-0 flex-1 rounded bg-bg">
                      <div className="h-3 rounded bg-accent" style={{ width: `${(h.totalCents / maxHour) * 100}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right tabular-nums text-ink">${toPesos(h.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
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
        </>
      )}
    </div>
  );
}
