'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import {
  listSuppliers,
  createPurchase,
  listPurchases,
  presentationLabel,
  dateLabel,
  isToday,
  type Supplier,
  type PurchaseHistoryItem,
} from '@/lib/warehouse';
import { listSupplies, formatBase, type Supply } from '@/lib/supplies';
import { toCents, toPesos } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Modal } from '@/components/ui/Modal';
import { DateInput, todayISO } from '@/components/ui/DateInput';
import { FormField } from '@/components/ui/FormField';
import { SupplierForm } from '@/components/SupplierForm';

export default function PurchasesPage() {
  const me = useUser();
  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }
  return (
    <Suspense fallback={<Card><p className="text-muted">Cargando…</p></Card>}>
      <PurchasesInner />
    </Suspense>
  );
}

function PurchasesInner() {
  const searchParams = useSearchParams();
  const prefillSupplyId = searchParams.get('supplyId') ?? '';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: todayISO(),
    supplierId: '',
    supplyId: '',
    price: '',
    quantity: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  async function refreshHistory() {
    try {
      setHistory(await listPurchases());
    } catch {
      /* el historial degrada silenciosamente */
    }
  }

  useEffect(() => {
    Promise.all([listSuppliers(true), listSupplies()])
      .then(([sup, sup2]) => {
        setSuppliers(sup);
        setSupplies(sup2.filter((s) => s.status === 'active'));
      })
      .catch(() => setLoadError('No se pudieron cargar proveedores o insumos'));
    void refreshHistory();
  }, []);

  // Prefill del insumo desde ?supplyId cuando el catálogo ya cargó.
  useEffect(() => {
    if (prefillSupplyId && supplies.some((s) => s.id === prefillSupplyId)) {
      setForm((f) => (f.supplyId === '' ? { ...f, supplyId: prefillSupplyId } : f));
    }
  }, [prefillSupplyId, supplies]);

  const supply = useMemo(
    () => supplies.find((s) => s.id === form.supplyId) ?? null,
    [supplies, form.supplyId],
  );

  const quantity = Math.round(Number(form.quantity));
  const priceCents = form.price.trim() === '' ? 0 : toCents(form.price);
  const canSubmit =
    form.supplierId !== '' && form.supplyId !== '' && quantity > 0 && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createPurchase({
        supplyId: form.supplyId,
        supplierId: form.supplierId,
        packages: quantity,
        unitCostCents: priceCents,
        date: form.date,
      });
      // Éxito: limpiar cantidad/precio, refrescar historial (fila nueva arriba).
      setForm((f) => ({ ...f, price: '', quantity: '' }));
      await refreshHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar la compra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Compras</h1>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Registrar compra</h2>
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

          {supply && (
            <FormField label="Presentación">
              <div className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-muted">
                {presentationLabel(supply.packageName, supply.packageContent, supply.baseUnit)}
              </div>
            </FormField>
          )}

          <FormField label="Proveedor" htmlFor="supplierId">
            <SearchableSelect
              id="supplierId"
              options={suppliers.map((s) => ({ id: s.id, label: s.name }))}
              value={form.supplierId}
              onChange={(supplierId) => setForm({ ...form, supplierId })}
              placeholder="Buscar proveedor…"
              emptyLabel="Sin proveedores con ese nombre."
              required
            />
            <button
              type="button"
              onClick={() => setSupplierModalOpen(true)}
              className="mt-1 inline-block text-xs text-accent-strong underline hover:text-ink"
            >
              ＋ Nuevo proveedor
            </button>
          </FormField>

          <FormField label="Cantidad (presentaciones)" htmlFor="quantity">
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

          <FormField label="Precio de compra (pesos, por presentación)" htmlFor="price">
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </FormField>

          {supply && quantity > 0 && (
            <p className="border-t border-line pt-3 text-xs text-muted">
              Entran{' '}
              <span className="tabular-nums text-ink">
                {formatBase(quantity * supply.packageContent)} {supply.baseUnit}
              </span>{' '}
              al almacén · Total{' '}
              <span className="tabular-nums text-ink">
                ${toPesos(quantity * priceCents)}
              </span>
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={saving} disabled={!canSubmit}>
            Registrar compra
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Historial de compras</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Sin compras registradas.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 font-medium">Proveedor</th>
                  <th className="px-2 py-2 text-right font-medium">Cant.</th>
                  <th className="px-2 py-2 text-right font-medium">Precio/pres</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((p) => {
                  const today = isToday(p.createdAt);
                  return (
                  <tr key={p.id} className="text-ink">
                    <td
                      className={`whitespace-nowrap px-2 py-2 ${today ? 'font-semibold text-ink' : 'text-muted'}`}
                    >
                      {dateLabel(p.createdAt)}
                    </td>
                    <td className={`px-2 py-2 ${today ? 'font-semibold' : ''}`}>{p.supplyName}</td>
                    <td className="px-2 py-2">{p.supplierName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.packages}</td>
                    <td className="px-2 py-2 text-right tabular-nums">${toPesos(p.unitCostCents)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">${toPesos(p.totalCents)}</td>
                    <td className="px-2 py-2 text-muted">{p.createdByName ?? 'Sistema'}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {supplierModalOpen && (
        <Modal title="Nuevo proveedor" onClose={() => setSupplierModalOpen(false)}>
          <SupplierForm
            hideCard
            onCancel={() => setSupplierModalOpen(false)}
            onSaved={(supplier) => {
              setSuppliers((prev) => [...prev, supplier]);
              setForm((f) => ({ ...f, supplierId: supplier.id }));
              setSupplierModalOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
