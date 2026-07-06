import type { Config } from 'tailwindcss';

// Paleta BrightPOS (ver faro/.arete/foundations/design-system.md v0.3).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#C4E456', strong: '#B2D63F' }, // lime, texto oscuro encima
        bg: '#F4F4F2',
        surface: '#FFFFFF',
        ink: '#1A1A1A',
        muted: '#8C8C8C',
        line: '#E6E6E4',
        danger: '#C0392B',
        success: '#2E7D32',
      },
      borderRadius: { md: '12px', lg: '16px' },
    },
  },
  plugins: [],
};

export default config;
