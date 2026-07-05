'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/lib/auth';

// onNavigate permite cerrar el drawer móvil al tocar un enlace.
export function Sidebar({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();

  // Menú por perfil (M7 v2 · §8): el super admin administra el negocio; el usuario de
  // sucursal solo opera el POS.
  const items = user.isSuperAdmin
    ? [
        { href: '/products', label: 'Productos' },
        { href: '/categories', label: 'Categorías' },
        { href: '/loyalty', label: 'Lealtad' },
        { href: '/users', label: 'Usuarios' },
        { href: '/branches', label: 'Sucursales' },
        { href: '/reports', label: 'Reportes' },
        { href: '/settings', label: 'Negocio' },
      ]
    : [{ href: '/pos', label: 'Punto de venta' }];
  // "Mi cuenta" (cambiar contraseña) para todos los perfiles.
  items.push({ href: '/account', label: 'Mi cuenta' });

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface p-4">
      <div className="px-2 py-3 text-xl font-bold text-ink">
        Faro<span className="text-accent-strong">.</span>
      </div>

      <p className="mt-4 px-2 text-xs font-medium uppercase tracking-wide text-muted">Main Menu</p>
      <nav className="mt-2 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-accent text-ink' : 'text-muted hover:bg-bg hover:text-ink'
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
