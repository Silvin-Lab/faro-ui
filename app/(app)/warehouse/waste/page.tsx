'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { createWaste, listWaste, dateLabel, isToday, type WasteHistoryItem } from '@/lib/warehouse';
import { listSupplies, formatSigned, type Supply } from '@/lib/supplies';
import { listBranches, type Branch } from '@/lib/branches';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DateInput, todayISO } from '@/components/ui/DateInput';
import { FormField } from '@/components/ui/FormField';

// Valor especial del select de sucursal para "sin sucursal" (almacén central).
const NO_BRANCH = '';

export default function WastePage() {
  const me = useUser();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [history, setHistory] = useState<WasteHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: todayISO(),
    supplyId: '',
    quantity: '',
    branchId: NO_BRANCH,
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshHistory() {
    try {
      setHistory(await listWaste());
    } catch {
      /* el historial degrada silenciosamente */
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    Promise.all([listSupplies(), listBranches(true)])
      .then(([sup, br]) => {
        setSupplies(sup.filter((s) => s.status === 'active'));
        setBranches(br);
      })
      .catch(() => setLoadError('No se pudieron cargar insumos o sucursales'));
    void refreshHistory();
  }, [me.isSuperAdmin]);

  const supply = useMemo(
    () => supplies.find((s) => s.id === form.supplyId) ?? null,
    [supplies, form.supplyId],
  );

  const quantity = Math.round(Number(form.quantity));
  const canSubmit =
    form.supplyId !== '' && quantity > 0 && form.reason.trim() !== '' && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createWaste({
        supplyId: form.supplyId,
        quantityBase: quantity,
        reason: form.reason.trim(),
        branchId: form.branchId === NO_BRANCH ? undefined : form.branchId,
        date: form.date,
      });
      setForm((f) => ({ ...f, quantity: '', reason: '' }));
      await refreshHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar la merma');
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
      <h1 className="text-2xl font-semibold text-ink">Mermas</h1>

      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">Registrar merma</h2>
        <p className="mb-3 text-xs text-muted">
          Producto eliminado, caducado o desechado. Si salió a una sucursal y allí se desechó, elige
          esa sucursal; si se perdió en el almacén, deja «Sin sucursal».
        </p>
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

          <FormField label="Sucursal (opcional)" htmlFor="branchId">
            <Select
              id="branchId"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value={NO_BRANCH}>Sin sucursal (almacén central)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Motivo" htmlFor="reason">
            <Input
              id="reason"
              placeholder="Ej. caducado, dañado"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
            />
          </FormField>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={saving} disabled={!canSubmit}>
            Registrar merma
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Historial de mermas</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Sin mermas registradas.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">Sucursal</th>
                  <th className="px-2 py-2 font-medium">Motivo</th>
                  <th className="px-2 py-2 font-medium">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((w) => {
                  const today = isToday(w.createdAt);
                  return (
                    <tr key={w.id} className="text-ink">
                      <td
                        className={`whitespace-nowrap px-2 py-2 ${today ? 'font-semibold text-ink' : 'text-muted'}`}
                      >
                        {dateLabel(w.createdAt)}
                      </td>
                      <td className={`px-2 py-2 ${today ? 'font-semibold' : ''}`}>{w.supplyName}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-danger">
                        {formatSigned(w.quantityBase)}
                      </td>
                      <td className="px-2 py-2">{w.branchName ?? '—'}</td>
                      <td className="px-2 py-2 text-muted">{w.reason}</td>
                      <td className="px-2 py-2 text-muted">{w.createdByName ?? 'Sistema'}</td>
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
