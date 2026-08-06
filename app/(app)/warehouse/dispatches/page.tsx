'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  createDispatch,
  listDispatches,
  dateLabel,
  isToday,
  type DispatchHistoryItem,
} from '@/lib/warehouse';
import { listSupplies, formatBase, formatSigned, type Supply } from '@/lib/supplies';
import { listBranches, type Branch } from '@/lib/branches';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DateInput, todayISO } from '@/components/ui/DateInput';
import { FormField } from '@/components/ui/FormField';

export default function DispatchesPage() {
  const me = useUser();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [history, setHistory] = useState<DispatchHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ date: todayISO(), supplyId: '', quantity: '', branchId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshHistory() {
    try {
      setHistory(await listDispatches());
    } catch {
      /* el historial degrada silenciosamente */
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    Promise.all([listSupplies('active'), listBranches(true)])
      .then(([sup, br]) => {
        setSupplies(sup);
        setBranches(br);
      })
      .catch(() => setLoadError('No se pudieron cargar insumos o sucursales'));
    void refreshHistory();
  }, [me.isSuperAdmin]);

  const supply = useMemo(
    () => supplies.find((s) => s.id === form.supplyId) ?? null,
    [supplies, form.supplyId],
  );
  const branch = useMemo(
    () => branches.find((b) => b.id === form.branchId) ?? null,
    [branches, form.branchId],
  );

  const quantity = Math.round(Number(form.quantity));
  const canSubmit = form.supplyId !== '' && quantity > 0 && form.branchId !== '' && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createDispatch({
        supplyId: form.supplyId,
        branchId: form.branchId,
        quantityBase: quantity,
        date: form.date,
      });
      setForm((f) => ({ ...f, quantity: '' }));
      await refreshHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar la salida');
    } finally {
      setSaving(false);
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Salidas</h1>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Registrar salida</h2>
        {loadError && <p className="mb-2 text-sm text-danger">{loadError}</p>}
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField label="Fecha" htmlFor="date">
            <DateInput
              id="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Insumo" htmlFor="supplyId">
            <SearchableSelect
              id="supplyId"
              options={supplies.map((s) => ({ id: s.id, label: s.name }))}
              value={form.supplyId}
              onChange={(supplyId) => setForm({ ...form, supplyId })}
              placeholder="Buscar insumo…"
              emptyLabel="Sin insumos con ese nombre."
              required
            />
          </FormField>

          <FormField
            label={`Cantidad${supply ? ` (${supply.baseUnit})` : ''}`}
            htmlFor="quantity"
          >
            <Input
              id="quantity"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </FormField>

          <FormField label="Sucursal destino" htmlFor="branchId">
            <Select
              id="branchId"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>

          {supply && quantity > 0 && branch && (
            <p className="border-t border-line pt-3 text-xs text-muted">
              Resta{' '}
              <span className="tabular-nums text-ink">
                {formatBase(quantity)} {supply.baseUnit}
              </span>{' '}
              del almacén y suma{' '}
              <span className="tabular-nums text-ink">
                {formatBase(quantity)} {supply.baseUnit}
              </span>{' '}
              a «{branch.name}». El reflejo en la sucursal es automático.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={saving} disabled={!canSubmit}>
            Registrar salida
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Historial de salidas</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Sin salidas registradas.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">Sucursal destino</th>
                  <th className="px-2 py-2 font-medium">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((d) => {
                  const today = isToday(d.createdAt);
                  return (
                    <tr key={d.id} className="text-ink">
                      <td
                        className={`whitespace-nowrap px-2 py-2 ${today ? 'font-semibold text-ink' : 'text-muted'}`}
                      >
                        {dateLabel(d.createdAt)}
                      </td>
                      <td className={`px-2 py-2 ${today ? 'font-semibold' : ''}`}>{d.supplyName}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-danger">
                        {formatSigned(d.quantityBase)}
                      </td>
                      <td className="px-2 py-2">{d.branchName}</td>
                      <td className="px-2 py-2 text-muted">{d.createdByName ?? 'Sistema'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
