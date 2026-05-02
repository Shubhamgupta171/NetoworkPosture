/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      // Custom xs for very small phones; rest are Tailwind defaults.
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      // Semantic tokens — driven by CSS variables in `index.css` so the same
      // class names work in both light and dark themes.
      colors: {
        bg: "rgb(var(--surface-base) / <alpha-value>)",
        surface: "rgb(var(--surface-1) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        "border-soft": "rgb(var(--border-soft) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
        "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
        "accent-3": "rgb(var(--accent-3) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--accent) / 0.45), 0 12px 32px -8px rgb(var(--accent) / 0.4)",
        card: "0 4px 24px -8px rgb(var(--shadow) / 0.5)",
        "card-lg": "0 24px 64px -16px rgb(var(--shadow) / 0.65), 0 8px 24px -12px rgb(var(--shadow) / 0.4)",
        ring: "inset 0 0 0 1px rgb(var(--border-soft) / 0.6)",
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"Space Grotesk"', '"Inter"', "ui-sans-serif", "sans-serif"],
      },
      animation: {
        "drift-slow": "drift 24s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "rise": "rise 0.45s cubic-bezier(.2,.7,.2,1) forwards",
        "shimmer": "shimmer 2.4s linear infinite",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -2%, 0) scale(1.05)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(20px) scale(.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      backgroundImage: {
        "mesh-dark":
          "radial-gradient(circle at 18% 12%, rgb(4 212 252 / 0.18), transparent 42%)," +
          "radial-gradient(circle at 90% 5%, rgb(4 118 172 / 0.22), transparent 48%)," +
          "radial-gradient(circle at 80% 90%, rgb(104 216 240 / 0.10), transparent 45%)," +
          "radial-gradient(circle at 10% 95%, rgb(52 123 144 / 0.18), transparent 45%)",
        "mesh-light":
          "radial-gradient(circle at 18% 12%, rgb(104 216 240 / 0.45), transparent 45%)," +
          "radial-gradient(circle at 90% 5%, rgb(4 170 218 / 0.30), transparent 48%)," +
          "radial-gradient(circle at 80% 90%, rgb(140 212 236 / 0.40), transparent 45%)," +
          "radial-gradient(circle at 10% 95%, rgb(238 246 252 / 0.55), transparent 45%)",
      },
    },
  },
  plugins: [],
};
