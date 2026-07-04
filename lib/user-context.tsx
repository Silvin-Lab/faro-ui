'use client';

import { createContext, useContext } from 'react';
import type { User, Tenant, Session } from './auth';

type Ctx = {
  session: Session;
  // M7: permite refrescar el favicon en vivo tras cambiarlo en Ajustes.
  setFaviconUrl?: (url: string | null) => void;
};

const UserContext = createContext<Ctx | null>(null);

export const UserProvider = UserContext.Provider;

function useCtx(): Ctx {
  const c = useContext(UserContext);
  if (!c) throw new Error('useUser/useSession debe usarse dentro de UserProvider');
  return c;
}

export function useUser(): User {
  return useCtx().session.user;
}

// M7 v2: sesión completa (tenant + membresías + sucursal activa).
export function useSession(): Session {
  return useCtx().session;
}

// M7: marca/favicon del negocio (null para super admin global).
export function useTenant(): Tenant | null {
  return useCtx().session.tenant;
}

// M7: actualizador del favicon del tenant en el contexto (para reflejarlo sin recargar).
export function useSetFavicon(): (url: string | null) => void {
  return useCtx().setFaviconUrl ?? (() => {});
}
