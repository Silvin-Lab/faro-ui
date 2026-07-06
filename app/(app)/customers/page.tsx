'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  searchCustomers,
  createCustomer,
  setCustomerVisits,
  type Customer,
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

  function startEdit() {
    setValue(String(customer.visits));
    setError(null);
    setEditing(true);
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
        </div>
      )}
    </li>
  );
}

// Alta de cliente con visitas previas opcionales (createCustomer + setCustomerVisits).
function NewCustomerForm({ onCreated }: { onCreated: (c: Customer) => void }) {
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
    const raw = priorVisits.trim();
    const visits = raw === '' ? 0 : Number(raw);
    if (raw !== '' && (!Number.isInteger(visits) || visits < 0)) {
      setError('Las visitas previas deben ser un número entero mayor o igual a 0.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let customer = await createCustomer({
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      // Si el cliente traía visitas de su tarjeta física, las fijamos enseguida.
      if (visits > 0) {
        customer = await setCustomerVisits(customer.id, visits);
      }
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
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Apellido" htmlFor="new-last">
          <Input
            id="new-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Teléfono" htmlFor="new-phone">
          <Input
            id="new-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </FormField>
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

export default function CustomersPage() {
  const me = useUser();
  const canAccess = me.role === 'super_admin' || me.role === 'branch_admin';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();

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

  // Refleja en la lista el cliente actualizado (ajuste de visitas o alta reciente).
  function upsert(c: Customer) {
    setResults((prev) => {
      if (!prev) return [c];
      const i = prev.findIndex((x) => x.id === c.id);
      if (i === -1) return [c, ...prev];
      const next = [...prev];
      next[i] = c;
      return next;
    });
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
        <NewCustomerForm onCreated={upsert} />
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
          {q.length < 2 && (
            <p className="text-sm text-muted">Escribe un nombre o teléfono para buscar.</p>
          )}
          {q.length >= 2 && searching && <p className="text-sm text-muted">Buscando…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {q.length >= 2 && !searching && !error && results && results.length === 0 && (
            <p className="text-sm text-muted">
              No hay clientes que coincidan con “{q}”. Puedes crear uno nuevo.
            </p>
          )}
          {results && results.length > 0 && (
            <ul className="divide-y divide-line">
              {results.map((c) => (
                <CustomerRow key={c.id} customer={c} onUpdated={upsert} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
