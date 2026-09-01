/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ---------------------------------------------------------------
           BRAND — Primary Red #df3c27
           Reserved for primary CTAs, active navigation, and brand accents.
           --------------------------------------------------------------- */
        brand: {
          50: "#fef4f2",
          100: "#fde6e1",
          200: "#fbcfc7",
          300: "#f7ac9f",
          400: "#ef7c67",
          500: "#df3c27",
          600: "#c72f1d",
          700: "#a72518",
          800: "#8a2118",
          900: "#73201a",
          950: "#3e0d09",
        },

        /* ---------------------------------------------------------------
           BRAND — Primary Blue #2d2b6f
           Navigation surfaces, headings, secondary actions.
           --------------------------------------------------------------- */
        navy: {
          50: "#f3f3f9",
          100: "#e6e6f2",
          200: "#cbcae4",
          300: "#a6a4ce",
          400: "#7d7ab2",
          500: "#5b5899",
          600: "#45427f",
          700: "#2d2b6f",
          800: "#252359",
          900: "#1d1c45",
          950: "#121128",
        },

        /* ---------------------------------------------------------------
           NEUTRALS — slightly navy-tinted so greys sit with the brand blue
           instead of reading as cold pure grey.
           --------------------------------------------------------------- */
        surface: {
          DEFAULT: "#ffffff",
          raised: "#ffffff",
          sunken: "#f7f8fb",
          muted: "#f1f3f8",
        },
        line: {
          subtle: "#eef0f5",
          DEFAULT: "#e2e5ee",
          strong: "#cdd2e0",
        },
        content: {
          primary: "#1b1f33",
          secondary: "#4d5573",
          muted: "#727a94",
          disabled: "#a5abbd",
          inverse: "#ffffff",
        },

        /* --- Semantic states ------------------------------------------- */
        success: {
          50: "#ecfdf3",
          100: "#d1fadf",
          200: "#a6f4c5",
          500: "#12b76a",
          600: "#039855",
          700: "#027a48",
        },
        warning: {
          50: "#fffaeb",
          100: "#fef0c7",
          200: "#fedf89",
          500: "#f79009",
          600: "#dc6803",
          700: "#b54708",
        },
        danger: {
          50: "#fef3f2",
          100: "#fee4e2",
          200: "#fecdca",
          500: "#f04438",
          600: "#d92d20",
          700: "#b42318",
        },
        info: {
          50: "#eff8ff",
          100: "#d1e9ff",
          200: "#b2ddff",
          500: "#2e90fa",
          600: "#1570ef",
          700: "#175cd3",
        },

        /* ---------------------------------------------------------------
           LEGACY TOKENS — preserved verbatim.
           Markup across the app still carries the original dark-theme
           utility names (bg-ink-900, text-white). These remappings are what
           render it as a light UI; changing them would break every screen.
           --------------------------------------------------------------- */
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

      /* -----------------------------------------------------------------
         TYPOGRAPHY
         Inter is already loaded by index.html and is built for dense UI.
         The geometric brand faces lead the display stack so headings keep
         brand character where they are installed.
         ----------------------------------------------------------------- */
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "Galano Grotesque",
          "Gotham",
          "Space Grotesk",
          "Inter",
          "ui-sans-serif",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        caption: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        small: ["0.8125rem", { lineHeight: "1.25rem" }],
        body: ["0.875rem", { lineHeight: "1.375rem" }],
        "body-lg": ["0.9375rem", { lineHeight: "1.5rem" }],
        h3: ["1rem", { lineHeight: "1.5rem", letterSpacing: "-0.005em" }],
        h2: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.011em" }],
        h1: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.018em" }],
        display: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.022em" }],
      },

      /* --- Spacing rhythm (4px base) ---------------------------------- */
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        18: "4.5rem",
      },

      /* --- Restrained radius scale ------------------------------------ */
      borderRadius: {
        xs: "0.25rem",
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "0.875rem",
        "3xl": "1rem",
      },

      /* --- Soft elevation, no dated drop shadows ---------------------- */
      boxShadow: {
        xs: "0 1px 2px rgba(23, 27, 43, 0.04)",
        sm: "0 1px 3px rgba(23, 27, 43, 0.06), 0 1px 2px rgba(23, 27, 43, 0.04)",
        DEFAULT: "0 2px 4px -1px rgba(23, 27, 43, 0.05), 0 1px 2px rgba(23, 27, 43, 0.04)",
        md: "0 4px 8px -2px rgba(23, 27, 43, 0.06), 0 2px 4px -2px rgba(23, 27, 43, 0.04)",
        lg: "0 12px 16px -4px rgba(23, 27, 43, 0.07), 0 4px 6px -2px rgba(23, 27, 43, 0.03)",
        xl: "0 20px 24px -4px rgba(23, 27, 43, 0.08), 0 8px 8px -4px rgba(23, 27, 43, 0.03)",
        "2xl": "0 24px 48px -12px rgba(23, 27, 43, 0.18)",
        overlay: "0 24px 48px -12px rgba(23, 27, 43, 0.18)",
        "focus-brand": "0 0 0 3px rgba(223, 60, 39, 0.18)",
        "focus-navy": "0 0 0 3px rgba(45, 43, 111, 0.16)",
        /* legacy — still referenced by marketing components */
        "brand-glow": "0 10px 40px -10px rgba(223, 60, 39, 0.55)",
      },

      transitionDuration: {
        fast: "120ms",
        DEFAULT: "160ms",
        slow: "240ms",
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
        "fade-in": "fade-in 160ms ease-out",
        "scale-in": "scale-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1)",
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
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },

      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,1) 95%), radial-gradient(circle at top, rgba(65,151,203,0.12), transparent 60%), linear-gradient(rgba(45,43,111,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(45,43,111,0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}
