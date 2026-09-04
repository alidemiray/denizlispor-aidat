import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        yesil: {
          50: "#e8f5ee", 100: "#c6e6d5", 200: "#96d1b3",
          300: "#5fb88d", 400: "#2f9d6c", 500: "#0f8250",
          600: "#046a38", 700: "#03562e", 800: "#024124", 900: "#012c19",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
