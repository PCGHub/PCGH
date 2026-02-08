export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
      colors: {
        primary: '#1F2937',
        secondary: '#3B82F6',
        accent: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        success: '#10B981',
      }
    },
  },
  plugins: [],
}
