// Tailwind v4 — design tokens live in app/globals.css via @theme.
// This file is kept minimal so plugins and content globs stay explicit.
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
} satisfies Config;
