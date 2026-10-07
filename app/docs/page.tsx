import type { Metadata } from 'next'
import DocsClient from '@/components/docs/docs-client'

export const metadata: Metadata = {
    title: 'Developer API — Data Bundles, Airtime, ECG, Ghana Water, DStv, GOtv & StarTimes | Arhms GH',
    description:
        "Arhms GH's developer API for Ghana: buy and resell MTN, Telecel and AirtelTigo data bundles and airtime, pay ECG, Ghana Water, DStv, GOtv and StarTimes bills, and check WAEC/exam results — all programmatically, with webhooks and a wallet-based balance.",
    keywords: [
        'Ghana data bundle API', 'MTN data API', 'Telecel data API', 'AirtelTigo data API',
        'airtime API Ghana', 'utility bill API Ghana', 'ECG bill payment API', 'Ghana Water API',
        'DStv payment API', 'GOtv payment API', 'StarTimes payment API', 'developer API Ghana',
    ],
    openGraph: {
        title: 'Arhms GH Developer API',
        description:
            'Data bundles, airtime, utility bills (ECG, Ghana Water, DStv, GOtv, StarTimes) and results checker — one API, one wallet.',
        type: 'website',
        url: 'https://arhmsgh.com/docs',
    },
}

// The catalogue carries lucide icon components, which cannot cross the server/client
// boundary as props — so the client component imports it directly rather than
// receiving it from here.
export default function DocsPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Arhms GH Developer API',
        provider: {
            '@type': 'Organization',
            name: 'ARHMS TECHNOLOGIES',
            url: 'https://arhmsgh.com',
        },
        areaServed: 'GH',
        description:
            'REST API for data bundles (MTN, Telecel, AirtelTigo), airtime top-ups, utility bill payments (ECG, Ghana Water, DStv, GOtv, StarTimes) and exam results checker PINs.',
        serviceType: 'Payments API',
        offers: [
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'MTN, Telecel and AirtelTigo data bundle API' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'MTN, Telecel and AirtelTigo airtime top-up API' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'ECG prepaid bill payment API' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Ghana Water bill payment API' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'DStv, GOtv and StarTimes bill payment API' } },
        ],
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <DocsClient />
        </>
    )
}
