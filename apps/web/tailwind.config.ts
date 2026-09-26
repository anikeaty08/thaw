import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

// Thaw's palette is built on one idea: collateral is frozen (cold, cyan) until it thaws into
// flowing repayment (warm, ember). Everything else is a quiet backdrop for that one contrast.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Every color is a CSS variable (channels only) so the dark and white themes share one set of
      // class names. Values live in app/globals.css under :root and [data-theme="light"].
      colors: {
        glacier: { 950: "rgb(var(--glacier-950) / <alpha-value>)", 900: "rgb(var(--glacier-900) / <alpha-value>)", 800: "rgb(var(--glacier-800) / <alpha-value>)", 700: "rgb(var(--glacier-700) / <alpha-value>)", 600: "rgb(var(--glacier-600) / <alpha-value>)", 500: "rgb(var(--glacier-500) / <alpha-value>)" },
        frost: { 50: "rgb(var(--frost-50) / <alpha-value>)", 100: "rgb(var(--frost-100) / <alpha-value>)", 200: "rgb(var(--frost-200) / <alpha-value>)", 300: "rgb(var(--frost-300) / <alpha-value>)", 400: "rgb(var(--frost-400) / <alpha-value>)", 500: "rgb(var(--frost-500) / <alpha-value>)", 600: "rgb(var(--frost-600) / <alpha-value>)" },
        ember: { 300: "rgb(var(--ember-300) / <alpha-value>)", 400: "rgb(var(--ember-400) / <alpha-value>)", 500: "rgb(var(--ember-500) / <alpha-value>)", 600: "rgb(var(--ember-600) / <alpha-value>)" },
        frostwhite: "rgb(var(--ink) / <alpha-value>)",
        mist: { 300: "rgb(var(--mist-300) / <alpha-value>)", 400: "rgb(var(--mist-400) / <alpha-value>)", 500: "rgb(var(--mist-500) / <alpha-value>)" },
        success: "rgb(var(--success) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-body)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "thaw-gradient": "linear-gradient(90deg, #087cff 0%, #2d9cff 45%, #ffc48a 78%, #f77f3a 100%)",
      },
      boxShadow: {
        frost: "var(--shadow-panel)",
        ember: "0 0 24px -4px rgba(247,127,58,0.45)",
        glow: "0 8px 30px -8px rgba(8,124,255,0.55)",
      },
      keyframes: {
        // The headline arrives frosted over and comes into focus: the thaw.
        thaw: {
          "0%": { filter: "blur(12px)", opacity: "0", letterSpacing: "0.01em", color: "rgb(var(--frost-200))" },
          "50%": { filter: "blur(1px)", opacity: "1" },
          "100%": { filter: "blur(0)", opacity: "1", letterSpacing: "-0.05em", color: "rgb(var(--ink))" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drip: {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(46px)", opacity: "0" },
        },
      },
      animation: {
        thaw: "thaw 1.4s cubic-bezier(0.16,1,0.3,1) both",
        "rise-in": "rise-in 0.6s cubic-bezier(0.16,1,0.3,1) both",
        drip: "drip 1.4s cubic-bezier(0.55,0,1,0.45) infinite",
      },
    },
  },
  plugins: [
    // `light:` variant for the few spots where the white theme needs a different shade.
    plugin(({ addVariant }) => addVariant("light", '[data-theme="light"] &')),
  ],
};

export default config;
