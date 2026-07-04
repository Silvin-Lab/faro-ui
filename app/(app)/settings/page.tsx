'use client';

import { useEffect, useState } from 'react';
import { useUser, useTenant, useSetFavicon } from '@/lib/user-context';
import { getSettings, setFavicon, clearFavicon } from '@/lib/settings';
import { ApiError } from '@/lib/api';
import { imageSrc } from '@/lib/uploads';
import { ImageUpload } from '@/components/ImageUpload';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Negocio / Ajustes de marca — solo super admin (§7). Favicon del negocio.
export default function SettingsPage() {
  const me = useUser();

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona estos ajustes.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Negocio</h1>
      <FaviconCard />
    </div>
  );
}

// --- Card: Favicon del negocio -------------------------------------------------
function FaviconCard() {
  const tenant = useTenant();
  const setFaviconCtx = useSetFavicon();
  const [faviconUrl, setUrl] = useState<string | null>(tenant?.faviconUrl ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => setUrl(s.faviconUrl))
      .catch(() => {
        /* usa el valor del contexto como fallback */
      })
      .finally(() => setLoading(false));
  }, []);

  async function onUploaded(url: string) {
    setSaving(true);
    setError(null);
    try {
      const saved = await setFavicon(url);
      setUrl(saved);
      setFaviconCtx(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el favicon');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    setSaving(true);
    setError(null);
    try {
      await clearFavicon();
      setUrl(null);
      setFaviconCtx(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo quitar el favicon');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-ink">Favicon del negocio</h2>
      <p className="mb-4 text-sm text-muted">
        Ícono de la pestaña del navegador. PNG/WEBP cuadrado ≥ 64×64.
      </p>
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg text-xs text-muted">
            {faviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc(faviconUrl)} alt="Favicon actual" className="h-full w-full object-contain" />
            ) : (
              'Sin ícono'
            )}
          </div>
          <div className="space-y-2">
            <ImageUpload value={faviconUrl} onChange={onUploaded} />
            {faviconUrl && (
              <Button variant="ghost" onClick={onRemove} disabled={saving}>
                Quitar favicon
              </Button>
            )}
          </div>
        </div>
      )}
      {saving && <p className="mt-2 text-xs text-muted">Guardando…</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
