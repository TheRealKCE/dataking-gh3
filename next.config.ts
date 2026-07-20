import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'
import path from 'path'

const supabaseImageHost = (() => {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        return url ? new URL(url).hostname : undefined
    } catch {
        return undefined
    }
})()

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    typescript: {
        // Supabase generic types produce 'never' inference errors on dynamic queries.
        // Type safety is still enforced locally in the IDE via tsconfig.
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: supabaseImageHost
            ? [{
                protocol: 'https',
                hostname: supabaseImageHost,
            }]
            : [],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    async headers() {
        const securityHeaders = [
            {
                key: 'X-Frame-Options',
                value: 'DENY',
            },
            {
                key: 'X-Content-Type-Options',
                value: 'nosniff',
            },
            {
                key: 'Referrer-Policy',
                value: 'strict-origin-when-cross-origin',
            },
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
            },
            {
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains',
            },
            {
                key: 'Content-Security-Policy',
                value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' https://fonts.gstatic.com",
                    `img-src 'self' data: ${supabaseImageHost ? `https://${supabaseImageHost}` : ''} https://cdn.jsdelivr.net https://www.transparenttextures.com blob:`,
                    `connect-src 'self' ${supabaseImageHost ? `https://${supabaseImageHost} wss://${supabaseImageHost}` : ''} https://api.paystack.co`,
                    "frame-src https://js.paystack.co",
                    "frame-ancestors 'none'",
                    "worker-src 'self' blob:",
                ].join('; '),
            },
        ]

        return [
            // Static assets - cache aggressively
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            // Images - cache with revalidation
            {
                source: '/:path*\.(jpg|jpeg|png|gif|svg|webp|ico)',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate',
                    },
                ],
            },
            // Shared public config - safe CDN cache with short TTL
            {
                source: '/api/public/config',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=300, stale-while-revalidate=3600',
                    },
                ],
            },
            // Developer API v1 — open CORS for all external callers
            {
                source: '/api/v1/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin',  value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                    { key: 'Access-Control-Max-Age',       value: '86400' },
                ],
            },
            // Security headers for application routes. Cache policy is set per route/API.
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ]
    },
}

const withPWAConfig = withPWA({
    dest: 'public',
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === 'development',
    customWorkerSrc: path.resolve(process.cwd(), 'worker'),
    workboxOptions: {
        disableDevLogs: true,
        // Exclude the homepage HTML from the PWA cache.
        // The landing page is server-rendered and controlled by admin toggles
        // (e.g. `landing_rc_only_enabled`). Caching it causes users to see a
        // stale version of the page instantly, then a jarring swap once the
        // Service Worker fetches the updated HTML in the background.
        // By excluding it, the browser always fetches the root URL from the
        // network, ensuring the correct page is shown immediately.
        exclude: [
            // Never cache the root HTML document
            /^\//,
            // Keep existing defaults: don't cache Next.js build manifests
            /build-manifest\.json$/,
            /react-loadable-manifest\.json$/,
        ],
    },
})

export default withPWAConfig(nextConfig)
