// Cliente HTTP del backend de Faro (repo `faro`).
// La sesión viaja en cookie httpOnly => credentials: 'include'.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// ApiError lleva el status y el código de error del backend para manejar 401/409/429.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// --- Detección global de sesión expirada (401) ---
// Cuando el backend responde 401 (cookie de sesión vencida), además de lanzar el
// ApiError marcamos la sesión como expirada de forma global. La app observa este
// estado (ver components/SessionExpiredGate) para mostrar un aviso uniforme,
// grande y bloqueante que fuerce el re-login — así un 401 es IMPOSIBLE de ignorar
// y no se pierde una venta en silencio.
type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();
let sessionExpired = false;
let sessionExpiredDetail: string | null = null;

// Detalle por defecto del aviso. Un contexto más específico (p.ej. el POS al
// fallar un cobro) puede sobreescribirlo con markSessionExpired(detalle).
const DEFAULT_SESSION_EXPIRED_DETAIL = 'Vuelve a iniciar sesión para continuar.';

function emitSessionExpired() {
  for (const l of sessionExpiredListeners) l();
}

// Marca la sesión como expirada y notifica a los observadores. El mensaje más
// específico gana: si se pasa un detalle, reemplaza al anterior.
export function markSessionExpired(detail?: string) {
  if (detail) sessionExpiredDetail = detail;
  else if (!sessionExpiredDetail) sessionExpiredDetail = DEFAULT_SESSION_EXPIRED_DETAIL;
  sessionExpired = true;
  emitSessionExpired();
}

// Limpia el estado (tras re-login o al recuperar una sesión válida).
export function resetSessionExpired() {
  sessionExpired = false;
  sessionExpiredDetail = null;
  emitSessionExpired();
}

export function isSessionExpired() {
  return sessionExpired;
}

export function subscribeSessionExpired(listener: SessionExpiredListener) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

// Snapshot para useSyncExternalStore: cadena vacía = sin aviso; si hay aviso,
// devuelve el detalle (así un cambio de detalle re-renderiza el observador).
export function getSessionExpiredSnapshot(): string {
  return sessionExpired ? (sessionExpiredDetail ?? DEFAULT_SESSION_EXPIRED_DETAIL) : '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      code = body.code;
      if (body.message) message = body.message;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    // 401 = sesión vencida. Un 401 en el propio login es "credenciales
    // incorrectas" (no una sesión expirada), así que ese caso se excluye.
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      markSessionExpired();
    }
    throw new ApiError(res.status, message, code);
  }
  // Cualquier respuesta exitosa implica que la sesión es válida de nuevo. Si la
  // bandera de "sesión expirada" había quedado pegajosa (p.ej. un 401 legítimo de
  // /auth/me sin sesión, o un login al que no se llegó por el botón del overlay),
  // un request 200 posterior al re-login la limpia sin depender de ese botón.
  if (sessionExpired) {
    resetSessionExpired();
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
