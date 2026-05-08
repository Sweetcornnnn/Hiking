/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'saka-cream': '#F5E6D3',
        'saka-brown': '#8B7355',
        'saka-sand': '#D4A574',
        'saka-dark': '#2C3E50',
        'saka-gray': '#6B7280',
        'saka-light': '#FAFAFA',
      },
    },
  },
  plugins: [],
}
