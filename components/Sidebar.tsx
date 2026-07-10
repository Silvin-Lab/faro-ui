'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/lib/auth';

// onNavigate permite cerrar el drawer móvil al tocar un enlace.
export function Sidebar({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();

  // Menú por rol (M8): el super admin administra el negocio; el admin de sucursal opera el
  // POS y ve los reportes de su sucursal; cajero/barista solo operan el POS.
  const items =
    user.role === 'super_admin'
      ? [
          { href: '/products', label: 'Productos' },
          { href: '/categories', label: 'Categorías' },
          { href: '/supplies', label: 'Insumos' },
          { href: '/expense-catalog', label: 'Catálogo de gastos' },
          { href: '/loyalty', label: 'Lealtad' },
          { href: '/users', label: 'Usuarios' },
          { href: '/customers', label: 'Clientes' },
          { href: '/branches', label: 'Sucursales' },
          { href: '/expenses', label: 'Gastos' },
          { href: '/reports', label: 'Reportes' },
          { href: '/settings', label: 'Negocio' },
        ]
      : user.role === 'branch_admin'
        ? [
            { href: '/pos', label: 'Punto de venta' },
            { href: '/expenses', label: 'Gastos' },
            { href: '/customers', label: 'Clientes' },
            { href: '/reports', label: 'Reportes' },
          ]
        : [
            { href: '/pos', label: 'Punto de venta' },
            { href: '/expenses', label: 'Gastos' },
          ];
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
