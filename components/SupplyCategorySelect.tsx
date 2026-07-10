'use client';

import { useRef, useState } from 'react';
import { createSupplyCategory, type SupplyCategory } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const selectClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-strong';

// Valor centinela: elegir esta opción abre el modo de creación inline.
const CREATE = '__create__';

type Props = {
  id?: string;
  // Categorías activas conocidas por el padre. El padre las administra para poder
  // agregar la recién creada y mantenerla seleccionada.
  categories: SupplyCategory[];
  value: string; // categoryId o '' para "Sin categoría"
  onChange: (categoryId: string) => void;
  // Se dispara con la categoría creada para que el padre la agregue a su lista.
  onCreated: (category: SupplyCategory) => void;
};

// Select de categoría de insumo con creación inline: además de elegir una categoría
// existente (o "Sin categoría"), permite crear una nueva sin salir de la pantalla.
export function SupplyCategorySelect({ id, categories, value, onChange, onCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setError(null);
    setName('');
    setCreating(true);
    // Foco al input tras el render.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelCreate() {
    setCreating(false);
    setName('');
    setError(null);
  }

  async function confirmCreate() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Escribe un nombre para la categoría.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createSupplyCategory({ name: trimmed });
      onCreated(created);
      onChange(created.id);
      setCreating(false);
      setName('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name_taken') {
        setError('Ya existe una categoría con ese nombre.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Error al crear la categoría');
      }
      // No perdemos lo escrito: `name` se conserva.
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            aria-label="Nombre de la nueva categoría"
            onKeyDown={(e) => {
              // Dentro de un <form>: Enter no debe enviar el formulario padre.
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmCreate();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelCreate();
              }
            }}
          />
          <Button type="button" onClick={() => void confirmCreate()} loading={saving}>
            Crear
          </Button>
          <Button type="button" variant="ghost" onClick={cancelCreate} disabled={saving}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => {
        if (e.target.value === CREATE) openCreate();
        else onChange(e.target.value);
      }}
    >
      <option value="">Sin categoría</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={CREATE}>➕ Crear categoría…</option>
    </select>
  );
}
