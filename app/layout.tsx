import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Faro',
  description: 'Administración de cafeterías + punto de venta',
  // PWA en iOS: al agregar a pantalla de inicio, abre standalone (sin barra de Safari).
  appleWebApp: {
    capable: true,
    title: 'Faro',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // aprovecha toda la pantalla en iPad/notch
  themeColor: '#f4f4f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
