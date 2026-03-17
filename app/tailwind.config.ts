import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        crucible: {
          bg: "#07070d",
          card: "#0f0f18",
          border: "#1a1a2e",
          accent: "#ef4444",
          gold: "#f59e0b",
          green: "#22c55e",
          silver: "#94a3b8",
          bronze: "#d97706",
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "score-pop": "score-pop 0.3s ease-out",
        "ember": "ember 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(239, 68, 68, 0.6)" },
        },
        "score-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "ember": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
