import { api } from './api';

// Ajustes del negocio (M7): favicon por tenant. Ver contrato: GET /settings,
// PUT/DELETE /settings/favicon. La imagen se sube antes con POST /uploads (lib/uploads).
export type Settings = {
  tenant: { id: string; name: string };
  faviconUrl: string | null;
};

export const getSettings = () => api.get<Settings>('/settings');

// Persiste la URL del favicon (ruta /files/*). Devuelve la URL guardada.
export const setFavicon = (faviconUrl: string) =>
  api.put<{ faviconUrl: string }>('/settings/favicon', { faviconUrl }).then((r) => r.faviconUrl);

export const clearFavicon = () => api.delete<void>('/settings/favicon');
