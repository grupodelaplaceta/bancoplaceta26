/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4d00ff",
          dark: "#22005f",
          light: "#7b3dff",
        },
      },
    },
  },
  plugins: [],
};
