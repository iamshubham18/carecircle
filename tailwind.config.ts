import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        'elder-base': ['1.125rem', { lineHeight: '1.75rem' }], // 18px base for elder
        'elder-lg': ['1.375rem', { lineHeight: '2rem' }], // 22px
        'elder-xl': ['1.75rem', { lineHeight: '2.25rem' }], // 28px
        'elder-2xl': ['2.25rem', { lineHeight: '2.75rem' }], // 36px
        'elder-3xl': ['3rem', { lineHeight: '3.5rem' }], // 48px
      },
      minHeight: {
        'touch-target': '48px',
      },
      minWidth: {
        'touch-target': '48px',
      },
      colors: {
        elder: {
          dark: '#0f172a', // high-contrast text
          surface: '#ffffff',
          card: '#f8fafc',
          border: '#334155', // dark visible border for high contrast
          primary: '#1e40af', // WCAG AAA compliant blue
          primaryHover: '#1d4ed8',
          success: '#15803d',
          warning: '#b45309',
          danger: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
