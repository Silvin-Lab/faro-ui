'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Package,
  Tags,
  Tag,
  Boxes,
  Users,
  Store,
  Settings,
  Receipt,
  Wallet,
  BarChart3,
  Heart,
  UserRound,
  UserCog,
  ShoppingCart,
  Warehouse,
  ClipboardList,
  Truck,
  Trash2,
  Handshake,
  Lightbulb,
} from 'lucide-react';
import type { User } from '@/lib/auth';

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string | null; items: NavItem[] };

// onNavigate permite cerrar el drawer móvil al tocar un enlace.
export function Sidebar({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();

  // Menú agrupado por rol (M8): el super admin administra el negocio, organizado en
  // Administración / Operación / Clientes / Almacén; el admin de sucursal y el
  // cajero/barista operan el día a día (menú corto, sin agrupar).
  const groups: NavGroup[] =
    user.role === 'super_admin'
      ? [
          {
            label: 'Administración',
            items: [
              { href: '/products', label: 'Productos', icon: Package },
              { href: '/categories', label: 'Categorías', icon: Tags },
              { href: '/supplies', label: 'Insumos', icon: Boxes },
              { href: '/supplies/categories', label: 'Categorías de insumo', icon: Tag },
              { href: '/users', label: 'Usuarios', icon: Users },
              { href: '/branches', label: 'Sucursales', icon: Store },
              { href: '/settings', label: 'Negocio', icon: Settings },
            ],
          },
          {
            label: 'Operación',
            items: [
              { href: '/expense-catalog', label: 'Catálogo de gastos', icon: ClipboardList },
              { href: '/expenses', label: 'Gastos', icon: Wallet },
              { href: '/reports', label: 'Reportes', icon: BarChart3 },
            ],
          },
          {
            // M9: sección propia, separada de Reportes (comportamiento, no cifras
            // operativas del día). Lightbulb — nunca connotación de IA.
            label: 'Insights',
            items: [{ href: '/insights', label: 'Insights', icon: Lightbulb }],
          },
          {
            label: 'Clientes',
            items: [
              { href: '/loyalty', label: 'Lealtad', icon: Heart },
              { href: '/customers', label: 'Clientes', icon: UserRound },
            ],
          },
          {
            label: 'Almacén',
            items: [
              { href: '/warehouse', label: 'Almacén', icon: Warehouse },
              { href: '/warehouse/to-buy', label: 'Productos a comprar', icon: ShoppingCart },
              { href: '/warehouse/purchases', label: 'Compras', icon: Receipt },
              { href: '/warehouse/dispatches', label: 'Salidas', icon: Truck },
              { href: '/warehouse/waste', label: 'Mermas', icon: Trash2 },
              { href: '/warehouse/suppliers', label: 'Proveedores', icon: Handshake },
            ],
          },
        ]
      : user.role === 'branch_admin'
        ? [
            {
              label: null,
              items: [
                { href: '/pos', label: 'Punto de venta', icon: ShoppingCart },
                { href: '/expenses', label: 'Gastos', icon: Wallet },
                { href: '/customers', label: 'Clientes', icon: UserRound },
                { href: '/reports', label: 'Reportes', icon: BarChart3 },
                // M9: ítem plano junto a Reportes (branch_admin), acotado por el servidor.
                { href: '/insights', label: 'Insights', icon: Lightbulb },
              ],
            },
          ]
        : [
            {
              label: null,
              items: [
                { href: '/pos', label: 'Punto de venta', icon: ShoppingCart },
                { href: '/expenses', label: 'Gastos', icon: Wallet },
              ],
            },
          ];

  // "Mi cuenta" (cambiar contraseña) para todos los perfiles, siempre al final y
  // sin agrupar.
  const accountItem: NavItem = { href: '/account', label: 'Mi cuenta', icon: UserCog };

  const linkClass = (href: string, sub: boolean) =>
    `flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors ${
      sub ? 'pl-5 pr-3 font-normal' : 'px-3 font-medium'
    } ${pathname === href ? 'bg-accent text-ink' : 'text-muted hover:bg-bg hover:text-ink'}`;

  function renderGroup(group: NavGroup, sub: boolean) {
    return (
      <nav key={group.label ?? '__flat'} className="mt-2 space-y-1">
        {group.items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              className={linkClass(it.href, sub)}
            >
              <Icon size={16} strokeWidth={2} className="shrink-0" aria-hidden />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface p-4">
      <div className="px-2 py-3 text-xl font-bold text-ink">
        Faro<span className="text-accent-strong">.</span>
      </div>

      {groups.map((group, i) => (
        <div key={group.label ?? '__flat'}>
          {group.label && (
            <p
              className={`px-2 text-xs font-medium uppercase tracking-wide text-muted ${i === 0 ? 'mt-4' : 'mt-6'}`}
            >
              {group.label}
            </p>
          )}
          {renderGroup(group, Boolean(group.label))}
        </div>
      ))}

      <div className="mt-6 border-t border-line pt-3">
        <Link
          href={accountItem.href}
          onClick={onNavigate}
          className={linkClass(accountItem.href, false)}
        >
          <UserCog size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span>{accountItem.label}</span>
        </Link>
      </div>
    </aside>
  );
}
