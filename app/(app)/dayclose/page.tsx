'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser, useSession } from '@/lib/user-context';
import {
  openDayClosure,
  updateDayClosure,
  submitDayClosure,
  getDayClosure,
  type DayClosure,
} from '@/lib/dayclose';
import {
  listBakeryStock,
  createBakeryWaste,
  listBakeryWaste,
  createBakeryCount,
  getBakeryCount,
  type ProductBranchStockItem,
  type BakeryWasteItem,
  type BakeryCountDetail,
} from '@/lib/bakery';
import {
  createWaste,
  listWaste,
  dateLabel,
  isToday,
  type WasteHistoryItem,
} from '@/lib/warehouse';
import {
  createRequisition,
  listRequisitionSuggestions,
  type SupplyRequisitionSuggestion,
} from '@/lib/requisitions';
import { listSupplies, formatBase, formatSigned, type Supply } from '@/lib/supplies';
import { toCents } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Cierre de día / corte de caja (M11) — roles de sucursal. Wizard de un solo flujo
// (tabs libres) persistido incrementalmente contra el backend paso a paso. Al enviar
// se congela y pasa a solo-lectura.

// Formatea centavos a pesos mexicanos: 123456 → "$1,234.56".
const pesos = (cents: number): string =>
  (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

type StepKey = 'cash' | 'counts' | 'waste' | 'requisition' | 'submit';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'cash', label: 'Corte de caja' },
  { key: 'counts', label: 'Postres restantes' },
  { key: 'waste', label: 'Mermas' },
  { key: 'requisition', label: 'Insumos a la matriz' },
  { key: 'submit', label: 'Enviar cierre' },
];

export default function DayClosePage() {
  const me = useUser();
  const isBranchUser =
    me.role === 'branch_admin' || me.role === 'cashier' || me.role === 'barista';

  const [closure, setClosure] = useState<DayClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isBranchUser) return;
    openDayClosure()
      .then((c) => {
        setClosure(c);
        setLoadError(null);
      })
      .catch((e) =>
        setLoadError(e instanceof ApiError ? e.message : 'No se pudo abrir el cierre de día'),
      )
      .finally(() => setLoading(false));
  }, [isBranchUser]);

  if (!isBranchUser) {
    return (
      <Card>
        <p className="text-muted">El cierre de día lo hace el equipo de sucursal.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Cargando…</p>
      </Card>
    );
  }

  if (loadError || !closure) {
    return (
      <Card>
        <p className="text-sm text-danger">{loadError ?? 'No se pudo cargar el cierre.'}</p>
      </Card>
    );
  }

  if (closure.status === 'submitted') {
    return <SubmittedView closure={closure} />;
  }

  return <Wizard closure={closure} setClosure={setClosure} />;
}

// --- Vista de solo-lectura (cierre ya enviado) ------------------------------
function SubmittedView({ closure }: { closure: DayClosure }) {
  const when = closure.submittedAt
    ? new Date(closure.submittedAt).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cierre de día</h1>
        <p className="mt-1 text-sm text-muted">« {closure.branchName} » · {closure.closureDate}</p>
      </div>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge variant="success">Enviado</StatusBadge>
          <p className="text-sm text-ink">
            Cierre de hoy ya enviado{when ? ` a las ${when}` : ''}
            {closure.submittedByName ? ` por ${closure.submittedByName}` : ''}.
          </p>
        </div>
        <ClosureSummary closure={closure} />
      </Card>
    </div>
  );
}

