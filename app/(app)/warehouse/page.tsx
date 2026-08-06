'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import {
  listWarehouseStock,
  updateWarehouseMinMax,
  adjustWarehouseStock,
  type WarehouseStockItem,
} from '@/lib/warehouse';
import { listSupplies, listSupplyCategories, formatBase, type SupplyCategory } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Deriva el badge localmente tras un ajuste manual (misma regla del backend,
// handoff §2.1): below_min si min definido y stock≤min; no_min si min null; ok.
function deriveStatus(
  stockBase: number,
  minQuantity: number | null,
): WarehouseStockItem['status'] {
  if (minQuantity === null) return 'no_min';
  return stockBase <= minQuantity ? 'below_min' : 'ok';
}

// Badge derivado del `status` que envía el backend (handoff §2.1).
function StockStatusBadge({ status }: { status: WarehouseStockItem['status'] }) {
  if (status === 'below_min') return <StatusBadge variant="danger">Bajo mínimo</StatusBadge>;
  if (status === 'no_min') return <StatusBadge variant="muted">Sin mínimo</StatusBadge>;
  return <StatusBadge variant="accent">OK</StatusBadge>;
}

export default function WarehousePage() {
  const me = useUser();
  const [items, setItems] = useState<WarehouseStockItem[]>([]);
  const [cats, setCats] = useState<SupplyCategory[]>([]);
  const [catMap, setCatMap] = useState<Record<string, string | null>>({}); // supplyId → categoryId
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all'); // 'all' | 'none' | categoryId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    listWarehouseStock()
      .then((its) => {
        setItems(its);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar el almacén'))
      .finally(() => setLoading(false));
    // Categorías + mapa insumo→categoría para el filtro (reusa el de /supplies).
    // Si falla, el filtro degrada a "Todas" y la tabla sigue funcionando.
    listSupplyCategories()
      .then((c) => setCats([...c].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => setCats([]));
    listSupplies()
      .then((sups) =>
        setCatMap(Object.fromEntries(sups.map((s) => [s.id, s.categoryId]))),
      )
      .catch(() => setCatMap({}));
  }, [me.isSuperAdmin]);

  const belowMin = items.filter((i) => i.status === 'below_min').length;

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchesName = i.name.toLowerCase().includes(q.trim().toLowerCase());
        const categoryId = catMap[i.supplyId] ?? null;
        const matchesCat =
          cat === 'all' || (cat === 'none' ? categoryId === null : categoryId === cat);
        return matchesName && matchesCat;
      }),
    [items, q, cat, catMap],
  );

  function onSaved(updated: WarehouseStockItem) {
    setItems((prev) => prev.map((i) => (i.supplyId === updated.supplyId ? updated : i)));
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Almacén</h1>
        <p className="mt-1 text-xs text-muted">
          Existencias del almacén central. Usa <span className="text-ink">Ajustar existencia</span>{' '}
          para fijar cuánto tienes físicamente ahorita (conteo manual); no es una compra ni una
          salida — esos flujos viven en{' '}
          <Link href="/warehouse/purchases" className="underline hover:text-ink">
            Compras
          </Link>
          ,{' '}
          <Link href="/warehouse/dispatches" className="underline hover:text-ink">
            Salidas
          </Link>{' '}
          y{' '}
          <Link href="/warehouse/waste" className="underline hover:text-ink">
            Mermas
          </Link>
          .
        </p>
      </div>

      {belowMin > 0 && (
        <Alert
          variant="warning"
          action={
            <Link
              href="/warehouse/to-buy"
              className="text-sm font-medium text-ink underline hover:text-accent-strong"
            >
              Ver qué comprar →
            </Link>
          }
        >
          {belowMin} {belowMin === 1 ? 'insumo' : 'insumos'} en o por debajo de su mínimo.
        </Alert>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:flex-1"
            aria-label="Buscar insumo por nombre"
          />
          <Select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filtrar por categoría"
            className="sm:w-56"
          >
            <option value="all">Todas las categorías</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Sin categoría</option>
          </Select>
        </div>

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            Aún no hay insumos en el catálogo. Créalos en{' '}
            <Link href="/supplies" className="underline hover:text-ink">
              Insumos
            </Link>
            .
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 text-right font-medium">Stock</th>
                  <th className="px-2 py-2 font-medium">Mín</th>
                  <th className="px-2 py-2 font-medium">Máx</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Ajustar existencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item) => (
                  <StockRow key={item.supplyId} item={item} onSaved={onSaved} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-sm text-muted">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// Fila con edición inline de mín/máx. Persiste al blur o Enter vía PATCH, con
// validación suave `máx ≥ mín` (border-danger + mensaje) y feedback sutil sin
// recargar toda la tabla.
function StockRow({
  item,
  onSaved,
}: {
  item: WarehouseStockItem;
  onSaved: (updated: WarehouseStockItem) => void;
}) {
  const [min, setMin] = useState(item.minQuantity === null ? '' : String(item.minQuantity));
  const [max, setMax] = useState(item.maxQuantity === null ? '' : String(item.maxQuantity));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Ajuste manual de existencia (fijar el stock físico actual). Independiente de
  // la edición de mín/máx: escribe cuánto hay ahorita y confirma.
  const [adjust, setAdjust] = useState(String(item.stockBase));
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);
  const [adjustErr, setAdjustErr] = useState<string | null>(null);

  const parse = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    const n = Math.round(Number(t));
    return Number.isFinite(n) ? n : null;
  };

  async function persist() {
    const minVal = parse(min);
    const maxVal = parse(max);
    // Sin cambios respecto a lo persistido → no llamar a la API.
    if (minVal === item.minQuantity && maxVal === item.maxQuantity) {
      setErr(null);
      return;
    }
    // Validación suave: negativos y máx≥mín antes de enviar.
    if ((minVal !== null && minVal < 0) || (maxVal !== null && maxVal < 0)) {
      setErr('No se admiten valores negativos.');
      return;
    }
    if (minVal !== null && maxVal !== null && maxVal < minVal) {
      setErr('El máximo no puede ser menor que el mínimo.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const updated = await updateWarehouseMinMax(item.supplyId, {
        minQuantity: minVal,
        maxQuantity: maxVal,
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  async function confirmAdjust() {
    const t = adjust.trim();
    if (t === '') return;
    const n = Math.round(Number(t));
    if (!Number.isFinite(n) || n < 0) {
      setAdjustErr('Escribe una cantidad válida (0 o más).');
      setAdjustMsg(null);
      return;
    }
    setAdjusting(true);
    setAdjustErr(null);
    setAdjustMsg(null);
    try {
      const { movement, stockBase } = await adjustWarehouseStock(item.supplyId, n);
      onSaved({ ...item, stockBase, status: deriveStatus(stockBase, item.minQuantity) });
      setAdjust(String(stockBase));
      setAdjustMsg(
        movement === null
          ? 'Sin cambios: ya tenías esa existencia.'
          : `Existencia fijada en ${formatBase(stockBase)} ${item.baseUnit}.`,
      );
      setTimeout(() => setAdjustMsg(null), 2500);
    } catch (e) {
      setAdjustErr(e instanceof ApiError ? e.message : 'No se pudo ajustar.');
    } finally {
      setAdjusting(false);
    }
  }

  const invalid = err !== null;

  return (
    <tr className="align-top text-ink">
      <td className="px-2 py-2">{item.name}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
        {formatBase(item.stockBase)} {item.baseUnit}
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={persist}
          onKeyDown={onKeyDown}
          disabled={saving}
          aria-label={`Mínimo de ${item.name}`}
          className={`w-24 tabular-nums ${invalid ? 'border-danger' : ''}`}
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={persist}
          onKeyDown={onKeyDown}
          disabled={saving}
          aria-label={`Máximo de ${item.name}`}
          className={`w-24 tabular-nums ${invalid ? 'border-danger' : ''}`}
        />
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <StockStatusBadge status={item.status} />
          {saving && <span className="text-xs text-muted">Guardando…</span>}
          {saved && <span className="text-xs text-success">Guardado</span>}
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            placeholder="Cuánto hay"
            value={adjust}
            onChange={(e) => {
              setAdjust(e.target.value);
              setAdjustErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmAdjust();
              }
            }}
            disabled={adjusting}
            aria-label={`Fijar existencia actual de ${item.name} en ${item.baseUnit}`}
            className={`w-28 tabular-nums ${adjustErr ? 'border-danger' : ''}`}
          />
          <Button
            type="button"
            variant="outline"
            loading={adjusting}
            disabled={adjust.trim() === ''}
            onClick={() => void confirmAdjust()}
          >
            Fijar
          </Button>
        </div>
        {adjustErr && <p className="mt-1 text-xs text-danger">{adjustErr}</p>}
        {adjustMsg && <p className="mt-1 text-xs text-success">{adjustMsg}</p>}
      </td>
    </tr>
  );
}
