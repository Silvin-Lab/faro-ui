'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getMe, type Session } from '@/lib/auth';
import { UserProvider } from '@/lib/user-context';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { FaviconManager } from '@/components/FaviconManager';
import { SessionExpiredGate } from '@/components/SessionExpiredGate';

// Layout autenticado (T7 shell + T9 guard). El POS (/pos) se muestra a pantalla
// completa, sin el menú lateral (es la pantalla de operación por horas).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    getMe()
      .then(setSession)
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  // Guard de selección de sucursal (ADR-007): un usuario operativo con >1 sucursal y
  // sin sucursal activa debe elegir antes de operar el POS.
  useEffect(() => {
    if (!session) return;
    if (
      !session.user.isSuperAdmin &&
      session.mustSelectBranch &&
      pathname !== '/select-branch'
    ) {
      router.replace('/select-branch');
    }
  }, [session, pathname, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Cargando…</div>;
  }
  if (!session) return null;

  const { user, tenant } = session;

  // Refleja el cambio de favicon (desde Ajustes) sin recargar: actualiza el tenant en estado.
  const setFaviconUrl = (url: string | null) =>
    setSession((prev) =>
      prev && prev.tenant ? { ...prev, tenant: { ...prev.tenant, faviconUrl: url } } : prev,
    );

  const ctx = { session, setFaviconUrl };

  // Vistas a pantalla completa (sin sidebar): POS y selección de sucursal.
  if (pathname === '/pos' || pathname === '/select-branch') {
    return (
      <UserProvider value={ctx}>
        <FaviconManager faviconUrl={tenant?.faviconUrl ?? null} />
        <SessionExpiredGate />
        {children}
      </UserProvider>
    );
  }

  return (
    <UserProvider value={ctx}>
      <FaviconManager faviconUrl={tenant?.faviconUrl ?? null} />
      <SessionExpiredGate />
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar user={user} />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden />
            <div className="absolute left-0 top-0 h-full shadow-lg">
              <Sidebar user={user} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onMenu={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
