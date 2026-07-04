'use client';

import { useEffect } from 'react';
import { imageSrc } from '@/lib/uploads';

const DEFAULT_FAVICON = '/favicon.ico';

// FaviconManager (M7): inyecta el favicon del tenant en runtime. El favicon solo se
// conoce tras /auth/me (API en otro origen con cookie httpOnly), por eso no se puede
// resolver en servidor con generateMetadata. Si faviconUrl es null, restaura el default.
export function FaviconManager({ faviconUrl }: { faviconUrl: string | null }) {
  useEffect(() => {
    const head = document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      head.appendChild(link);
    }

    const resolved = imageSrc(faviconUrl);
    // ?v= para saltar la caché del navegador al cambiar el favicon en vivo.
    link.href = resolved ? `${resolved}?v=${encodeURIComponent(faviconUrl ?? '')}` : DEFAULT_FAVICON;

    return () => {
      // Al desmontar (p. ej. tras logout), restaura el favicon por defecto.
      const l = head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
      if (l) l.href = DEFAULT_FAVICON;
    };
  }, [faviconUrl]);

  return null;
}
