'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Branch } from '@/lib/branches';

// ReportFilters (design-system §M9.1): bloque de filtros reutilizable extraído de
// Reportes. Pills de rango con presets configurables + fechas Desde/Hasta para
// "Personalizado" + Select de sucursal (solo super_admin). Semántica idéntica a
// `internal/reports`: emite un rango [from, to) (medianoche local) + branchId. La
// zona horaria (tz) la agrega cada cliente API al llamar al backend.
//
// El componente NO carga datos: solo resuelve el filtro y lo emite por `onApply`.
// El auto-refresh (Reportes) o la carga aislada por tarjeta (Insights) son
// responsabilidad de la página que lo usa.

// Un preset sin `getRange` es "Personalizado" (habilita las fechas manuales).
export type RangePreset = {
  key: string;
  label: string;
  getRange?: () => { from: string; to: string };
};

export type AppliedFilter = { from: string; to: string; branchId: string };

// --- Helpers de rango (medianoche local, semántica [from, to)) ---------------
export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Rango de un día completo (hoy o ayer), [medianoche, medianoche siguiente).
export function dayRange(r: 'today' | 'yesterday') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (r === 'yesterday') start.setDate(start.getDate() - 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Rango personalizado a partir de dos fechas 'YYYY-MM-DD' (incluye el día "to").
export function customRange(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Ventana de los últimos N días terminando hoy (inclusive): [hoy-N, mañana).
export function lastNDays(n: number) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - n);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Presets de Reportes (comportamiento actual: Hoy/Ayer/Personalizado, default Hoy).
export const REPORTS_PRESETS: RangePreset[] = [
  { key: 'today', label: 'Hoy', getRange: () => dayRange('today') },
  { key: 'yesterday', label: 'Ayer', getRange: () => dayRange('yesterday') },
  { key: 'custom', label: 'Personalizado' },
];

// Presets de Insights (dominio de comportamiento: 30/90/Personalizado, default 30).
export const INSIGHTS_PRESETS: RangePreset[] = [
  { key: '30d', label: 'Últimos 30 días', getRange: () => lastNDays(30) },
  { key: '90d', label: 'Últimos 90 días', getRange: () => lastNDays(90) },
  { key: 'custom', label: 'Personalizado' },
];

export function ReportFilters({
  presets,
  showBranchFilter,
  branches,
  header,
  onApply,
}: {
  presets: RangePreset[];
  showBranchFilter: boolean;
  branches: Branch[];
  // Contenido a la izquierda de los controles (título + acciones de la página).
  header?: ReactNode;
  onApply: (filter: AppliedFilter) => void;
}) {
  const [rangeKey, setRangeKey] = useState(presets[0].key);
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  // '' = Todas · 'none' = Sin sucursal · <uuid> = una sucursal.
  const [branchFilter, setBranchFilter] = useState('');

  const activePreset = presets.find((p) => p.key === rangeKey);
  const isCustom = !activePreset?.getRange;
  const invalidCustom = customFrom > customTo;

  // onApply es estable en las páginas (useCallback), pero lo guardamos en ref por
  // seguridad para no re-disparar el efecto si la referencia cambiara.
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  // Presets con rango (Hoy/Ayer/30/90) cargan automáticamente al seleccionarlos o
  // al cambiar de sucursal; "Personalizado" espera el botón "Aplicar" (idéntico al
  // comportamiento actual de Reportes: al cambiar sucursal en modo Personalizado
  // no recarga hasta pulsar "Aplicar").
  useEffect(() => {
    const preset = presets.find((p) => p.key === rangeKey);
    if (preset?.getRange) onApplyRef.current({ ...preset.getRange(), branchId: branchFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, branchFilter]);

  const rangeBtn = (a: boolean) =>
    `min-h-[44px] flex-1 rounded-lg px-3 py-1.5 text-sm font-medium sm:min-h-[40px] sm:flex-none ${
      a ? 'bg-accent text-ink' : 'bg-bg text-muted'
    }`;
  const selectClass =
    'min-h-[44px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong sm:min-h-[40px] sm:w-auto';

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {header}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {showBranchFilter && (
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
            {presets.map((p) => (
              <button key={p.key} className={rangeBtn(rangeKey === p.key)} onClick={() => setRangeKey(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isCustom && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-auto">
              <label htmlFor="rf-from" className="mb-1 block text-sm font-medium text-ink">
                Desde
              </label>
              <Input
                id="rf-from"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="rf-to" className="mb-1 block text-sm font-medium text-ink">
                Hasta
              </label>
              <Input
                id="rf-to"
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <Button
              disabled={invalidCustom}
              className="min-h-[44px] w-full sm:min-h-[40px] sm:w-auto"
              onClick={() => onApply({ ...customRange(customFrom, customTo), branchId: branchFilter })}
            >
              Aplicar
            </Button>
          </div>
          {invalidCustom && (
            <p className="mt-2 text-sm text-danger">La fecha "Desde" no puede ser mayor que "Hasta".</p>
          )}
        </Card>
      )}
    </>
  );
}
