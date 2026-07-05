'use client';

import { useState } from 'react';
import { useUser } from '@/lib/user-context';
import { changePassword } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

export default function AccountPage() {
  const me = useUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const mismatch = confirm !== '' && next !== confirm;
  const invalid = current === '' || next.length < 8 || next !== confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOk(false);
    try {
      await changePassword(current, next);
      setOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Mi cuenta</h1>
      <Card>
        <p className="mb-1 text-sm text-muted">Sesión</p>
        <p className="text-ink">{me.name}</p>
        <p className="text-sm text-muted">{me.email}</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Cambiar contraseña</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField label="Contraseña actual" htmlFor="current">
            <PasswordInput
              id="current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormField>
          <FormField label="Nueva contraseña (mín. 8)" htmlFor="next">
            <PasswordInput
              id="next"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
            />
          </FormField>
          <FormField label="Confirmar nueva contraseña" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </FormField>

          {mismatch && <p className="text-sm text-danger">Las contraseñas no coinciden.</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {ok && <p className="text-sm text-accent-strong">Contraseña actualizada ✓</p>}

          <Button type="submit" loading={submitting} disabled={invalid} className="w-full">
            Cambiar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}
