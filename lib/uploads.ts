import { API_URL } from './api';

// Máximos para imágenes subidas: las fotos de cámara (3000px+, varios MB) se
// reducen en el navegador antes de subir → cargan rápido en el POS.
const MAX_DIMENSION = 800; // px en el lado largo
const JPEG_QUALITY = 0.82;
const SKIP_UNDER_BYTES = 300 * 1024; // archivos ya ligeros (p.ej. favicons) pasan intactos

// compressImage reduce y recomprime la imagen en el navegador. Si algo falla
// (formato raro, navegador viejo), devuelve el archivo original.
async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_UNDER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // no ganó nada: usa el original
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Sube una imagen al backend y devuelve su URL relativa (ej. /files/abc.jpg).
// La imagen se comprime en el navegador antes de subirla.
export async function uploadImage(original: File): Promise<string> {
  const file = await compressImage(original);
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    let msg = 'No se pudo subir la imagen';
    try {
      const b = await res.json();
      if (b.message) msg = b.message;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

// imageSrc construye la URL completa para mostrar una imagen guardada.
export function imageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}
