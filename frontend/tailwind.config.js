/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./node_modules/flowbite/**/*.js",
  ],
  darkMode: true,
  theme: {
    extend: {
      colors: {
        "text-primary": "white",
        primary: {
          DEFAULT: '#b13326',
          ...{
            '50': '#fdf4f3',
            '100': '#fce6e4',
            '200': '#fbd1cd',
            '300': '#f7b1aa',
            '400': '#f08479',
            '500': '#e45d4f',
            '600': '#d14031',
            '700': '#b13326',
            '800': '#912d23',
            '900': '#792b23',
            '950': '#41130e',
          },
        },
        background: {
          DEFAULT: '#242424',
          ...{
            '50': '#f6f6f6',
            '100': '#e7e7e7',
            '200': '#d1d1d1',
            '300': '#b0b0b0',
            '400': '#888888',
            '500': '#6d6d6d',
            '600': '#5d5d5d',
            '700': '#4f4f4f',
            '800': '#454545',
            '900': '#3d3d3d',
            '950': '#242424',
          },
        },
      },
    },
  },
  plugins: [
    import('flowbite/plugin.js')
  ],
}
