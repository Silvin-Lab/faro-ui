'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  listPromotions,
  createPromotion,
  updatePromotion,
  archivePromotion,
  type Promotion,
  type PromotionInput,
} from '@/lib/loyalty';
import { listProducts, toPesos, type Product } from '@/lib/products';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function ProductChips({
  products,
  selected,
  onToggle,
}: {
  products: Product[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-muted">No hay productos activos.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {products.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(p.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              on
                ? 'border-accent-strong bg-accent text-ink'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {p.name} <span className={on ? 'text-ink/70' : 'text-muted'}>· ${toPesos(p.priceCents)}</span>
          </button>
        );
      })}
    </div>
  );
}

const EMPTY: PromotionInput = {
  name: '',
  discountPercent: 50,
  visitThreshold: 5,
  resetsCounter: false,
  productIds: [],
};

function PromotionModal({
  initial,
  products,
  onSave,
  onClose,
}: {
  initial: Promotion | null;
  products: Product[];
  onSave: (input: PromotionInput) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PromotionInput>(
    initial
      ? {
          name: initial.name,
          discountPercent: initial.discountPercent,
          visitThreshold: initial.visitThreshold,
          resetsCounter: initial.resetsCounter,
          productIds: initial.productIds,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<PromotionInput>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (id: string) =>
    set({
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((x) => x !== id)
        : [...form.productIds, id],
    });

  const nameInvalid = form.name.trim() === '';
  const pctInvalid = form.discountPercent < 1 || form.discountPercent > 100;
  const threshInvalid = form.visitThreshold < 1;
  const productsInvalid = form.productIds.length === 0;
  const invalid = nameInvalid || pctInvalid || threshInvalid || productsInvalid;

  async function submit() {
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, name: form.name.trim() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la promoción.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-ink">
          {initial ? 'Editar promoción' : 'Nueva promoción'}
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="pname" className="mb-1 block text-sm font-medium text-ink">
              Nombre
            </label>
            <Input
              id="pname"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ej. 50% en café"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="ppct" className="mb-1 block text-sm font-medium text-ink">
                Descuento (%)
              </label>
              <Input
                id="ppct"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={form.discountPercent}
                onChange={(e) => set({ discountPercent: Math.floor(Number(e.target.value) || 0) })}
                className="w-28"
              />
              <p className="mt-1 text-xs text-muted">100% = producto gratis</p>
            </div>
            <div>
              <label htmlFor="pthr" className="mb-1 block text-sm font-medium text-ink">
                Visitas para desbloquear
              </label>
              <Input
                id="pthr"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.visitThreshold}
                onChange={(e) => set({ visitThreshold: Math.floor(Number(e.target.value) || 0) })}
                className="w-28"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.resetsCounter}
              onChange={(e) => set({ resetsCounter: e.target.checked })}
              className="h-5 w-5 accent-accent-strong"
            />
            <span className="text-sm text-ink">
              Reinicia el contador de promociones
              <span className="ml-1 text-muted">(al aplicarla, las visitas vuelven a 0)</span>
            </span>
          </label>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              Productos elegibles
              {productsInvalid && <span className="ml-2 text-xs text-danger">Elige al menos uno</span>}
            </label>
            <ProductChips products={products} selected={form.productIds} onToggle={toggle} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" loading={saving} disabled={invalid} onClick={submit}>
            {initial ? 'Guardar cambios' : 'Crear promoción'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  const me = useUser();
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const productName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.name);
    return m;
  }, [products]);

  async function reload() {
    try {
      const items = await listPromotions(showArchived ? 'all' : 'active');
      setPromotions(items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) return;
    listProducts()
      .then((ps) => setProducts(ps.filter((p) => p.status === 'active')))
      .catch(() => {});
  }, [me.isSuperAdmin]);

  useEffect(() => {
    if (me.isSuperAdmin) return;
    setPromotions(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.isSuperAdmin, showArchived]);

  if (me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">La lealtad se configura por negocio.</p>
      </Card>
    );
  }

  async function save(input: PromotionInput) {
    if (editing) await updatePromotion(editing.id, input);
    else await createPromotion(input);
    setEditing(null);
    setCreating(false);
    await reload();
  }

  async function archive(p: Promotion) {
    setArchivingId(p.id);
    try {
      await archivePromotion(p.id);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo archivar');
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">Lealtad</h1>
        <Button onClick={() => setCreating(true)}>+ Nueva promoción</Button>
      </div>

      <Card className="bg-accent/10">
        <p className="text-sm text-ink">
          El programa de lealtad está <span className="font-medium">siempre activo</span> y las visitas
          se <span className="font-medium">comparten entre todas las sucursales</span>. Cada promoción
          otorga el descuento sobre <span className="font-medium">una unidad</span> de un producto
          elegible al alcanzar su umbral de visitas.
        </p>
      </Card>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-accent-strong"
          />
          Ver archivadas
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {promotions === null ? (
        <Card>
          <p className="text-muted">Cargando…</p>
        </Card>
      ) : promotions.length === 0 ? (
        <Card>
          <p className="text-muted">
            No hay promociones{showArchived ? '' : ' activas'}. Crea la primera para empezar.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {promotions.map((p) => {
            const archived = p.status === 'inactive';
            return (
              <li key={p.id}>
                <Card className={archived ? 'opacity-60' : ''}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-ink">{p.name}</h2>
                        {archived && (
                          <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
                            Archivada
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-medium text-ink">
                          {p.discountPercent === 100 ? 'Producto gratis' : `${p.discountPercent}% de descuento`}
                        </span>{' '}
                        al llegar a{' '}
                        <span className="font-medium text-ink">
                          {p.visitThreshold} visita{p.visitThreshold === 1 ? '' : 's'}
                        </span>
                        {p.resetsCounter && ' · reinicia el contador'}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {p.productIds.length} producto{p.productIds.length === 1 ? '' : 's'}:{' '}
                        {p.productIds
                          .map((id) => productName.get(id))
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </p>
                    </div>
                    {!archived && (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={() => setEditing(p)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          loading={archivingId === p.id}
                          onClick={() => archive(p)}
                        >
                          Archivar
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <PromotionModal
          initial={editing}
          products={products}
          onSave={save}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
