import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/dashboard', '/api', '/auth', '/portal'],
        },
        sitemap: 'https://arhmsgh.com/sitemap.xml',
    }
}
