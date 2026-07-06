/** @type {import('next').NextConfig} */

// Proxy same-origin hacia el backend (producción): el navegador habla solo con el
// dominio del frontend y Vercel reenvía /backend/* a la API. Así la cookie de
// sesión es first-party y funciona en Safari/iOS (que bloquea cookies de terceros
// entre vercel.app y fly.dev). Se activa definiendo API_PROXY_TARGET en el build
// y usando NEXT_PUBLIC_API_URL=/backend. En dev local no se define y no aplica.
const proxyTarget = process.env.API_PROXY_TARGET;

const nextConfig = {
  output: 'standalone', // para imagen Docker mínima
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      {
        source: '/backend/:path*',
        destination: `${proxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
