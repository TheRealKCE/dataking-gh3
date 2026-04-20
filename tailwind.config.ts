import type { Config } from "tailwindcss"

const config = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: '#D4AF37',
                    foreground: '#0a0a0a',
                    50: '#FFF8E7',
                    100: '#FFEED0',
                    200: '#FFD9A0',
                    300: '#FFC470',
                    400: '#FFAF40',
                    500: '#F5A623',
                    600: '#D4AF37',
                    700: '#B89D2E',
                    800: '#8B6F2B',
                    900: '#5C4820',
                },
                secondary: {
                    DEFAULT: '#7B68EE',
                    foreground: '#ffffff',
                    50: '#F3EFFF',
                    100: '#E6DEFF',
                    200: '#CCBDFF',
                    300: '#B39CFF',
                    400: '#9A7BFF',
                    500: '#8B5AFF',
                    600: '#7B68EE',
                    700: '#6B57D9',
                    800: '#5B47C4',
                    900: '#4B37AF',
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: '#06B6D4',
                    foreground: '#ffffff',
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                brand: {
                    dark: '#0A0A0A',
                    surface: '#1a1a1a',
                    surface-light: '#252525',
                    border: '#2d2d2d',
                    light: '#F8FAFC',
                    'light-surface': '#ffffff',
                    'light-border': '#e2e8f0',
                    gold: '#D4AF37',
                    'gold-light': '#E6C547',
                    'gold-dark': '#B89D2E',
                },
                network: {
                    mtn: '#FFCC00',
                    telecel: '#E30613',
                    airteltigo: '#ED1C24',
                },
                mtn: {
                    DEFAULT: "#FFCC00",
                    dark: "#E6B800",
                },
                telecel: {
                    DEFAULT: "#E30613",
                    dark: "#CC0511",
                },
                airteltigo: {
                    DEFAULT: "#ED1C24",
                    dark: "#D41920",
                },
                success: {
                    DEFAULT: "#10B981",
                    foreground: "#FFFFFF",
                },
                warning: {
                    DEFAULT: "#F59E0B",
                    foreground: "#FFFFFF",
                },
            },
            fontFamily: {
                heading: ['Outfit', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "1rem",
                "2xl": "1.5rem",
            },
            fontSize: {
                xs: ['0.75rem', { lineHeight: '1rem' }],
                sm: ['0.875rem', { lineHeight: '1.25rem' }],
                base: ['1rem', { lineHeight: '1.5rem' }],
                lg: ['1.125rem', { lineHeight: '1.75rem' }],
                xl: ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
                '5xl': ['3rem', { lineHeight: '1' }],
                '6xl': ['3.75rem', { lineHeight: '1' }],
                '7xl': ['4.5rem', { lineHeight: '1' }],
            },
            boxShadow: {
                xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                sm: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                base: '0 4px 12px -2px rgb(0 0 0 / 0.15)',
                md: '0 10px 28px -5px rgb(0 0 0 / 0.2)',
                lg: '0 20px 40px -10px rgb(0 0 0 / 0.25)',
                xl: '0 30px 50px -15px rgb(0 0 0 / 0.3)',
                '2xl': '0 40px 60px -20px rgb(0 0 0 / 0.35)',
                'gold': '0 10px 30px -5px rgb(212 175 55 / 0.2)',
                'gold-lg': '0 20px 50px -10px rgb(212 175 55 / 0.25)',
                'inner-luxury': 'inset 0 2px 4px 0 rgb(255 255 255 / 0.1)',
                'glass': '0 8px 32px 0 rgb(31 38 135 / 0.37)',
            },
            backdropBlur: {
                xs: '2px',
                sm: '4px',
                base: '8px',
                md: '12px',
                lg: '16px',
                xl: '24px',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                shimmer: {
                    "100%": {
                        transform: "translateX(100%)",
                    },
                },
                pulse: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: ".5" },
                },
                fadeIn: {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                slideIn: {
                    from: { transform: "translateY(-10px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                "glow-pulse": {
                    "0%, 100%": { 
                        boxShadow: "0 0 20px rgb(212 175 55 / 0.3)",
                        opacity: "1"
                    },
                    "50%": { 
                        boxShadow: "0 0 40px rgb(212 175 55 / 0.5)",
                        opacity: "1"
                    },
                },
                "float": {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-8px)" },
                },
                "shimmer-slow": {
                    "0%": { backgroundPosition: "-1000px 0" },
                    "100%": { backgroundPosition: "1000px 0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                shimmer: "shimmer 2s infinite",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                fadeIn: "fadeIn 0.3s ease-out",
                slideIn: "slideIn 0.3s ease-out",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "float": "float 3s ease-in-out infinite",
                "shimmer-slow": "shimmer-slow 8s linear infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
