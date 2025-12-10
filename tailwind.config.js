/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3f7df0',
        secondary: '#8e8e8e',
        accent: '#4cb0ff',
        border: '#dfe3e9',
        muted: '#f4f6fa',
      },
    },
  },
  plugins: [],
};
