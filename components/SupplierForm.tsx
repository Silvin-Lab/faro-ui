'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupplier, updateSupplier, type Supplier } from '@/lib/warehouse';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

// Alta/edición de proveedor (F6). Solo Nombre es obligatorio; el resto son datos
// de contacto opcionales. Correo con `type=email` (validación de formato).
//
// `onSaved`: modo embebido (ej. dentro de un Modal). Si viene, se llama con el
// proveedor guardado en vez de navegar a /warehouse/suppliers — así el que lo usa
// (ej. Compras) puede cerrar el modal y dejar el proveedor recién creado
// seleccionado sin salir de la pantalla. `hideCard` evita envolver en su propia
// Card cuando ya está dentro de un contenedor (el Modal).
export function SupplierForm({
  initial,
  onSaved,
  onCancel,
  hideCard,
}: {
  initial?: Supplier;
  onSaved?: (supplier: Supplier) => void;
  onCancel?: () => void;
  hideCard?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim() === '') return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };
      const saved = editing && initial ? await updateSupplier(initial.id, payload) : await createSupplier(payload);
      if (onSaved) onSaved(saved);
      else router.push('/warehouse/suppliers');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_taken') {
        setError('Ya existe un proveedor con ese nombre.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Error al guardar el proveedor');
      }
      setSaving(false);
    }
  }

  const form_ = (
    <>
      {!hideCard && (
        <h1 className="mb-4 text-xl font-semibold text-ink">
          {editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        </h1>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre" htmlFor="name">
          <Input
            id="name"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setError(null);
            }}
            required
          />
        </FormField>
        <FormField label="Teléfono" htmlFor="phone">
          <Input
            id="phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
        <FormField label="Correo" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="Dirección" htmlFor="address">
          <Input
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel ?? (() => router.push('/warehouse/suppliers'))}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );

  return hideCard ? form_ : <Card className="max-w-lg">{form_}</Card>;
}
