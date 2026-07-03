'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/lib/auth';

// onNavigate permite cerrar el drawer móvil al tocar un enlace.
export function Sidebar({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();

  const items = [{ href: '/dashboard', label: 'Dashboard' }];
  if (!user.isSuperAdmin) {
    items.push({ href: '/pos', label: 'Punto de venta' });
    items.push({ href: '/categories', label: 'Categorías' });
    items.push({ href: '/products', label: 'Productos' });
    items.push({ href: '/reports', label: 'Reportes' });
    items.push({ href: '/loyalty', label: 'Lealtad' });
    items.push({ href: '/users', label: 'Usuarios' });
  }
  if (user.isSuperAdmin) {
    items.push({ href: '/tenants/new', label: 'Nuevo negocio' });
  }

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
