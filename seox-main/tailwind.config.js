/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e8f6f6",
          100: "#d1eded",
          200: "#b3e0df",
          300: "#ABD8B7",
          400: "#7ABDBC",
          500: "#6AADAC",
          600: "#5A9E9D",
          700: "#4A8E8D",
          800: "#3A7E7D",
          900: "#2A6E6D",
        },
        ink: {
          900: "#181A2F",
          800: "#1E2040",
          700: "#242650",
          600: "#2A2C5A",
          500: "#343664",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
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
          "0%, 100%": { boxShadow: "0 0 24px rgba(122,189,188,0.35)" },
          "50%": { boxShadow: "0 0 48px rgba(122,189,188,0.65)" },
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent 0%, rgba(24,26,47,1) 95%), radial-gradient(circle at top, rgba(122,189,188,0.18), transparent 60%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        "brand-glow": "0 10px 40px -10px rgba(122,189,188,0.55)",
      },
    },
  },
  plugins: [],
}
