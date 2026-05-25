/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Colores dinámicos usando CSS variables (configurables desde admin)
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
          secondary: 'var(--accent-secondary, var(--accent-primary))',
        },
        // Color primario - Azul TuBus (alineado con var(--accent-primary)
        // = rgb(0, 29, 86)). Reemplaza la paleta "Rojo vino" legacy del
        // diseño original. Cualquier uso de `bg-primary-*`, `ring-primary-*`,
        // `border-primary-*`, `text-primary-*` ahora produce un tono del
        // brand, evitando rings rojos accidentales que se confundían con
        // estados de error de validación. Los rojos legítimos (validación
        // fallida) siguen disponibles en la paleta `error.*` más abajo.
        primary: {
          50:  '#e6ecf4',
          100: '#ccd9e8',
          200: '#99b3d2',
          300: '#668cbb',
          400: '#3366a4',
          500: '#003e99',  // = accent-primary (dark mode)
          600: '#002d70',
          700: '#001d56',  // = accent-primary (light mode) — brand principal
          800: '#00143c',
          900: '#000b22',
          950: '#000511',
        },
        // Colores neutros - Negro/Gris
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Colores de superficie para temas
        surface: {
          light: '#ffffff',
          dark: '#0a0a0a',
        },
        // Estados
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 20px rgba(0, 0, 0, 0.05)',
        'hover': '0 10px 40px rgba(0, 0, 0, 0.1)',
        'dark-soft': '0 2px 15px -3px rgba(0, 0, 0, 0.3), 0 10px 20px -2px rgba(0, 0, 0, 0.2)',
        'dark-card': '0 0 20px rgba(0, 0, 0, 0.3)',
        'dark-hover': '0 10px 40px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
}