// Resumen numérico de un cierre (compartido por la vista submitted y el paso 5).
function ClosureSummary({ closure }: { closure: DayClosure }) {
  const rows: { label: string; value: string; danger?: boolean; success?: boolean }[] = [
    { label: 'Ventas del día', value: closure.totalSalesCents != null ? pesos(closure.totalSalesCents) : '—' },
    { label: 'Gastos del día', value: closure.totalExpensesCents != null ? pesos(closure.totalExpensesCents) : '—' },
    { label: 'Efectivo esperado', value: closure.cashExpectedCents != null ? pesos(closure.cashExpectedCents) : '—' },
    { label: 'Efectivo contado', value: closure.cashCountedCents != null ? pesos(closure.cashCountedCents) : 'Sin capturar' },
  ];
  const diff = closure.cashDiffCents;
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between py-2">
          <dt className="text-muted">{r.label}</dt>
          <dd className="tabular-nums text-ink">{r.value}</dd>
        </div>
      ))}
      {diff != null && (
        <div className="flex justify-between py-2">
          <dt className="text-muted">Diferencia de caja</dt>
          <dd
            className={`font-semibold tabular-nums ${diff === 0 ? 'text-success' : 'text-danger'}`}
          >
            {diff === 0 ? 'Cuadra' : `${diff > 0 ? '+' : '−'}${pesos(Math.abs(diff))}`}
          </dd>
        </div>
      )}
      <div className="flex justify-between py-2">
        <dt className="text-muted">Conteo de postres</dt>
        <dd className="text-ink">{closure.bakeryCountId ? 'Registrado' : 'Sin conteo'}</dd>
      </div>
      <div className="flex justify-between py-2">
        <dt className="text-muted">Solicitud de insumos</dt>
        <dd className="text-ink">{closure.supplyRequisitionId ? 'Enviada' : 'Sin solicitud'}</dd>
      </div>
    </dl>
  );
}

