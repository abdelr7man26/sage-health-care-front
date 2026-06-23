/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#0f5238",
        "on-primary": "#ffffff",
        "primary-container": "#2d6a4f",
        "on-primary-container": "#a8e7c5",
        "background": "#f8faf9",
        "on-background": "#191c1c",
        "surface": "#f8faf9",
        "surface-container-low": "#f2f4f3",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#191c1c",
        "on-surface-variant": "#404943",
        "outline": "#707973",
        "outline-variant": "#bfc9c1",
        "tertiary": "#264f39",
        "tertiary-fixed-dim": "#a4d1b4",
        // أضفت لك الألوان الأساسية من التصميم
      },
      spacing: {
        "gutter": "24px",
        "md": "24px",
        "lg": "48px",
        "xl": "80px",
        "sm": "12px",
        "xs": "4px",
      },
      borderRadius: {
        "DEFAULT": "16px", // الـ 16px اللي في الـ Design System
      }
    },
  },
  plugins: [],
}