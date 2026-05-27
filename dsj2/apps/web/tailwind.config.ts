import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f7fb",
        ink: "#0f172a",
        muted: "#64748b",
        panel: "#ffffff",
      },
      boxShadow: {
        panel: "0 24px 60px -36px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

