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
                    DEFAULT: '#4F46E5',
                    foreground: '#ffffff',
                },
                secondary: {
                    DEFAULT: '#7C3AED',
                    foreground: '#ffffff',
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
                    DEFAULT: '#0D9488',
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
                    surface: '#111111',
                    border: '#1f1f1f',
                    light: '#F8FAFC',
                    'light-surface': '#ffffff',
                    'light-border': '#e2e8f0',
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
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                shimmer: "shimmer 2s infinite",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                fadeIn: "fadeIn 0.3s ease-out",
                slideIn: "slideIn 0.3s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
