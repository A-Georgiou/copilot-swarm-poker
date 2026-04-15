import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          light: "#2d6b3f",
          DEFAULT: "#1a4d2e",
          dark: "#0f3520",
        },
        wood: {
          light: "#a0724e",
          DEFAULT: "#7a5230",
          dark: "#5c3d22",
        },
        chip: {
          red: "#d32f2f",
          blue: "#1565c0",
          green: "#2e7d32",
          black: "#212121",
          white: "#f5f5f5",
          gold: "#ffc107",
        },
        poker: {
          bg: "#0f1318",
        },
      },
    },
  },
  plugins: [],
};

export default config;
