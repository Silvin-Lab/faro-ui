'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  searchCustomers,
  listCustomers,
  createCustomer,
  setCustomerVisits,
  getCustomerVisitChanges,
  type Customer,
  type VisitChange,
} from '@/lib/customers';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

// Traduce errores comunes del backend a mensajes claros para el operador.
function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'Ya existe un cliente con ese teléfono.';
    if (e.status === 403) return 'No tienes permiso para hacer este cambio.';
    if (e.status === 404) return 'No se encontró el cliente.';
    return e.message || fallback;
  }
  return fallback;
}

// Fila de resultado con acción "Ajustar visitas" inline (migración de tarjeta física).
// Etiqueta corta del origen de un cambio de visitas.
const VISIT_SOURCE_LABEL: Record<VisitChange['source'], string> = {
  create: 'Alta',
  adjust: 'Ajuste',
};

function CustomerRow({
  customer,
  onUpdated,
}: {
  customer: Customer;
  onUpdated: (c: Customer) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(customer.visits));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Historial de cambios de visitas (alta + ajustes), solo mientras se edita.
  const [changes, setChanges] = useState<VisitChange[] | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);

  function loadChanges() {
    setChanges(null);
    setChangesError(null);
    getCustomerVisitChanges(customer.id)
      .then(setChanges)
      .catch((e) => setChangesError(friendlyError(e, 'No se pudo cargar el historial.')));
  }

  function startEdit() {
    setValue(String(customer.visits));
    setError(null);
    setEditing(true);
    loadChanges();
  }

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setError('Escribe un número entero mayor o igual a 0.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await setCustomerVisits(customer.id, n);
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setError(friendlyError(e, 'No se pudieron ajustar las visitas.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {customer.firstName} {customer.lastName}
          </p>
          <p className="text-xs text-muted">{customer.phone}</p>
          <p className="text-xs text-muted">
            Registrado por:{' '}
            <span className="text-ink">{customer.createdByName ?? 'Sin registro'}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            Visitas (ciclo): <span className="font-medium text-ink">{customer.visits}</span>
          </span>
          <span>
            De por vida: <span className="font-medium text-ink">{customer.visitsLifetime}</span>
          </span>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="font-medium text-accent-strong hover:underline"
            >
              Ajustar visitas
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-md border border-line bg-bg p-3">
          <FormField label="Visitas del ciclo actual" htmlFor={`visits-${customer.id}`}>
            <Input
              id={`visits-${customer.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-[8rem]"
            />
          </FormField>
          <p className="text-xs text-muted">
            Usa esto para clientes que ya tenían visitas en su tarjeta física; las visitas de por
            vida nunca bajan.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <Button onClick={save} loading={busy}>
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Historial de visitas
            </p>
            {changesError ? (
              <p className="text-xs text-danger">{changesError}</p>
            ) : changes === null ? (
              <p className="text-xs text-muted">Cargando…</p>
            ) : changes.length === 0 ? (
              <p className="text-xs text-muted">Sin cambios registrados.</p>
            ) : (
              <ul className="space-y-1.5">
                {changes.map((ch) => (
                  <li
                    key={ch.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs"
                  >
                    <span className="text-ink">
                      <span className="rounded-full bg-bg px-2 py-0.5 font-medium text-muted">
                        {VISIT_SOURCE_LABEL[ch.source]}
                      </span>{' '}
                      de <span className="font-medium">{ch.visitsBefore}</span> a{' '}
                      <span className="font-medium">{ch.visitsAfter}</span>
                    </span>
                    <span className="text-muted">
                      {ch.byName ?? 'Sin registro'} ·{' '}
                      {new Date(ch.createdAt).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// Alta de cliente con visitas previas opcionales (fijadas en la misma alta).
function NewCustomerForm({
  onCreated,
  canSetPriorVisits,
}: {
  onCreated: (c: Customer) => void;
  canSetPriorVisits: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [priorVisits, setPriorVisits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFirstName('');
    setLastName('');
    setPhone('');
    setPriorVisits('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = canSetPriorVisits ? priorVisits.trim() : '';
    const visits = raw === '' ? 0 : Number(raw);
    if (raw !== '' && (!Number.isInteger(visits) || visits < 0)) {
      setError('Las visitas previas deben ser un número entero mayor o igual a 0.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Si el cliente traía visitas de su tarjeta física, se fijan en la misma alta.
      const customer = await createCustomer({
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        priorVisits: visits,
      });
      onCreated(customer);
      reset();
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err, 'No se pudo crear el cliente.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Nuevo cliente</Button>;
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-ink">Nuevo cliente</h2>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Nombre" htmlFor="new-first">
          <Input
            id="new-first"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setError(null);
            }}
            required
          />
        </FormField>
        <FormField label="Apellido" htmlFor="new-last">
          <Input
            id="new-last"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setError(null);
            }}
            required
          />
        </FormField>
        <FormField label="Teléfono" htmlFor="new-phone">
          <Input
            id="new-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            required
          />
        </FormField>
        {canSetPriorVisits && (
          <>
            <FormField label="Visitas previas (opcional)" htmlFor="new-visits">
              <Input
                id="new-visits"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={priorVisits}
                onChange={(e) => setPriorVisits(e.target.value)}
                className="max-w-[8rem]"
              />
            </FormField>
            <p className="text-xs text-muted">
              Si el cliente ya tenía visitas en su tarjeta física, indícalas aquí; se sumarán también a
              las de por vida.
            </p>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" loading={busy}>
            Crear cliente
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={busy}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const me = useUser();
  const canAccess = me.role === 'super_admin' || me.role === 'branch_admin';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listado por default (sin búsqueda): primeros 20 clientes + "Mostrar más"
  // paginado con offset. Independiente del modo búsqueda de arriba.
  const [browseItems, setBrowseItems] = useState<Customer[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false);
  const [browseHasMore, setBrowseHasMore] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const q = query.trim();
  const browsing = q.length < 2;

  useEffect(() => {
    if (!canAccess) return;
    setBrowseLoading(true);
    setBrowseError(null);
    listCustomers(PAGE_SIZE, 0)
      .then((items) => {
        setBrowseItems(items);
        setBrowseHasMore(items.length === PAGE_SIZE);
      })
      .catch((e) => setBrowseError(friendlyError(e, 'No se pudieron cargar los clientes.')))
      .finally(() => setBrowseLoading(false));
  }, [canAccess]);

  async function loadMore() {
    setBrowseLoadingMore(true);
    setBrowseError(null);
    try {
      const items = await listCustomers(PAGE_SIZE, browseItems.length);
      setBrowseItems((prev) => [...prev, ...items]);
      setBrowseHasMore(items.length === PAGE_SIZE);
    } catch (e) {
      setBrowseError(friendlyError(e, 'No se pudieron cargar más clientes.'));
    } finally {
      setBrowseLoadingMore(false);
    }
  }

  // Búsqueda por nombre o teléfono con debounce (~300ms), igual que el modal del POS.
  useEffect(() => {
    if (!canAccess) return;
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setError(null);
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch((e) => {
          if (!cancelled) {
            setResults([]);
            setError(friendlyError(e, 'No se pudo buscar clientes.'));
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, canAccess]);

  // Refleja el cliente actualizado (ajuste de visitas o alta reciente) en ambas
  // listas (búsqueda y listado por default), esté cual esté visible.
  function upsert(c: Customer) {
    const merge = (prev: Customer[]) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i === -1) return [c, ...prev];
      const next = [...prev];
      next[i] = c;
      return next;
    };
    setResults((prev) => (prev ? merge(prev) : prev));
    setBrowseItems((prev) => merge(prev));
  }

  if (!canAccess) {
    return (
      <Card>
        <p className="text-muted">No tienes acceso a esta sección.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Clientes</h1>
          <p className="text-sm text-muted">
            Busca clientes y ajusta sus visitas (migración de tarjetas físicas de lealtad).
          </p>
        </div>
        <NewCustomerForm
          onCreated={upsert}
          canSetPriorVisits={me.role === 'super_admin' || me.role === 'branch_admin'}
        />
      </div>

      <Card>
        <FormField label="Buscar por nombre o teléfono" htmlFor="customer-search">
          <Input
            id="customer-search"
            placeholder="Escribe al menos 2 caracteres…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </FormField>

        <div className="mt-4">
          {!browsing && searching && <p className="text-sm text-muted">Buscando…</p>}
          {!browsing && error && <p className="text-sm text-danger">{error}</p>}
          {!browsing && !searching && !error && results && results.length === 0 && (
            <p className="text-sm text-muted">
              No hay clientes que coincidan con “{q}”. Puedes crear uno nuevo.
            </p>
          )}
          {!browsing && results && results.length > 0 && (
            <ul className="divide-y divide-line">
              {results.map((c) => (
                <CustomerRow key={c.id} customer={c} onUpdated={upsert} />
              ))}
            </ul>
          )}

          {browsing && browseLoading && <p className="text-sm text-muted">Cargando…</p>}
          {browsing && browseError && <p className="text-sm text-danger">{browseError}</p>}
          {browsing && !browseLoading && browseItems.length === 0 && !browseError && (
            <p className="text-sm text-muted">Aún no hay clientes. Crea el primero arriba.</p>
          )}
          {browsing && browseItems.length > 0 && (
            <>
              <ul className="divide-y divide-line">
                {browseItems.map((c) => (
                  <CustomerRow key={c.id} customer={c} onUpdated={upsert} />
                ))}
              </ul>
              {browseHasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="ghost" onClick={loadMore} loading={browseLoadingMore}>
                    Mostrar más
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
