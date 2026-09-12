import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: { DEFAULT: "#05060f", soft: "#0a0c1a", panel: "#0f1226" },
        nebula: {
          50: "#f2f0ff", 100: "#e6e2ff", 200: "#cdc6ff", 300: "#a99bff",
          400: "#8a72ff", 500: "#6d4dfb", 600: "#5a34e8", 700: "#4a26c4",
          800: "#3c219e", 900: "#2a1870",
        },
        plasma: { 400: "#22d3ee", 500: "#06b6d4" },
        aurora: { 400: "#f472b6", 500: "#ec4899" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(109,77,251,0.55)",
        "glow-sm": "0 0 20px -8px rgba(109,77,251,0.6)",
        panel: "0 8px 40px -20px rgba(0,0,0,0.6)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseSlow: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        orbit: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        sweep: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(200%)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulseSlow 3.5s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-up": "fadeUp .35s ease-out both",
        orbit: "orbit 14s linear infinite",
        sweep: "sweep 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
