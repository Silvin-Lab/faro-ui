'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, postLoginPath } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const s = await login(email, password);
      // Ruteo por rol (M8): super_admin/branch_admin → /reports; cashier/barista → /pos;
      // operativo con >1 sucursal sin activa → /select-branch (y de ahí a su aterrizaje por rol).
      router.replace(postLoginPath(s));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Demasiados intentos. Espera un momento.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Email o contraseña incorrectos.');
      } else {
        setError('No se pudo iniciar sesión.');
      }
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center text-2xl font-bold text-ink">
          Faro<span className="text-accent-strong">.</span>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Contraseña" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
