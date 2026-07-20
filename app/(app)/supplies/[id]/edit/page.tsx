'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import {
  getSupply,
  updateSupply,
  listMovements,
  createMovement,
  listSupplyCategories,
  createMeasure,
  updateMeasure,
  deleteMeasure,
  movementTypeLabel,
  formatSigned,
  formatBase,
  type Supply,
  type SupplyMovement,
  type SupplyCategory,
  type SupplyMeasure,
  type BaseUnit,
} from '@/lib/supplies';
import { toCents, toPesos } from '@/lib/products';
import { listBranches, type Branch } from '@/lib/branches';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SupplyCategorySelect } from '@/components/SupplyCategorySelect';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type DataForm = {
  name: string;
  packageName: string;
  packageContent: string;
  packageCost: string;
  categoryId: string;
};

export default function EditSupplyPage() {
  const router = useRouter();
  const me = useUser();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [supply, setSupply] = useState<Supply | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [movements, setMovements] = useState<SupplyMovement[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Datos ---
  const [dataForm, setDataForm] = useState<DataForm | null>(null);
  const [savingData, setSavingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // --- Entrada de compra ---
  const [purchase, setPurchase] = useState({ branchId: '', packages: '' });
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // --- Ajuste / merma ---
  const [adjust, setAdjust] = useState({ branchId: '', quantityBase: '', reason: '' });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const refreshMovements = useCallback(async () => {
    try {
      setMovements(await listMovements(id));
    } catch {
      /* el historial degrada silenciosamente; la carga inicial ya reporta errores */
    }
  }, [id]);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    Promise.all([getSupply(id), listBranches(true), listSupplyCategories().catch(() => [])])
      .then(([s, b, cats]) => {
        setSupply(s);
        setDataForm({
          name: s.name,
          packageName: s.packageName,
          packageContent: String(s.packageContent),
          packageCost: (s.packageCostCents ?? null) === null ? '' : toPesos(s.packageCostCents as number),
          categoryId: s.categoryId ?? '',
        });
        // Categorías activas para elegir + la categoría actual del insumo aunque
        // esté inactiva, para no perder la selección vigente en el select.
        const active = cats.filter((c) => c.status === 'active');
        const current = cats.find((c) => c.id === s.categoryId);
        const list = current && current.status !== 'active' ? [...active, current] : active;
        setCategories(list.sort((a, c) => a.sortOrder - c.sortOrder));
        setBranches(b);
        const firstBranch = b[0]?.id ?? '';
        setPurchase((p) => ({ ...p, branchId: firstBranch }));
        setAdjust((a) => ({ ...a, branchId: firstBranch }));
      })
      .catch(() => setLoadError('No se pudo cargar el insumo'));
    void refreshMovements();
  }, [id, me.isSuperAdmin, refreshMovements]);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los insumos.</p>
      </Card>
    );
  }

  if (loadError && !supply) {
    return (
      <Card>
        <p className="text-sm text-danger">{loadError}</p>
      </Card>
    );
  }

  if (!supply || !dataForm) {
    return (
      <Card>
        <p className="text-muted">Cargando…</p>
      </Card>
    );
  }

  async function onSaveData(e: React.FormEvent) {
    e.preventDefault();
    if (!dataForm) return;
    setSavingData(true);
    setDataError(null);
    try {
      const updated = await updateSupply(id, {
        name: dataForm.name,
        packageName: dataForm.packageName,
        packageContent: Math.round(Number(dataForm.packageContent)),
        packageCostCents: dataForm.packageCost.trim() === '' ? null : toCents(dataForm.packageCost),
        categoryId: dataForm.categoryId || null,
      });
      setSupply(updated);
    } catch (err) {
      setDataError(err instanceof ApiError ? err.message : 'Error al guardar los datos');
    } finally {
      setSavingData(false);
    }
  }

  async function onPurchase(e: React.FormEvent) {
    e.preventDefault();
    setSavingPurchase(true);
    setPurchaseError(null);
    try {
      await createMovement(id, {
        type: 'purchase',
        branchId: purchase.branchId,
        packages: Math.round(Number(purchase.packages)),
      });
      setPurchase((p) => ({ ...p, packages: '' }));
      await refreshMovements();
    } catch (err) {
      setPurchaseError(err instanceof ApiError ? err.message : 'Error al registrar la compra');
    } finally {
      setSavingPurchase(false);
    }
  }

  async function onAdjust(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdjust(true);
    setAdjustError(null);
    try {
      await createMovement(id, {
        type: 'adjustment',
        branchId: adjust.branchId,
        quantityBase: Math.round(Number(adjust.quantityBase)),
        reason: adjust.reason,
      });
      setAdjust((a) => ({ ...a, quantityBase: '', reason: '' }));
      await refreshMovements();
    } catch (err) {
      setAdjustError(err instanceof ApiError ? err.message : 'Error al registrar el ajuste');
    } finally {
      setSavingAdjust(false);
    }
  }

  const unit = supply.baseUnit;
  const packages = Math.round(Number(purchase.packages));
  const canPurchase = purchase.branchId !== '' && packages > 0 && !savingPurchase;
  const adjustQty = Math.round(Number(adjust.quantityBase));
  const canAdjust =
    adjust.branchId !== '' && adjustQty !== 0 && adjust.reason.trim() !== '' && !savingAdjust;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Editar insumo</h1>
        <Button variant="ghost" onClick={() => router.push('/supplies')}>
          Volver
        </Button>
      </div>

      {/* Datos */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Datos</h2>
        <form onSubmit={onSaveData} className="space-y-3">
          <FormField label="Nombre" htmlFor="name">
            <Input
              id="name"
              value={dataForm.name}
              onChange={(e) => setDataForm({ ...dataForm, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Categoría" htmlFor="categoryId">
            <SupplyCategorySelect
              id="categoryId"
              categories={categories}
              value={dataForm.categoryId}
              onChange={(categoryId) => setDataForm({ ...dataForm, categoryId })}
              onCreated={(c) => setCategories((prev) => [...prev, c])}
            />
          </FormField>
          <FormField label="Unidad base">
            <div className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-muted">
              {unit} · no se puede cambiar
            </div>
          </FormField>
          <FormField label="Nombre de la presentación" htmlFor="packageName">
            <Input
              id="packageName"
              value={dataForm.packageName}
              onChange={(e) => setDataForm({ ...dataForm, packageName: e.target.value })}
              required
            />
          </FormField>
          <FormField label={`Contenido de la presentación (${unit})`} htmlFor="packageContent">
            <Input
              id="packageContent"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={dataForm.packageContent}
              onChange={(e) => setDataForm({ ...dataForm, packageContent: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Costo de la presentación (pesos)" htmlFor="packageCost">
            <Input
              id="packageCost"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Ej. 85.00"
              value={dataForm.packageCost}
              onChange={(e) => setDataForm({ ...dataForm, packageCost: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">Opcional. Déjalo vacío si no lo tienes.</p>
          </FormField>
          {dataError && <p className="text-sm text-danger">{dataError}</p>}
          <Button type="submit" loading={savingData}>
            Guardar datos
          </Button>
        </form>
      </Card>

      {/* Medidas de uso */}
      <MeasuresSection supplyId={id} unit={unit} initial={supply.measures ?? []} />

      {/* Entrada de compra */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">Entrada de compra</h2>
        <p className="mb-3 text-xs text-muted">
          Cada presentación ({supply.packageName}) suma {supply.packageContent} {unit} al stock de la
          sucursal elegida.
        </p>
        <form onSubmit={onPurchase} className="space-y-3">
          <FormField label="Sucursal" htmlFor="purchaseBranch">
            <select
              id="purchaseBranch"
              className={selectClass}
              value={purchase.branchId}
              onChange={(e) => setPurchase({ ...purchase, branchId: e.target.value })}
              required
            >
              <option value="" disabled>
                Selecciona una sucursal…
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={`Presentaciones (${supply.packageName})`} htmlFor="packages">
            <Input
              id="packages"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              placeholder="Ej. 2"
              value={purchase.packages}
              onChange={(e) => setPurchase({ ...purchase, packages: e.target.value })}
            />
          </FormField>
          {packages > 0 && (
            <p className="text-xs text-muted">
              Entran {packages * supply.packageContent} {unit}.
            </p>
          )}
          {purchaseError && <p className="text-sm text-danger">{purchaseError}</p>}
          <Button type="submit" loading={savingPurchase} disabled={!canPurchase}>
            Registrar compra
          </Button>
        </form>
      </Card>

      {/* Ajuste / merma */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-ink">Ajuste / merma</h2>
        <p className="mb-3 text-xs text-muted">
          Cantidad firmada en {unit}: negativa para salidas (merma, cortesía), positiva para
          correcciones. El stock puede quedar negativo.
        </p>
        <form onSubmit={onAdjust} className="space-y-3">
          <FormField label="Sucursal" htmlFor="adjustBranch">
            <select
              id="adjustBranch"
              className={selectClass}
              value={adjust.branchId}
              onChange={(e) => setAdjust({ ...adjust, branchId: e.target.value })}
              required
            >
              <option value="" disabled>
                Selecciona una sucursal…
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={`Cantidad firmada (${unit})`} htmlFor="adjustQty">
            <Input
              id="adjustQty"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="Ej. -10"
              value={adjust.quantityBase}
              onChange={(e) => setAdjust({ ...adjust, quantityBase: e.target.value })}
            />
          </FormField>
          <FormField label="Motivo" htmlFor="reason">
            <Input
              id="reason"
              placeholder="Ej. cortesía, merma, corrección"
              value={adjust.reason}
              onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
              required
            />
          </FormField>
          {adjustError && <p className="text-sm text-danger">{adjustError}</p>}
          <Button type="submit" loading={savingAdjust} disabled={!canAdjust}>
            Registrar ajuste
          </Button>
        </form>
      </Card>

      {/* Historial de movimientos */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Historial de movimientos</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-muted">Sin movimientos registrados.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Tipo</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 font-medium">Sucursal</th>
                  <th className="px-2 py-2 font-medium">Motivo</th>
                  <th className="px-2 py-2 font-medium">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {movements.map((m) => (
                  <tr key={m.id} className="text-ink">
                    <td className="whitespace-nowrap px-2 py-2 text-muted">
                      {dateTimeLabel(m.createdAt)}
                    </td>
                    <td className="px-2 py-2">{movementTypeLabel(m.type)}</td>
                    <td
                      className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${
                        m.quantityBase < 0 ? 'text-danger' : 'text-ink'
                      }`}
                    >
                      {formatSigned(m.quantityBase)} {unit}
                    </td>
                    <td className="px-2 py-2">{m.branchName}</td>
                    <td className="px-2 py-2 text-muted">{m.reason ?? '—'}</td>
                    <td className="px-2 py-2 text-muted">{m.createdByName ?? 'Sistema'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Sección "Medidas de uso" ---
// Mini-CRUD de las medidas del insumo (ej. "scoop" = 25 g). La equivalencia se
// captura en la unidad base del insumo. Al borrar una medida, las recetas que la
// usaban conservan su cantidad ya calculada en la unidad base.
function measureErrMsg(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'name_taken') return 'Ya existe una medida con ese nombre.';
    return err.message;
  }
  return 'Ocurrió un error.';
}

function MeasuresSection({
  supplyId,
  unit,
  initial,
}: {
  supplyId: string;
  unit: BaseUnit;
  initial: SupplyMeasure[];
}) {
  const [measures, setMeasures] = useState<SupplyMeasure[]>(initial);

  // Alta
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edición inline (una fila a la vez)
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.round(Number(addQty));
    if (addName.trim() === '' || !Number.isFinite(qty) || qty <= 0) return;
    setAdding(true);
    setAddError(null);
    try {
      const m = await createMeasure(supplyId, { name: addName.trim(), baseQuantity: qty });
      setMeasures((prev) => [...prev, m]);
      setAddName('');
      setAddQty('');
    } catch (err) {
      // Conserva lo escrito para que el usuario corrija el nombre repetido.
      setAddError(measureErrMsg(err));
    } finally {
      setAdding(false);
    }
  }

  function startEdit(m: SupplyMeasure) {
    setEditId(m.id);
    setEditName(m.name);
    setEditQty(String(m.baseQuantity));
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditError(null);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    const qty = Math.round(Number(editQty));
    if (editName.trim() === '' || !Number.isFinite(qty) || qty <= 0) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateMeasure(editId, { name: editName.trim(), baseQuantity: qty });
      setMeasures((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditId(null);
    } catch (err) {
      setEditError(measureErrMsg(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDelete(m: SupplyMeasure) {
    if (
      !window.confirm(
        `¿Borrar la medida "${m.name}"? Las recetas que la usaban conservan su cantidad en ${unit}.`,
      )
    )
      return;
    setDeletingId(m.id);
    try {
      await deleteMeasure(m.id);
      setMeasures((prev) => prev.filter((x) => x.id !== m.id));
      if (editId === m.id) setEditId(null);
    } catch {
      /* si falla, la medida sigue en la lista; el usuario puede reintentar */
    } finally {
      setDeletingId(null);
    }
  }

  const addQtyNum = Math.round(Number(addQty));
  const canAdd = addName.trim() !== '' && addQtyNum > 0 && !adding;

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-ink">Medidas de uso</h2>
      <p className="mb-3 text-xs text-muted">
        Formas de dosificar este insumo en las recetas (ej. una cucharada, un scoop). Cada medida
        equivale a una cantidad en {unit}. Al borrar una medida, las recetas que la usaban conservan
        su cantidad ya calculada en {unit}.
      </p>

      {measures.length === 0 ? (
        <p className="mb-3 text-sm text-muted">Sin medidas. Este insumo se captura en {unit}.</p>
      ) : (
        <ul className="mb-4 divide-y divide-line">
          {measures.map((m) =>
            editId === m.id ? (
              <li key={m.id} className="py-3">
                <form onSubmit={onSaveEdit} className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`m-name-${m.id}`} className="mb-1 block text-xs text-muted">
                        Nombre
                      </label>
                      <Input
                        id={`m-name-${m.id}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <label htmlFor={`m-qty-${m.id}`} className="mb-1 block text-xs text-muted">
                        Equivale ({unit})
                      </label>
                      <Input
                        id={`m-qty-${m.id}`}
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                      />
                    </div>
                  </div>
                  {editError && <p className="text-sm text-danger">{editError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" loading={savingEdit}>
                      Guardar
                    </Button>
                    <Button type="button" variant="ghost" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={m.id} className="flex items-center justify-between gap-2 py-3">
                <span className="min-w-0 text-sm text-ink">
                  <span className="font-medium">1 {m.name}</span>{' '}
                  <span className="text-muted">
                    = {formatBase(m.baseQuantity)} {unit}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" onClick={() => startEdit(m)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={deletingId === m.id}
                    onClick={() => onDelete(m)}
                    aria-label={`Borrar la medida ${m.name}`}
                  >
                    Borrar
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form onSubmit={onAdd} className="space-y-3 border-t border-line pt-4">
        <p className="text-xs font-medium text-muted">Agregar medida</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="new-measure-name" className="mb-1 block text-xs text-muted">
              Nombre
            </label>
            <Input
              id="new-measure-name"
              placeholder="Ej. scoop, cucharada"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
          </div>
          <div className="w-28 shrink-0">
            <label htmlFor="new-measure-qty" className="mb-1 block text-xs text-muted">
              Equivale ({unit})
            </label>
            <Input
              id="new-measure-qty"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              placeholder="Ej. 25"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
            />
          </div>
        </div>
        {addName.trim() !== '' && addQtyNum > 0 && (
          <p className="text-xs text-muted">
            1 {addName.trim()} = {formatBase(addQtyNum)} {unit}
          </p>
        )}
        {addError && <p className="text-sm text-danger">{addError}</p>}
        <Button type="submit" loading={adding} disabled={!canAdd}>
          Agregar medida
        </Button>
      </form>
    </Card>
  );
}
