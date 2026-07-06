'use client';

import { useEffect, useState } from 'react';
import { imageSrc } from '@/lib/uploads';

// Iniciales distintivas (max = nº de letras):
// - varias palabras -> primera letra de cada una: "Bebidas Frías" -> "BF"
// - una palabra      -> primeras `max` letras: "Alimentos" -> "ALI" (o "AL" con max=2)
function initials(name: string, max = 3): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, max)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return (words[0] ?? '').slice(0, max).toUpperCase();
}

// Color de fondo estable derivado del nombre (placeholder cuando no hay imagen).
function bgFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 85%)`;
}

export function Avatar({
  name,
  imageUrl,
  className = '',
  initialsClass = 'text-xs',
  fit = 'cover',
  maxInitials = 3,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  initialsClass?: string;
  // 'contain' = imagen completa; 'cover' = rellena y recorta; 'blur' = imagen
  // completa sobre un fondo difuminado de la misma foto (estilo marketplace).
  // El contenedor conserva SIEMPRE el tamaño que dicte className.
  fit?: 'cover' | 'contain' | 'blur';
  maxInitials?: number;
}) {
  const src = imageSrc(imageUrl ?? undefined);
  const [failed, setFailed] = useState(false);

  // Si cambia la imagen (otra categoría/edición), reintentar cargarla.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  // Si hay imagen y carga bien, se muestra; si falla (404/rota), cae a iniciales.
  if (src && !failed) {
    if (fit === 'blur') {
      return (
        <div className={`relative overflow-hidden ${className}`}>
          {/* Fondo: la misma foto difuminada llenando el cuadro */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-md" />
          {/* Frente: la foto completa, sin recortar ni deformar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" onError={() => setFailed(true)} className="relative h-full w-full object-contain" />
        </div>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={src} alt="" onError={() => setFailed(true)} className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} />
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: bgFor(name) }}>
      <span className={`font-bold text-ink ${initialsClass}`}>{initials(name, maxInitials)}</span>
    </div>
  );
}
