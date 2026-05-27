import type { Config } from 'tailwindcss'
import { heroui } from '@heroui/react'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'pt-green': '#006600',
        'pt-red': '#FF0000',
        'pt-gold': '#FFD700',
        'pt-cream': '#FAFAF5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: '#006600',
              foreground: '#FAFAF5',
            },
            danger: {
              DEFAULT: '#FF0000',
            },
            warning: {
              DEFAULT: '#FFD700',
            },
          },
        },
      },
    }),
  ],
}

export default config
