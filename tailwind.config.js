// tailwind.config.js
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-exo)', 'sans-serif'], // So `font-sans` = Exo with fallback
        body: ['var(--font-exo)', 'sans-serif'], // Body font = Exo with fallback
        display: ['var(--font-exo)', 'sans-serif'], // Display font = Exo with fallback
        exo: ['var(--font-exo)', 'sans-serif'], // Explicit Exo font class
      },
      fontSize: {
        base: '12px', // So `text-base` = 12px
      },
    },
  },
  plugins: [],
};
