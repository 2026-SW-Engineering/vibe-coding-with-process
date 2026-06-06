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
        brand: {
          50: "#fff5f5",
          100: "#ffe0e0",
          500: "#E53935",
          600: "#C62828",
          700: "#B71C1C",
        },
        dark: "#1A1A1A",
        mid: "#555555",
        soft: "#888888",
        border: "#E0E0E0",
        surface: "#F5F5F5",
      },
    },
  },
  plugins: [],
};

export default config;
