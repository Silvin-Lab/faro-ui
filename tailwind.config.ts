import type { Config } from 'tailwindcss';

// Paleta Faro azul (ver faro/.arete/foundations/design-system.md).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // accent azul: texto blanco encima; soft para selección ligera (texto ink).
        accent: { DEFAULT: '#1668C7', strong: '#0F4C9A', soft: '#DCEAF8', warm: '#F7C09B' },
        bg: '#F1F5F6',
        surface: '#FFFFFF',
        ink: '#1C2426',
        muted: '#636D6D',
        line: '#D5E0E3',
        danger: '#D33A2C',
        success: '#1B7F4B',
      },
      borderRadius: { md: '12px', lg: '16px' },
    },
  },
  plugins: [],
};

export default config;
