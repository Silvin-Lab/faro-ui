'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { listUsers, createUser, type User } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

export default function UsersPage() {
  const me = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setUsers(await listUsers());
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : 'Error al cargar usuarios');
    }
  }

  useEffect(() => {
    if (!me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErr(null);
    try {
      await createUser(form);
      setForm({ name: '', email: '', password: '' });
      await refresh();
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  }

  if (me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">
          Como super admin global, la gestión de usuarios es por negocio. Crea negocios desde
          “Nuevo negocio”.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Usuarios</h2>
        {loadErr && <p className="text-sm text-danger">{loadErr}</p>}
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-ink">{u.name}</span>
              <span className="text-xs text-muted">{u.email}</span>
            </li>
          ))}
          {users.length === 0 && !loadErr && (
            <li className="py-2 text-sm text-muted">Sin usuarios todavía.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Nuevo usuario</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField label="Nombre" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Contraseña (mín. 8)" htmlFor="password">
            <PasswordInput
              id="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </FormField>
          {formErr && <p className="text-sm text-danger">{formErr}</p>}
          <Button type="submit" loading={submitting} className="w-full">
            Crear usuario
          </Button>
        </form>
      </Card>
    </div>
  );
}
