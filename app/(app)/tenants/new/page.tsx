'use client';

import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import { createTenant } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

export default function NewTenantPage() {
  const me = useUser();
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el super admin global puede crear negocios.</p>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOk(false);
    try {
      await createTenant(form);
      setOk(true);
      setForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear negocio');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-ink">Nuevo negocio</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField label="Nombre del negocio" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FormField>
        <FormField label="Nombre del dueño" htmlFor="ownerName">
          <Input
            id="ownerName"
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Email del dueño" htmlFor="ownerEmail">
          <Input
            id="ownerEmail"
            type="email"
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Contraseña temporal (mín. 8)" htmlFor="ownerPassword">
          <PasswordInput
            id="ownerPassword"
            minLength={8}
            value={form.ownerPassword}
            onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
            required
          />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        {ok && <p className="text-sm text-success">Negocio creado ✓</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Crear negocio
        </Button>
      </form>
    </Card>
  );
}
