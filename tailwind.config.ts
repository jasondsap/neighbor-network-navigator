import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neighbor Network Brand Colors
        nn: {
          // Primary blue (main background)
          blue: '#2E4A8E',
          'blue-dark': '#1E3A6E',
          'blue-light': '#4A6AAE',
          
          // Gold/Yellow (headings, accents)
          gold: '#E8B84A',
          'gold-light': '#F5C842',
          'gold-dark': '#C99A3A',
          
          // Cream/Off-white (text on dark backgrounds)
          cream: '#F5F0E6',
          
          // Red/Maroon (buttons, CTAs)
          red: '#8B2332',
          'red-light': '#A53342',
          'red-dark': '#6B1322',
          
          // Section colors (Reconnect, Rethink, Rebuild)
          coral: '#E8A88A', // Reconnect section (peachy/salmon)
          yellow: '#F5E14B', // Rethink section (bright yellow)
          lavender: '#D4C8E8', // Rebuild section (light purple)
          
          // Teal accents (from icons)
          teal: '#2A8B8B',
          
          // Grays
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          }
        }
      },
      fontFamily: {
        // You can add custom fonts here if Neighbor Network uses specific ones
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'], // For the "Welcome, Neighbor" style headings
      },
      backgroundImage: {
        'gradient-nn': 'linear-gradient(135deg, #2E4A8E 0%, #1E3A6E 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
