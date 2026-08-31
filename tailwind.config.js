/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1ef",
          100: "#ffd9d4",
          200: "#ffb3aa",
          300: "#f58c80",
          400: "#ea5b4a",
          500: "#df3c27",
          600: "#c72f1d",
          700: "#a92518",
          800: "#851d14",
          900: "#64150f",
        },
        college: {
          blue: "#2d2b6f",
          yellow: "#ffc600",
          green: "#6abf4b",
          "red-muted": "#c76c61",
          "blue-light": "#4197cb",
        },
        ink: {
          900: "#ffffff",
          800: "#f8fafc",
          700: "#f1f5f9",
          600: "#e2e8f0",
          500: "#cbd5e1",
        },
      },
      fontFamily: {
        sans: ["Gotham", "Century Gothic", "Avenir Next", "ui-sans-serif", "sans-serif"],
        display: ["Galano Grotesque", "Gotham", "Century Gothic", "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 16s linear infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "ping-slow": "ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "scroll-x": "scroll-x 30s linear infinite",
        glow: "glow 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" },
        },
        "gradient-x": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        "scroll-x": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 24px rgba(223,60,39,0.35)" },
          "50%": { boxShadow: "0 0 48px rgba(223,60,39,0.65)" },
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,1) 95%), radial-gradient(circle at top, rgba(65,151,203,0.12), transparent 60%), linear-gradient(rgba(45,43,111,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,111,0.06) 1px, transparent 1px)",
      },
      boxShadow: {
        "brand-glow": "0 10px 40px -10px rgba(223,60,39,0.55)",
      },
    },
  },
  plugins: [],
}
