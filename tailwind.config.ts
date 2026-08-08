import type { Config } from "tailwindcss"
import defaultTheme from "tailwindcss/defaultTheme"

const config = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',       // ← ensures roleConfig classes are never purged
        './contexts/**/*.{ts,tsx}',  // ← covers any context-level class strings
    ],
    safelist: [
        // Dealer sidebar – arbitrary hex gradient stops
        'from-[#6b21a8]',
        'to-[#4c1d95]',
        // Shared gradient directions used in roleConfig
        'bg-gradient-to-b',
        'bg-gradient-to-r',
        'bg-gradient-to-br',
        // Dealer
        'from-purple-800', 'to-indigo-900',
        'from-purple-600', 'to-indigo-800', 'to-indigo-700',
        'text-purple-100', 'text-purple-200',
        'border-r-purple-700/30', 'border-purple-700/30',
        'hover:bg-white/10', 'bg-white/15', 'bg-white/20',
        'text-white/95', 'text-white/85', 'text-purple-200/80', 'text-purple-200/90',
        'border-white/5', 'border-white/10', 'border-white/30',
        'bg-black/25', 'bg-black/10',
        // Agent
        'from-blue-50/90', 'to-sky-100/50',
        'dark:from-slate-950', 'dark:to-blue-950/20',
        'border-r-blue-200/50', 'dark:border-r-blue-900/50',
        'hover:text-blue-600', 'dark:hover:text-blue-400',
        'hover:bg-blue-500/5',
        'bg-blue-50/90', 'dark:bg-slate-900/80',
        'border-blue-200/60', 'dark:border-b-blue-900/60',
        'from-blue-600', 'to-indigo-700',
        'bg-blue-500/10',
        // Customer — white surfaces, gold-ink text, bright-gold fills
        'bg-white', 'bg-white/85', 'dark:bg-slate-950', 'dark:bg-slate-900/80',
        'border-r-slate-200', 'dark:border-r-slate-800',
        'border-slate-200', 'dark:border-b-slate-800', 'dark:border-slate-800',
        'bg-slate-50', 'dark:bg-slate-800/50', 'border-slate-200/80', 'dark:border-slate-700/60',
        'from-brand-gold', 'to-brand-gold-dark',
        'hover:text-brand-gold-ink', 'dark:hover:text-brand-gold',
        'hover:bg-brand-gold/[0.07]', 'bg-brand-gold/[0.12]', 'bg-brand-gold/15',
        'bg-brand-gold/[0.06]', 'dark:bg-brand-gold/[0.08]',
        'text-brand-gold-ink', 'dark:text-brand-gold',
        'border-brand-gold/25', 'border-brand-gold/20', 'dark:border-brand-gold/20',
        'ring-1', 'ring-inset', 'ring-brand-gold/20', 'ring-brand-gold/25',
        'shadow-soft', 'hover:shadow-soft-lg', 'shadow-nav', 'shadow-gold-fab',
        // Badges / pills
        'bg-violet-500/15', 'text-violet-600', 'dark:text-violet-400',
        'bg-blue-500/15', 'text-blue-600', 'dark:text-blue-400',
        'bg-amber-500/15', 'text-amber-600', 'dark:text-amber-400',
        'bg-rose-500/15', 'text-rose-600', 'dark:text-rose-400',
        'bg-emerald-500/15', 'text-emerald-600', 'dark:text-emerald-400',
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
                // The 50-900 gold ramp that used to live here contradicted
                // --primary (blue) and had zero usages across the codebase.
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                // Likewise the 50-900 purple ramp: zero usages. DEFAULT stays a
                // literal for now and moves onto hsl(var(--secondary)) in Phase 1,
                // which is a deliberate visual change (it currently paints every
                // shadcn hover state bright purple).
                secondary: {
                    DEFAULT: '#7B68EE',
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
                    'surface-light': '#252525',
                    border: '#2d2d2d',
                    light: '#F8FAFC',
                    'light-surface': '#ffffff',
                    'light-border': '#e2e8f0',
                    gold: '#D4AF37',
                    'gold-light': '#E6C547',
                    'gold-dark': '#B89D2E',
                    // Deep bronze-gold for accent TEXT on white surfaces.
                    // #D4AF37 is only 2.1:1 on white and #B89D2E is 2.7:1 — both
                    // fail WCAG AA. This is 6.0:1, so gold-family text stays legible.
                    // Bright gold is still the right choice for fills, where the
                    // near-black label sitting on it carries the contrast.
                    'gold-ink': '#7A5F22',
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
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                },
                info: {
                    DEFAULT: "hsl(var(--info))",
                    foreground: "hsl(var(--info-foreground))",
                },
            },
            // These must point at next/font's generated CSS vars, not the raw
            // family names. Naming the family directly bypassed next/font
            // entirely, so `font-heading`/`font-body` fell back to whatever
            // "Outfit"/"Inter" the device happened to have installed.
            fontFamily: {
                sans: ['var(--font-body)', ...defaultTheme.fontFamily.sans],
                body: ['var(--font-body)', ...defaultTheme.fontFamily.sans],
                heading: ['var(--font-heading)', ...defaultTheme.fontFamily.sans],
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
                // Two-layer elevation: a tight contact shadow to hold the card's
                // edge against off-white, plus a wide soft one for depth. A single
                // blurred shadow reads as a smudge on white-on-white.
                'soft': '0 1px 2px rgb(16 24 40 / 0.04), 0 12px 32px -8px rgb(16 24 40 / 0.10)',
                'soft-lg': '0 1px 2px rgb(16 24 40 / 0.04), 0 16px 40px -8px rgb(16 24 40 / 0.16)',
                'nav': '0 -8px 24px -8px rgb(16 24 40 / 0.12)',
                'gold-fab': '0 8px 20px -4px rgb(212 175 55 / 0.5)',
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
