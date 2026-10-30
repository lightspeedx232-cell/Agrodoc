/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // AgroDoc palette: green, white, earthy tones
        brand: {
          50: "#f1f9f1",
          100: "#dcefdc",
          200: "#bce0bd",
          300: "#8fcd91",
          400: "#5cb360",
          500: "#379b46",
          600: "#248036",
          700: "#1c6a2e",
          800: "#1a5528",
          900: "#164722",
        },
        earth: {
          50: "#faf7f2",
          100: "#f0e8d8",
          200: "#e2d2b4",
          300: "#d0b585",
          400: "#bd9451",
          500: "#a87a3a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
