'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useSession } from '@/lib/user-context';
import { listProducts, toPesos, toCents, type Product } from '@/lib/products';
import { listCategories, type Category } from '@/lib/categories';
import { createSale, listSales, getSale, type Sale, type PaymentMethod } from '@/lib/sales';
import { findCustomerByPhone, searchCustomers, createCustomer, type Customer } from '@/lib/customers';
import {
  getCustomerLoyaltyStatus,
  type CustomerLoyaltyStatus,
  type PromotionStatus,
} from '@/lib/loyalty';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/Avatar';

type CartLine = { product: Product; qty: number };

// Denominaciones de billete disponibles (pesos).
const DENOMS = [10, 20, 50, 100, 200, 500];

// Sugerencias de "monto recibido" a partir del total: incluye el exacto, los
// redondeos a $50/$100, los billetes que cubren de un solo y múltiplos de $100.
function paymentSuggestions(totalCents: number): number[] {
  if (totalCents <= 0) return [];
  const out = new Set<number>();
  out.add(totalCents); // pago exacto
  const roundUp = (stepPesos: number) => Math.ceil(totalCents / (stepPesos * 100)) * (stepPesos * 100);
  out.add(roundUp(50));
  out.add(roundUp(100));
  for (const d of DENOMS) {
    if (d * 100 >= totalCents) out.add(d * 100); // un billete que cubre
  }
  for (let m = 100; m <= 500; m += 100) {
    if (m * 100 >= totalCents) out.add(m * 100); // múltiplos de $100 hasta $500
  }
  return [...out]
    .filter((x) => x >= totalCents)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

// Formatea un monto en centavos: sin decimales si es entero.
function fmtAmount(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export default function PosPage() {
  const me = useUser();
  const session = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paid, setPaid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<Sale | null>(null);
  const [recent, setRecent] = useState<Sale[] | null>(null);
  const [qtyModal, setQtyModal] = useState<{ product: Product; qty: number } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [afterSale, setAfterSale] = useState(false);
  const [loyaltyStatus, setLoyaltyStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null); // promotionProductId (unidad)

  // M7 v2: sucursal activa (de la sesión) para el encabezado "Faro. {sucursal}".
  const branchName = useMemo(
    () => session.branches.find((b) => b.id === session.activeBranchId)?.name ?? null,
    [session.branches, session.activeBranchId],
  );
  const canSwitchBranch = session.branches.length > 1;

  useEffect(() => {
    if (!me.isSuperAdmin) {
      listProducts()
        .then((p) => setProducts(p.filter((x) => x.status === 'active')))
        .catch(() => setError('No se pudieron cargar los productos'));
      listCategories()
        .then((c) => setCats(c.filter((x) => x.status === 'active')))
        .catch(() => {});
    }
  }, [me.isSuperAdmin]);

  // Al cambiar de cliente (o quitarlo) se descarta la promoción seleccionada y se
  // recarga el estado de lealtad del nuevo cliente.
  useEffect(() => {
    setSelectedPromotionId(null);
    setSelectedProductId(null);
    setLoyaltyStatus(null);
    if (!customer) return;
    let cancelled = false;
    getCustomerLoyaltyStatus(customer.id)
      .then((s) => {
        if (!cancelled) setLoyaltyStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customer]);

  // Bloquea el scroll del documento mientras el POS está montado, fijando la
  // cadena de altura (html/body al 100%) para que `h-full` del root encadene
  // contra el layout viewport estable de iOS y no aparezca la banda arrastrable.
  // No aplica en superadmin (renderiza un mensaje corto que sí debe scrollear).
  useEffect(() => {
    if (me.isSuperAdmin) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlH: html.style.height,
      htmlO: html.style.overflow,
      bodyH: body.style.height,
      bodyO: body.style.overflow,
      bodyOB: body.style.overscrollBehavior,
    };
    html.style.height = '100%';
    html.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.height = prev.htmlH;
      html.style.overflow = prev.htmlO;
      body.style.height = prev.bodyH;
      body.style.overflow = prev.bodyO;
      body.style.overscrollBehavior = prev.bodyOB;
    };
  }, [me.isSuperAdmin]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (activeCat === 'all' || p.categoryId === activeCat) && (q === '' || p.name.toLowerCase().includes(q)),
    );
  }, [products, activeCat, search]);

  const lines = Object.values(cart);
  const subtotalCents = useMemo(() => lines.reduce((s, l) => s + l.product.priceCents * l.qty, 0), [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Promoción seleccionada (debe seguir siendo aplicable según el estado del cliente).
  const selectedPromotion: PromotionStatus | null =
    loyaltyStatus?.promotions.find((p) => p.promotionId === selectedPromotionId && p.applicableNow) ?? null;

  // Preview del descuento (el servidor es autoritativo; aquí replicamos su fórmula:
  // una unidad de un producto elegible, round(unitPrice*pct/100), acotado al subtotal).
  // Si el producto elegido no está en el carrito, se usa el elegible de mayor precio
  // presente; si ninguno está en el carrito, no hay descuento (se cobra normal).
  let discountCents = 0;
  if (selectedPromotion) {
    const eligibleIds = new Set(selectedPromotion.products.map((p) => p.id));
    const inCart = lines.filter((l) => eligibleIds.has(l.product.id));
    let chosen: Product | null = null;
    if (selectedProductId && inCart.some((l) => l.product.id === selectedProductId)) {
      chosen = inCart.find((l) => l.product.id === selectedProductId)!.product;
    } else if (inCart.length > 0) {
      chosen = inCart.reduce((max, l) => (l.product.priceCents > max.priceCents ? l.product : max), inCart[0].product);
    }
    if (chosen) {
      discountCents = Math.round((chosen.priceCents * selectedPromotion.discountPercent) / 100);
    }
  }
  discountCents = Math.min(discountCents, subtotalCents);
  const totalCents = subtotalCents - discountCents; // total a cobrar

  const paidCents = toCents(paid);
  const changeCents = paidCents - totalCents;
  const suggestions = useMemo(() => paymentSuggestions(totalCents), [totalCents]);

  function openQty(p: Product) {
    setQtyModal({ product: p, qty: cart[p.id]?.qty ?? 1 });
  }
  function confirmQty(qty: number) {
    if (!qtyModal) return;
    const p = qtyModal.product;
    setCart((c) => ({ ...c, [p.id]: { product: p, qty } }));
    closeQty();
  }
  // Cierra el modal de cantidad y limpia el buscador (para volver a ver todos
  // los productos sin la búsqueda anterior pegada).
  function closeQty() {
    setQtyModal(null);
    setSearch('');
    setActiveCat('all');
  }
  function removeLine(p: Product) {
    setCart((c) => {
      const { [p.id]: _removed, ...rest } = c;
      return rest;
    });
    setConfirmDel(null);
  }
  function clearSale() {
    setCart({});
    setPaid('');
    setError(null);
    setMethod('cash');
    setCustomer(null);
    setSelectedPromotionId(null);
    setSelectedProductId(null);
  }

  // Deja el POS como al inicio: sin venta y con la categoría en "Todas".
  function resetSale() {
    clearSale();
    setSearch('');
    setActiveCat('all');
  }

  const canCharge = lines.length > 0 && (method === 'card' || paidCents >= totalCents);

  async function charge() {
    setSubmitting(true);
    setError(null);
    try {
      const sale = await createSale(
        lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        method,
        method === 'card' ? 0 : paidCents,
        customer?.id ?? null,
        { promotionId: selectedPromotion?.promotionId ?? null, promotionProductId: selectedProductId },
      );
      setAfterSale(true);
      setTicket(sale);
      clearSale();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'insufficient_payment') setError('El monto recibido es menor al total.');
      else if (e instanceof ApiError && e.code === 'promotion_not_eligible')
        setError('La promoción ya no es aplicable para este cliente.');
      else setError(e instanceof ApiError ? e.message : 'No se pudo cobrar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openRecent() {
    // Ventas del día (desde las 00:00 de hoy hasta mañana 00:00, hora local).
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    try {
      setRecent(await listSales({ from: start.toISOString(), to: end.toISOString() }));
    } catch {
      /* noop */
    }
  }
  async function openTicket(id: string) {
    try {
      setAfterSale(false);
      setTicket(await getSale(id));
      setRecent(null);
    } catch {
      /* noop */
    }
  }

  if (me.isSuperAdmin) {
    return <div className="p-6 text-muted">El punto de venta es por negocio.</div>;
  }

  const railCard = (a: boolean) => `rounded-lg p-1 transition-colors ${a ? 'bg-accent' : 'hover:bg-bg'}`;
  const tabItem = (a: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${a ? 'bg-accent text-ink' : 'bg-bg text-muted'}`;
  const payBtn = (a: boolean) =>
    `rounded-lg border p-4 text-center text-base font-semibold transition-colors ${
      a ? 'border-accent-strong bg-accent text-ink' : 'border-line bg-surface text-muted hover:text-ink'
    }`;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="text-xl font-bold text-ink">
          Faro<span className="text-accent-strong">.</span>{' '}
          {branchName ? (
            <span className="text-base font-semibold text-ink">{branchName}</span>
          ) : (
            <span className="text-sm font-normal text-muted">Punto de venta</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSwitchBranch && (
            <Button variant="ghost" onClick={() => router.push('/select-branch')}>
              Cambiar sucursal
            </Button>
          )}
          <Button variant="outline" onClick={openRecent}>
            Ventas del día
          </Button>
          <Button variant="ghost" onClick={() => router.push('/account')}>
            Cuenta
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            ☰ Menú
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Categorías (rail, md+): imagen arriba, nombre abajo */}
        <nav className="hidden min-h-0 w-[105px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line bg-surface p-2 md:flex">
          <p className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted">Categorías</p>
          <button className={railCard(activeCat === 'all')} onClick={() => setActiveCat('all')}>
            <div className="flex aspect-square w-full items-center justify-center rounded-md bg-bg text-sm font-medium text-ink">
              Todas
            </div>
          </button>
          {cats.map((c) => (
            <button key={c.id} className={railCard(activeCat === c.id)} onClick={() => setActiveCat(c.id)}>
              <Avatar
                name={c.name}
                imageUrl={c.imageUrl}
                fit="contain"
                className="aspect-square w-full rounded-md bg-bg"
                initialsClass="text-base"
              />
              <span className="mt-1 block truncate text-center text-xs text-ink">{c.name}</span>
            </button>
          ))}
        </nav>

        {/* Productos */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
          <Input
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="mb-3 flex gap-2 overflow-x-auto md:hidden">
            <button className={tabItem(activeCat === 'all')} onClick={() => setActiveCat('all')}>
              Todas
            </button>
            {cats.map((c) => (
              <button key={c.id} className={tabItem(activeCat === c.id)} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 content-start grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredProducts.map((p) => {
              return (
                <button
                  key={p.id}
                  onClick={() => openQty(p)}
                  className="overflow-hidden rounded-md border border-line bg-surface text-left transition-colors hover:border-accent-strong"
                >
                  <Avatar
                    name={p.name}
                    imageUrl={p.imageUrl}
                    fit="cover"
                    maxInitials={2}
                    className="aspect-square w-full bg-bg"
                    initialsClass="text-lg"
                  />
                  <div className="p-1.5">
                    <div className="truncate text-xs font-medium text-ink">{p.name}</div>
                    <div className="text-[11px] text-muted">${toPesos(p.priceCents)}</div>
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && <p className="text-sm text-muted">No hay productos.</p>}
          </div>
        </section>

        {/* Carrito / cobro */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-line bg-surface p-4 md:w-96 md:border-l md:border-t-0">
          <h2 className="mb-3 text-lg font-semibold text-ink">Venta</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted">Toca un producto para agregarlo…</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.product.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{l.product.name}</span>
                    <span className="text-xs text-muted">
                      {l.qty} × ${toPesos(l.product.priceCents)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">
                    ${toPesos(l.product.priceCents * l.qty)}
                  </span>
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => openQty(l.product)}
                      aria-label={`Editar ${l.product.name}`}
                      className="flex h-10 w-8 items-center justify-center text-muted transition-colors hover:text-ink"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDel(l.product)}
                      aria-label={`Eliminar ${l.product.name}`}
                      className="flex h-10 w-8 items-center justify-center text-muted transition-colors hover:text-danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                        <path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Cliente (lealtad) */}
          <div className="mt-4 rounded-lg border border-line p-2 text-sm">
            {customer ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-ink">
                    👤 {customer.firstName} {customer.lastName}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs">
                    <button
                      className="text-muted hover:text-accent-strong disabled:opacity-50"
                      onClick={() => setDetailModal(true)}
                      disabled={!loyaltyStatus}
                    >
                      Ver detalle
                    </button>
                    <button className="text-muted hover:text-danger" onClick={() => setCustomer(null)}>
                      Quitar
                    </button>
                  </span>
                </div>
                <div className="text-xs text-muted">
                  Visitas: <span className="font-semibold text-ink">{loyaltyStatus?.visits ?? customer.visits}</span>
                  {loyaltyStatus && (
                    <span className="ml-2">
                      · De por vida: <span className="font-semibold text-ink">{loyaltyStatus.visitsLifetime}</span>
                    </span>
                  )}
                </div>

                {selectedPromotion ? (
                  <div className="rounded-md border border-accent-strong bg-accent/20 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium text-ink">
                        ✓ {selectedPromotion.name}
                        <span className="ml-1 font-normal text-muted">
                          ({selectedPromotion.discountPercent === 100
                            ? 'gratis'
                            : `${selectedPromotion.discountPercent}%`}
                          )
                        </span>
                      </span>
                      <button
                        className="shrink-0 text-muted hover:text-danger"
                        onClick={() => {
                          setSelectedPromotionId(null);
                          setSelectedProductId(null);
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                    {discountCents === 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        Agrega un producto elegible al carrito para aplicar el descuento.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    className="w-full rounded-md border border-line px-2 py-1.5 text-xs text-ink transition-colors hover:border-accent-strong disabled:opacity-50"
                    onClick={() => setDetailModal(true)}
                    disabled={!loyaltyStatus}
                  >
                    {loyaltyStatus?.promotions.some((p) => p.applicableNow)
                      ? '🎁 Hay promociones disponibles — ver detalle'
                      : 'Ver promociones del cliente'}
                  </button>
                )}
              </div>
            ) : (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-md border border-accent-strong bg-accent px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-accent-strong"
                onClick={() => setCustomerModal(true)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="shrink-0"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Asociar cliente
              </button>
            )}
          </div>

          {discountCents > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>${toPesos(subtotalCents)}</span>
              </div>
              <div className="flex justify-between font-medium text-accent-strong">
                <span className="min-w-0 truncate pr-2">
                  {selectedPromotion?.name ?? 'Descuento lealtad'}
                </span>
                <span>−${toPesos(discountCents)}</span>
              </div>
            </div>
          )}
          <div
            className={`${discountCents > 0 ? 'mt-1' : 'mt-4'} flex items-center justify-between rounded-lg bg-accent/25 px-4 py-2`}
          >
            <span className="text-sm font-medium uppercase tracking-wide text-ink">Total</span>
            <span className="text-2xl font-bold text-ink">${toPesos(totalCents)}</span>
          </div>

          <p className="mb-2 mt-4 text-sm font-medium text-ink">Forma de pago</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={payBtn(method === 'cash')} onClick={() => setMethod('cash')}>
              💵 Efectivo
            </button>
            <button className={payBtn(method === 'card')} onClick={() => setMethod('card')}>
              💳 Tarjeta
            </button>
          </div>

          {method === 'cash' && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-ink">Monto recibido</p>
              {suggestions.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {suggestions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPaid(String(c / 100))}
                      className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                        paidCents === c
                          ? 'border-accent-strong bg-accent text-ink'
                          : 'border-line bg-bg text-ink hover:border-accent-strong'
                      }`}
                    >
                      ${fmtAmount(c)}
                    </button>
                  ))}
                </div>
              )}
              <label htmlFor="paid" className="block text-xs text-muted">
                …u otro monto:
              </label>
              <Input
                id="paid"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
              <div className="rounded-lg bg-bg p-4 text-center">
                <div className="text-sm text-muted">Cambio</div>
                <div className={`text-4xl font-bold ${changeCents >= 0 ? 'text-success' : 'text-danger'}`}>
                  ${toPesos(Math.abs(changeCents))}
                </div>
                {changeCents < 0 && <div className="text-sm text-danger">Falta para completar el pago</div>}
              </div>
            </div>
          )}
          {method === 'card' && (
            <p className="mt-3 rounded-lg bg-bg p-4 text-center text-sm text-muted">
              Se cobrará <span className="font-semibold text-ink">${toPesos(totalCents)}</span> con tarjeta.
            </p>
          )}

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <Button className="mt-4 w-full" loading={submitting} disabled={!canCharge} onClick={charge}>
            Cobrar
          </Button>
          {lines.length > 0 && (
            <Button variant="secondary" className="mt-2 w-full" onClick={resetSale}>
              Cancelar venta
            </Button>
          )}
        </aside>
      </div>

      {qtyModal && (
        <QuantityModal
          product={qtyModal.product}
          initial={qtyModal.qty}
          onConfirm={confirmQty}
          onCancel={closeQty}
        />
      )}
      {confirmDel && (
        <ConfirmModal name={confirmDel.name} onConfirm={() => removeLine(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
      {customerModal && (
        <CustomerModal
          onSelect={(c) => {
            setCustomer(c);
            setCustomerModal(false);
          }}
          onClose={() => setCustomerModal(false)}
        />
      )}
      {detailModal && customer && (
        <LoyaltyDetailModal
          status={loyaltyStatus}
          cartProductIds={new Set(lines.map((l) => l.product.id))}
          selectedPromotionId={selectedPromotionId}
          selectedProductId={selectedProductId}
          onApply={(promotionId, productId) => {
            setSelectedPromotionId(promotionId);
            setSelectedProductId(productId);
            setDetailModal(false);
          }}
          onRemove={() => {
            setSelectedPromotionId(null);
            setSelectedProductId(null);
          }}
          onClose={() => setDetailModal(false)}
        />
      )}
      {ticket && (
        <TicketModal
          sale={ticket}
          cashier={me.name}
          onClose={() => {
            // Al cerrar el ticket de una venta, deja el POS como al inicio.
            if (afterSale) resetSale();
            setTicket(null);
            setAfterSale(false);
          }}
        />
      )}
      {recent && <RecentModal sales={recent} onOpen={openTicket} onClose={() => setRecent(null)} />}
    </div>
  );
}

function CustomerModal({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [stage, setStage] = useState<'search' | 'register'>('search');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();

  // Búsqueda por nombre o teléfono con debounce.
  useEffect(() => {
    if (stage !== 'search') return;
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, stage]);

  // Atajo: búsqueda exacta por teléfono ("ya sé el número").
  async function exactPhone() {
    if (!/^\d+$/.test(q)) return;
    setLoading(true);
    setError(null);
    try {
      const c = await findCustomerByPhone(q);
      onSelect(c);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) startRegister();
      else setError('No se pudo buscar el cliente.');
    } finally {
      setLoading(false);
    }
  }

  function startRegister() {
    setStage('register');
    if (/^\d+$/.test(q)) setPhone(q);
    setError(null);
  }

  async function register() {
    setLoading(true);
    setError(null);
    try {
      const c = await createCustomer({ phone: phone.trim(), firstName, lastName });
      onSelect(c);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo registrar el cliente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold text-ink">Cliente</h3>

        {stage === 'search' ? (
          <>
            <label htmlFor="csearch" className="block text-sm font-medium text-ink">
              Buscar por nombre o teléfono
            </label>
            <Input
              id="csearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') exactPhone();
              }}
              placeholder="Ej. María o 5551234567"
              className="mt-1"
              autoFocus
            />

            <div className="mt-3 max-h-64 overflow-y-auto">
              {q.length < 2 ? (
                <p className="text-xs text-muted">Escribe al menos 2 caracteres…</p>
              ) : searching ? (
                <p className="text-xs text-muted">Buscando…</p>
              ) : results && results.length > 0 ? (
                <ul className="overflow-hidden rounded-md border border-line">
                  {results.map((c) => (
                    <li key={c.id} className="even:bg-bg">
                      <button
                        onClick={() => onSelect(c)}
                        className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent/20"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className="shrink-0 text-muted"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Sin coincidencias.</p>
              )}
            </div>

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" variant="outline" onClick={startRegister}>
                + Cliente nuevo
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="cphone" className="block text-sm font-medium text-ink">
                Teléfono
              </label>
              <Input
                id="cphone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
              <label htmlFor="cfirst" className="block text-sm font-medium text-ink">
                Nombre
              </label>
              <Input id="cfirst" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <label htmlFor="clast" className="block text-sm font-medium text-ink">
                Apellido
              </label>
              <Input id="clast" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                loading={loading}
                disabled={!phone.trim() || !firstName.trim() || !lastName.trim()}
                onClick={register}
              >
                Registrar y asociar
              </Button>
              <Button variant="ghost" onClick={() => setStage('search')}>
                Atrás
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoyaltyDetailModal({
  status,
  cartProductIds,
  selectedPromotionId,
  selectedProductId,
  onApply,
  onRemove,
  onClose,
}: {
  status: CustomerLoyaltyStatus | null;
  cartProductIds: Set<string>;
  selectedPromotionId: string | null;
  selectedProductId: string | null;
  onApply: (promotionId: string, productId: string | null) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Orden ascendente por visitas restantes (las aplicables primero).
  const promotions = status
    ? [...status.promotions].sort((a, b) => a.visitsRemaining - b.visitsRemaining)
    : [];

  // Promo desplegada (una a la vez): al abrir el modal, si ya hay una promo
  // aplicada a la venta, se muestra desplegada para poder revisarla/cambiarla.
  const [expandedId, setExpandedId] = useState<string | null>(selectedPromotionId);
  // Unidad beneficiada elegida dentro de la promo desplegada (aún no aplicada).
  const [chosenProductId, setChosenProductId] = useState<string | null>(
    selectedPromotionId ? selectedProductId : null,
  );

  // Producto por defecto: el elegible presente en el carrito de mayor precio;
  // si ninguno está en el carrito, el primero de la lista.
  function defaultProductId(p: PromotionStatus): string | null {
    const inCart = p.products.filter((pp) => cartProductIds.has(pp.id));
    if (inCart.length) {
      return inCart.reduce((max, pp) => (pp.priceCents > max.priceCents ? pp : max), inCart[0]).id;
    }
    return p.products[0]?.id ?? null;
  }

  function toggleExpand(p: PromotionStatus) {
    if (expandedId === p.promotionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(p.promotionId);
    // Si es la promo ya aplicada, respeta su unidad; si no, calcula el default.
    setChosenProductId(
      selectedPromotionId === p.promotionId ? selectedProductId : defaultProductId(p),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-surface p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-ink">Lealtad del cliente</h3>
        {status ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Lleva <span className="font-semibold text-ink">{status.visits}</span> visita
              {status.visits === 1 ? '' : 's'} · de por vida:{' '}
              <span className="font-semibold text-ink">{status.visitsLifetime}</span>
            </p>

            <div className="mt-4 space-y-2">
              {promotions.length === 0 && (
                <p className="text-sm text-muted">Este negocio no tiene promociones activas.</p>
              )}
              {promotions.map((p) => {
                const applied = selectedPromotionId === p.promotionId;
                const rewardText = p.discountPercent === 100 ? 'Producto gratis' : `${p.discountPercent}% de descuento`;

                // Estado: ya aplicada este ciclo (deshabilitada, en gris).
                if (p.redeemedThisCycle) {
                  return (
                    <div
                      key={p.promotionId}
                      className="rounded-md border border-line bg-bg px-3 py-2 opacity-60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-muted">{p.name}</span>
                        <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs font-medium text-muted">
                          Ya aplicada este ciclo
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{rewardText}</p>
                    </div>
                  );
                }

                // Estado: aún no alcanza el umbral (informativo).
                if (!p.applicableNow) {
                  return (
                    <div key={p.promotionId} className="rounded-md border border-line px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-ink">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          Faltan {p.visitsRemaining} visita{p.visitsRemaining === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {rewardText} · umbral {p.visitThreshold}
                      </p>
                    </div>
                  );
                }

                // Estado: disponible (expandible → lista de productos + Aplicar).
                const expanded = expandedId === p.promotionId;
                return (
                  <div
                    key={p.promotionId}
                    className={`rounded-md border transition-colors ${
                      applied ? 'border-accent-strong bg-accent/20' : 'border-line'
                    }`}
                  >
                    <button
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                      onClick={() => toggleExpand(p)}
                      aria-expanded={expanded}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {applied ? '✓ ' : ''}
                          {p.name}
                        </span>
                        <span className="text-xs text-muted">{rewardText}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {applied && (
                          <span className="rounded-full bg-accent-strong px-2 py-0.5 text-xs font-medium text-ink">
                            Aplicada
                          </span>
                        )}
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-ink">
                          Disponible
                        </span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>

                    {expanded && (
                      <div className="border-t border-line px-3 py-2">
                        {p.products.length > 0 ? (
                          <>
                            <p className="mb-1.5 text-xs text-muted">
                              Elige el producto beneficiado:
                            </p>
                            <ul className="space-y-1">
                              {p.products.map((pp) => {
                                const on = chosenProductId === pp.id;
                                const inCart = cartProductIds.has(pp.id);
                                return (
                                  <li key={pp.id}>
                                    <button
                                      onClick={() => setChosenProductId(pp.id)}
                                      aria-pressed={on}
                                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                                        on
                                          ? 'border-accent-strong bg-accent/30 text-ink'
                                          : 'border-line bg-surface text-ink hover:border-accent-strong'
                                      }`}
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <span
                                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                                            on ? 'border-accent-strong' : 'border-line'
                                          }`}
                                          aria-hidden
                                        >
                                          {on && <span className="h-2 w-2 rounded-full bg-accent-strong" />}
                                        </span>
                                        <span className="min-w-0 truncate">{pp.name}</span>
                                        {!inCart && (
                                          <span className="shrink-0 text-[10px] text-muted">(no en carrito)</span>
                                        )}
                                      </span>
                                      <span className="shrink-0 tabular-nums text-muted">
                                        ${toPesos(pp.priceCents)}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </>
                        ) : (
                          <p className="text-xs text-muted">Esta promoción no tiene productos elegibles.</p>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={!chosenProductId}
                            onClick={() => onApply(p.promotionId, chosenProductId)}
                          >
                            {applied ? 'Actualizar' : 'Aplicar'}
                          </Button>
                          {applied && (
                            <Button variant="ghost" onClick={onRemove}>
                              Quitar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Cargando…</p>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuantityModal({
  product,
  initial,
  onConfirm,
  onCancel,
}: {
  product: Product;
  initial: number;
  onConfirm: (qty: number) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(Math.max(1, initial));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="relative w-full max-w-xs rounded-lg bg-surface p-5 text-center shadow-lg">
        <Avatar
          name={product.name}
          imageUrl={product.imageUrl}
          fit="contain"
          maxInitials={2}
          className="mx-auto mb-2 h-20 w-20 overflow-hidden rounded-md border border-line bg-bg"
          initialsClass="text-lg"
        />
        <h3 className="text-lg font-semibold text-ink">{product.name}</h3>
        <p className="text-sm text-muted">${toPesos(product.priceCents)} c/u</p>

        <div className="my-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-12 w-12 rounded-lg bg-bg text-2xl text-ink"
          >
            −
          </button>
          <span className="w-12 text-3xl font-bold text-ink">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="h-12 w-12 rounded-lg bg-accent text-2xl text-ink">
            +
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Subtotal: <span className="font-semibold text-ink">${toPesos(product.priceCents * qty)}</span>
        </p>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onConfirm(qty)}>
            Agregar
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="relative w-full max-w-xs rounded-lg bg-surface p-5 shadow-lg">
        <p className="text-sm text-ink">
          ¿Eliminar <span className="font-semibold">{name}</span> de la venta?
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Eliminar
          </button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({ sale, cashier, onClose }: { sale: Sale; cashier: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="no-print absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xs rounded-lg bg-surface p-5 shadow-lg">
        <div className="ticket-print text-sm text-ink">
          <div className="text-center">
            <div className="text-lg font-bold">Faro</div>
            <div className="text-xs text-muted">Ticket de venta</div>
            <div className="text-xs text-muted">{new Date(sale.createdAt).toLocaleString()}</div>
            <div className="text-xs text-muted">Cajero: {cashier}</div>
          </div>
          <hr className="my-2 border-line" />
          <ul>
            {(sale.items ?? []).map((it) => (
              <li key={it.id} className="flex justify-between">
                <span className="truncate">
                  {it.quantity}× {it.name}
                </span>
                <span>${toPesos(it.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-2 border-line" />
          {sale.discountCents > 0 && (
            <>
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>${toPesos(sale.totalCents + sale.discountCents)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span className="min-w-0 truncate pr-2">{sale.promotionName ?? 'Descuento lealtad'}</span>
                <span>−${toPesos(sale.discountCents)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${toPesos(sale.totalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pago</span>
            <span>{sale.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}</span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between">
              <span>Cliente</span>
              <span className="truncate">{sale.customerName}</span>
            </div>
          )}
          {sale.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Recibido</span>
                <span>${toPesos(sale.amountPaidCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cambio</span>
                <span>${toPesos(sale.changeCents)}</span>
              </div>
            </>
          )}
          <div className="mt-3 text-center text-xs text-muted">¡Gracias por su compra!</div>
        </div>
        <div className="no-print mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecentModal({ sales, onOpen, onClose }: { sales: Sale[]; onOpen: (id: string) => void; onClose: () => void }) {
  const total = sales.reduce((s, x) => s + x.totalCents, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold text-ink">Ventas de hoy</h3>
        {sales.length === 0 ? (
          <p className="text-sm text-muted">Sin ventas hoy.</p>
        ) : (
          <>
            <ul className="max-h-80 divide-y divide-line overflow-auto">
              {sales.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onOpen(s.id)}
                    className="flex w-full items-center justify-between py-2 text-sm hover:text-accent-strong"
                  >
                    <span className="text-muted">
                      {new Date(s.createdAt).toLocaleTimeString()} ·{' '}
                      {s.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}
                    </span>
                    <span className="font-medium text-ink">${toPesos(s.totalCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink">
              <span>Total del día ({sales.length})</span>
              <span>${toPesos(total)}</span>
            </div>
          </>
        )}
        <Button variant="ghost" className="mt-3" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
