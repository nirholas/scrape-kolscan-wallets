import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Semantic — only use these three for meaning
        buy:   { DEFAULT: "#22c55e", light: "#4ade80", dark: "#16a34a" }, // profit / buy
        sell:  { DEFAULT: "#ef4444", light: "#f87171", dark: "#dc2626" }, // loss / sell
        accent: { DEFAULT: "#1D9BF0", light: "#4DB5F5", dark: "#1A8CD8" }, // interactive / links
        // Surface scale — monochrome only
        bg: {
          primary:  "#000000",
          secondary: "#080808",
          card:     "#0f0f0f",
          hover:    "#161616",
          elevated: "#1a1a1a",
        },
        border: { DEFAULT: "#1e1e1e", light: "#2a2a2a" },
        muted:  { DEFAULT: "#555555", light: "#777777" },
        surface: "#ffffff",
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        glow: '0 0 20px rgba(29, 155, 240, 0.15)',
        'glow-lg': '0 0 40px rgba(29, 155, 240, 0.12)',
        card: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)',
        elevated: '0 4px 12px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
