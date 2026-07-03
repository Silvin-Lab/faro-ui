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
    throw new ApiError(res.status, message, code);
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
