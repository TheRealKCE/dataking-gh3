import type { MetadataRoute } from 'next'

// Keeps this to routes verified public and crawlable — most of app/ sits behind
// auth (dashboard, admin, portal) or is per-shop dynamic content, neither of
// which belongs in a static sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: 'https://arhmsgh.com',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: 'https://arhmsgh.com/docs',
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
    ]
}