// --- Wizard (cierre en borrador) --------------------------------------------
function Wizard({
  closure,
  setClosure,
}: {
  closure: DayClosure;
  setClosure: (c: DayClosure) => void;
}) {
  const session = useSession();
  const branchName =
    session.branches.find((b) => b.id === session.activeBranchId)?.name ?? closure.branchName;

  const [step, setStep] = useState<StepKey>('cash');

  // Recursos compartidos (se cargan una vez).
  const [stock, setStock] = useState<ProductBranchStockItem[] | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);

  // Marcas de "completado" que no viven en el closure.
  const [wasteDone, setWasteDone] = useState(false);
  const [reqSkipped, setReqSkipped] = useState(false);

  useEffect(() => {
    listBakeryStock()
      .then((r) => setStock(r.items))
      .catch(() => setStock([]));
    listSupplies('active')
      .then(setSupplies)
      .catch(() => setSupplies([]));
  }, []);

  const noBakery = stock !== null && stock.length === 0;

  const done: Record<StepKey, boolean> = {
    cash: closure.cashCountedCents != null,
    counts: closure.bakeryCountId != null || noBakery,
    waste: wasteDone,
    requisition: closure.supplyRequisitionId != null || reqSkipped,
    submit: false,
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cierre de día</h1>
        <p className="mt-1 text-sm text-muted">
          « {branchName} » · {closure.closureDate}. Cada paso se guarda solo; puedes hacerlos en
          cualquier orden.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pasos del cierre">
        {STEPS.map((s, i) => {
          const active = s.key === step;
          const complete = done[s.key];
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStep(s.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-accent-strong bg-accent text-ink'
                  : 'border-line bg-surface text-muted hover:bg-bg hover:text-ink'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  complete ? 'bg-success/20 text-success' : 'bg-bg text-muted'
                }`}
              >
                {complete ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {step === 'cash' && <CashStep closure={closure} setClosure={setClosure} />}
      {step === 'counts' && (
        <CountsStep closure={closure} setClosure={setClosure} stock={stock} noBakery={noBakery} />
      )}
      {step === 'waste' && (
        <WasteStep
          supplies={supplies}
          products={stock ?? []}
          done={wasteDone}
          setDone={setWasteDone}
        />
      )}
      {step === 'requisition' && (
        <RequisitionStep
          closure={closure}
          setClosure={setClosure}
          supplies={supplies}
          skipped={reqSkipped}
          setSkipped={setReqSkipped}
        />
      )}
      {step === 'submit' && (
        <SubmitStep closure={closure} setClosure={setClosure} done={done} />
      )}
    </div>
  );
}

// --- Paso 1: Corte de caja --------------------------------------------------
function CashStep({
  closure,
  setClosure,
}: {
  closure: DayClosure;
  setClosure: (c: DayClosure) => void;
}) {
  const [countedStr, setCountedStr] = useState(
    closure.cashCountedCents != null ? (closure.cashCountedCents / 100).toFixed(2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const expected = closure.cashExpectedCents ?? 0;
  const countedCents = countedStr.trim() === '' ? null : toCents(countedStr);
  const liveDiff = countedCents != null ? countedCents - expected : null;

  async function onSave() {
    if (countedCents == null) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const c = await updateDayClosure(closure.id, { cashCountedCents: countedCents });
      setClosure(c);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el corte de caja.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-ink">Corte de caja</h2>
      <dl className="mb-4 divide-y divide-line text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-muted">Ventas del día</dt>
          <dd className="tabular-nums text-ink">
            {closure.totalSalesCents != null ? pesos(closure.totalSalesCents) : '—'}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-muted">Gastos del día</dt>
          <dd className="tabular-nums text-ink">
            {closure.totalExpensesCents != null ? pesos(closure.totalExpensesCents) : '—'}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-muted">Efectivo esperado en caja</dt>
          <dd className="font-medium tabular-nums text-ink">{pesos(expected)}</dd>
        </div>
      </dl>

      <FormField label="Efectivo contado a mano" htmlFor="cashCounted">
        <Input
          id="cashCounted"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={countedStr}
          onChange={(e) => {
            setCountedStr(e.target.value);
            setSaved(false);
          }}
          className="tabular-nums"
        />
      </FormField>

      {liveDiff != null && (
        <p className="mt-2 text-sm">
          Diferencia:{' '}
          <span
            className={`font-semibold tabular-nums ${liveDiff === 0 ? 'text-success' : 'text-danger'}`}
          >
            {liveDiff === 0 ? 'Cuadra' : `${liveDiff > 0 ? '+' : '−'}${pesos(Math.abs(liveDiff))}`}
          </span>
          {liveDiff !== 0 && (
            <span className="text-muted">
              {' '}
              ({liveDiff > 0 ? 'sobrante' : 'faltante'} en caja)
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {saved && !error && <p className="mt-2 text-sm text-success">Guardado.</p>}

      <div className="mt-4">
        <Button type="button" onClick={onSave} loading={saving} disabled={countedCents == null}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

// --- Paso 2: Postres restantes ----------------------------------------------
function CountsStep({
  closure,
  setClosure,
  stock,
  noBakery,
}: {
  closure: DayClosure;
  setClosure: (c: DayClosure) => void;
  stock: ProductBranchStockItem[] | null;
  noBakery: boolean;
}) {
  // countedQty por producto (string para el input).
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BakeryCountDetail | null>(null);

  // Si ya hay un conteo ligado, tráelo para mostrar los diffs al reabrir.
  useEffect(() => {
    if (closure.bakeryCountId) {
      getBakeryCount(closure.bakeryCountId)
        .then(setResult)
        .catch(() => {});
    }
  }, [closure.bakeryCountId]);

  if (noBakery) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">Postres restantes</h2>
        <p className="text-sm text-muted">Esta sucursal no vende postres de repostería.</p>
      </Card>
    );
  }

  if (stock === null) {
    return (
      <Card>
        <p className="text-sm text-muted">Cargando postres…</p>
      </Card>
    );
  }

  const diffByProduct = new Map(result?.items.map((it) => [it.productId, it]) ?? []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const items = stock!.map((s) => ({
        productId: s.productId,
        countedQty: counted[s.productId]?.trim() ? Math.round(Number(counted[s.productId])) : 0,
      }));
      const detail = await createBakeryCount({ items });
      setResult(detail);
      const c = await updateDayClosure(closure.id, { bakeryCountId: detail.count.id });
      setClosure(c);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el conteo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-ink">Postres restantes</h2>
      <p className="mb-3 text-xs text-muted">
        Cuenta los postres que quedaron. Si cuentas menos de lo esperado, la diferencia se registra
        como merma automática.
      </p>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Postre</th>
              <th className="px-2 py-2 text-right font-medium">Esperado</th>
              <th className="px-2 py-2 text-right font-medium">Contado</th>
              <th className="px-2 py-2 font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stock.map((s) => {
              const diff = diffByProduct.get(s.productId);
              return (
                <tr key={s.productId} className="align-middle text-ink">
                  <td className="px-2 py-2">{s.productName}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{s.stockQty}</td>
                  <td className="px-2 py-2 text-right">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={counted[s.productId] ?? ''}
                      onChange={(e) =>
                        setCounted((c) => ({ ...c, [s.productId]: e.target.value }))
                      }
                      className="w-24 tabular-nums"
                      aria-label={`Contado de ${s.productName}`}
                    />
                  </td>
                  <td className="px-2 py-2 text-sm">
                    {diff && diff.diffQty !== 0 ? (
                      diff.diffQty < 0 ? (
                        <span className="text-danger">
                          Merma automática de {Math.abs(diff.diffQty)}
                        </span>
                      ) : (
                        <span className="text-accent-strong">
                          Sobrante de {diff.diffQty} — revisar
                        </span>
                      )
                    ) : diff ? (
                      <span className="text-success">Cuadra</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        <Button type="button" onClick={onSave} loading={saving}>
          {closure.bakeryCountId ? 'Volver a guardar conteo' : 'Guardar conteo'}
        </Button>
      </div>
    </Card>
  );
}

// --- Paso 3: Mermas ---------------------------------------------------------
function WasteStep({
  supplies,
  products,
  done,
  setDone,
}: {
  supplies: Supply[];
  products: ProductBranchStockItem[];
  done: boolean;
  setDone: (v: boolean) => void;
}) {
  const [supplyWaste, setSupplyWaste] = useState<WasteHistoryItem[]>([]);
  const [productWaste, setProductWaste] = useState<BakeryWasteItem[]>([]);

  async function refresh() {
    try {
      const [sw, pw] = await Promise.all([listWaste(), listBakeryWaste()]);
      setSupplyWaste(sw.filter((w) => isToday(w.createdAt)));
      setProductWaste(pw.filter((w) => isToday(w.createdAt)));
    } catch {
      /* degradación silenciosa */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <SupplyWasteForm
        supplies={supplies}
        onSaved={() => {
          setDone(true);
          void refresh();
        }}
      />
      <ProductWasteForm
        products={products}
        onSaved={() => {
          setDone(true);
          void refresh();
        }}
      />

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Mermas reportadas hoy</h2>
        {supplyWaste.length === 0 && productWaste.length === 0 ? (
          <p className="text-sm text-muted">Aún no has reportado mermas hoy.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {supplyWaste.map((w) => (
              <li key={w.id} className="flex justify-between py-2">
                <span className="text-ink">
                  {w.supplyName} <span className="text-muted">· insumo · {w.reason}</span>
                </span>
                <span className="tabular-nums text-danger">{formatSigned(w.quantityBase)}</span>
              </li>
            ))}
            {productWaste.map((w) => (
              <li key={w.id} className="flex justify-between py-2">
                <span className="text-ink">
                  {w.productName} <span className="text-muted">· postre{w.reason ? ` · ${w.reason}` : ''}</span>
                </span>
                <span className="tabular-nums text-danger">{formatSigned(w.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!done && (
        <Button type="button" variant="outline" onClick={() => setDone(true)}>
          No hubo mermas hoy
        </Button>
      )}
    </div>
  );
}

function SupplyWasteForm({
  supplies,
  onSaved,
}: {
  supplies: Supply[];
  onSaved: () => void;
}) {
  const [supplyId, setSupplyId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supply = useMemo(() => supplies.find((s) => s.id === supplyId) ?? null, [supplies, supplyId]);
  const qty = Math.round(Number(quantity));
  const canSubmit = supplyId !== '' && qty > 0 && reason.trim() !== '' && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createWaste({ supplyId, quantityBase: qty, reason: reason.trim() });
      setSupplyId('');
      setQuantity('');
      setReason('');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma de insumo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-ink">Merma de insumos</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Insumo" htmlFor="wasteSupply">
          <SearchableSelect
            id="wasteSupply"
            options={supplies.map((s) => ({ id: s.id, label: s.name }))}
            value={supplyId}
            onChange={setSupplyId}
            placeholder="Buscar insumo…"
            emptyLabel="Sin insumos con ese nombre."
          />
        </FormField>
        <FormField label={`Cantidad${supply ? ` (${supply.baseUnit})` : ''}`} htmlFor="wasteSupplyQty">
          <Input
            id="wasteSupplyQty"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="tabular-nums"
          />
        </FormField>
        <FormField label="Motivo" htmlFor="wasteSupplyReason">
          <Input
            id="wasteSupplyReason"
            placeholder="Ej. caducado, dañado"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canSubmit}>
          Registrar merma de insumo
        </Button>
      </form>
    </Card>
  );
}

function ProductWasteForm({
  products,
  onSaved,
}: {
  products: ProductBranchStockItem[];
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = Math.round(Number(quantity));
  const canSubmit = productId !== '' && qty > 0 && reason.trim() !== '' && !saving;

  if (products.length === 0) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createBakeryWaste({ productId, quantity: qty, reason: reason.trim() });
      setProductId('');
      setQuantity('');
      setReason('');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la merma de postre.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-ink">Merma de postres</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Postre" htmlFor="wasteProduct">
          <SearchableSelect
            id="wasteProduct"
            options={products.map((p) => ({ id: p.productId, label: p.productName }))}
            value={productId}
            onChange={setProductId}
            placeholder="Buscar postre…"
            emptyLabel="Sin postres con ese nombre."
          />
        </FormField>
        <FormField label="Cantidad (piezas)" htmlFor="wasteProductQty">
          <Input
            id="wasteProductQty"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="tabular-nums"
          />
        </FormField>
        <FormField label="Motivo" htmlFor="wasteProductReason">
          <Input
            id="wasteProductReason"
            placeholder="Ej. se echó a perder"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canSubmit}>
          Registrar merma de postre
        </Button>
      </form>
    </Card>
  );
}

// --- Paso 4: Solicitar insumos a la matriz ----------------------------------
type ReqRow = { supplyId: string; supplyName: string; baseUnit: string; qty: string };

function RequisitionStep({
  closure,
  setClosure,
  supplies,
  skipped,
  setSkipped,
}: {
  closure: DayClosure;
  setClosure: (c: DayClosure) => void;
  supplies: Supply[];
  skipped: boolean;
  setSkipped: (v: boolean) => void;
}) {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loadedSuggestions, setLoadedSuggestions] = useState(false);
  const [addId, setAddId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (closure.supplyRequisitionId) {
      setLoadedSuggestions(true);
      return;
    }
    listRequisitionSuggestions()
      .then((sug: SupplyRequisitionSuggestion[]) => {
        setRows(
          sug.map((s) => ({
            supplyId: s.supplyId,
            supplyName: s.supplyName,
            baseUnit: s.baseUnit,
            qty: String(s.suggestedQty),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoadedSuggestions(true));
  }, [closure.supplyRequisitionId]);

  if (closure.supplyRequisitionId) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">Insumos a la matriz</h2>
        <p className="text-sm text-success">Solicitud enviada a la matriz.</p>
        <p className="mt-1 text-sm text-muted">
          El almacén central la verá en su cola de requisiciones para surtirla.
        </p>
      </Card>
    );
  }

  if (skipped) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-ink">Insumos a la matriz</h2>
        <p className="text-sm text-muted">Marcaste que no necesitas insumos hoy.</p>
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={() => setSkipped(false)}>
            Solicitar insumos de todos modos
          </Button>
        </div>
      </Card>
    );
  }

  const usedIds = new Set(rows.map((r) => r.supplyId));
  const addable = supplies.filter((s) => !usedIds.has(s.id));

  function addRow() {
    const s = supplies.find((x) => x.id === addId);
    if (!s) return;
    setRows((rs) => [...rs, { supplyId: s.id, supplyName: s.name, baseUnit: s.baseUnit, qty: '' }]);
    setAddId('');
  }

  function removeRow(supplyId: string) {
    setRows((rs) => rs.filter((r) => r.supplyId !== supplyId));
  }

  async function onSend() {
    const items = rows
      .map((r) => ({ supplyId: r.supplyId, quantityBase: Math.round(Number(r.qty)) }))
      .filter((it) => it.quantityBase > 0);
    if (items.length === 0) {
      setError('Agrega al menos un insumo con cantidad mayor a 0, o usa «Omitir».');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const detail = await createRequisition({ items });
      const c = await updateDayClosure(closure.id, {
        supplyRequisitionId: detail.requisition.id,
      });
      setClosure(c);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-ink">Insumos a la matriz</h2>
      <p className="mb-3 text-xs text-muted">
        Insumos bajo su mínimo pre-cargados con la cantidad sugerida. Ajusta o agrega los que
        necesites.
      </p>

      {!loadedSuggestions ? (
        <p className="text-sm text-muted">Cargando sugerencias…</p>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Sin sugerencias. Agrega los insumos que necesites.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Insumo</th>
                    <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.supplyId} className="align-middle text-ink">
                      <td className="px-2 py-2">{r.supplyName}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={r.qty}
                            onChange={(e) =>
                              setRows((rs) =>
                                rs.map((x) =>
                                  x.supplyId === r.supplyId ? { ...x, qty: e.target.value } : x,
                                ),
                              )
                            }
                            className="w-24 tabular-nums"
                            aria-label={`Cantidad de ${r.supplyName}`}
                          />
                          <span className="text-xs text-muted">{r.baseUnit}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(r.supplyId)}
                          className="text-sm text-muted hover:text-danger"
                          aria-label={`Quitar ${r.supplyName}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <FormField label="Agregar insumo" htmlFor="reqAdd">
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    id="reqAdd"
                    options={addable.map((s) => ({ id: s.id, label: s.name }))}
                    value={addId}
                    onChange={setAddId}
                    placeholder="Buscar insumo…"
                    emptyLabel="Sin insumos disponibles."
                  />
                </div>
                <Button type="button" variant="secondary" onClick={addRow} disabled={addId === ''}>
                  Agregar
                </Button>
              </div>
            </FormField>
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={onSend} loading={saving}>
              Enviar solicitud
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSkipped(true)}>
              Omitir, no necesito nada hoy
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// --- Paso 5: Enviar cierre --------------------------------------------------
function SubmitStep({
  closure,
  setClosure,
  done,
}: {
  closure: DayClosure;
  setClosure: (c: DayClosure) => void;
  done: Record<StepKey, boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setSaving(true);
    setError(null);
    try {
      const c = await submitDayClosure(closure.id);
      setClosure(c);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Ya estaba enviado (doble clic / carrera). Refresca al estado final.
        try {
          const fresh = await getDayClosure(closure.id);
          setClosure(fresh);
          return;
        } catch {
          /* si no se puede refrescar, cae al mensaje genérico */
        }
      }
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar el cierre.');
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const checklist: { key: StepKey; label: string }[] = [
    { key: 'cash', label: 'Corte de caja capturado' },
    { key: 'counts', label: 'Postres contados' },
    { key: 'waste', label: 'Mermas revisadas' },
    { key: 'requisition', label: 'Insumos a la matriz' },
  ];

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-ink">Enviar cierre</h2>

      <ul className="mb-4 space-y-1 text-sm">
        {checklist.map((c) => (
          <li key={c.key} className="flex items-center gap-2">
            <span className={done[c.key] ? 'text-success' : 'text-muted'}>
              {done[c.key] ? '✓' : '○'}
            </span>
            <span className={done[c.key] ? 'text-ink' : 'text-muted'}>{c.label}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-line bg-bg p-4">
        <ClosureSummary closure={closure} />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        <Button type="button" onClick={() => setConfirming(true)}>
          Enviar cierre
        </Button>
        <p className="mt-2 text-xs text-muted">
          Al enviar, el cierre queda congelado y ya no podrás editarlo.
        </p>
      </div>

      {confirming && (
        <Modal title="Enviar cierre de día" onClose={() => setConfirming(false)}>
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Esto congela el cierre de « {closure.branchName} » del {closure.closureDate}. No podrás
              editarlo después. ¿Enviar?
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={onConfirm} loading={saving}>
                Sí, enviar cierre
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
