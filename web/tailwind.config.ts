import type { Config } from "tailwindcss";
import { heroui } from "@heroui/theme";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#09090b",
            foreground: "#fafafa",
            content1: "#111113",
            content2: "#18181b",
            content3: "#27272a",
            content4: "#3f3f46",
            divider: "#27272a",
            focus: "#fafafa",
            default: {
              50: "#fafafa",
              100: "#f4f4f5",
              200: "#e4e4e7",
              300: "#d4d4d8",
              400: "#a1a1aa",
              500: "#71717a",
              600: "#52525b",
              700: "#3f3f46",
              800: "#27272a",
              900: "#18181b",
              DEFAULT: "#3f3f46",
              foreground: "#fafafa",
            },
            primary: {
              50: "#eff6ff",
              100: "#dbeafe",
              200: "#bfdbfe",
              300: "#93c5fd",
              400: "#60a5fa",
              500: "#3b82f6",
              600: "#2563eb",
              DEFAULT: "#3b82f6",
              foreground: "#ffffff",
            },
            secondary: {
              DEFAULT: "#52525b",
              foreground: "#fafafa",
            },
            success: {
              DEFAULT: "#22c55e",
              foreground: "#052e16",
            },
            warning: {
              DEFAULT: "#eab308",
              foreground: "#422006",
            },
            danger: {
              DEFAULT: "#ef4444",
              foreground: "#ffffff",
            },
          },
          layout: {
            radius: {
              small: "6px",
              medium: "8px",
              large: "12px",
            },
          },
        },
      },
    }),
  ],
} satisfies Config;
