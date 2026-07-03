import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        signal: {
          DEFAULT: "#0A84FF",
          light: "#5AB0FF",
          dark: "#0060D1",
        },
        mint: {
          DEFAULT: "#2FD6A8",
          dark: "#18A87F",
        },
        coral: {
          DEFAULT: "#FF6B6B",
          dark: "#E24A4A",
        },
        amber: {
          DEFAULT: "#FFB020",
        },
        base: {
          light: "#EEF2FB",
          "light-2": "#F6F0FF",
          dark: "#0A0E1A",
          "dark-2": "#161226",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.12)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
        "glow-signal": "0 0 24px rgba(10, 132, 255, 0.35)",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(3%, 4%) scale(1.08)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        "drift-slow": "drift 26s ease-in-out infinite reverse",
        "fade-up": "fade-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
