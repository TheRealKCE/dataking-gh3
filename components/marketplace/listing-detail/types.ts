// Shared data model for the Jiji/OLX-style listing detail prototype.
// Swap `dummyListing` for a real backend fetch later — the shape below is
// what every subcomponent expects.

import type { ListingStatus } from './contact/types'
export type { ListingStatus } from './contact/types'

export interface ListingSpecs {
    condition: string
    transmission: string
    brand: string
    model: string
    year: string
    color: string
    // Any extra key/value specs surface under "Show more" in the specs table.
    [key: string]: string
}

export interface ListingSeller {
    id: string
    name: string
    avatarUrl?: string
    memberSince: string
    verified: boolean
    phone: string
}

export interface Listing {
    id: string
    title: string
    price: number
    currency: string
    negotiable: boolean
    images: string[]
    description: string
    specs: ListingSpecs
    location: string
    postedAt: string
    views: number
    featured: boolean
    status: ListingStatus
    seller: ListingSeller
}

// ---------------------------------------------------------------------------
// Dummy data
// ---------------------------------------------------------------------------

// Self-contained SVG placeholders so the prototype renders with zero network
// or next.config image-domain setup. Replace `images` with real URLs later.
function carPhoto(hue: number, label: string): string {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,42%)"/>
      <stop offset="1" stop-color="hsl(${hue},60%,26%)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <g fill="#ffffff" opacity="0.92">
    <path d="M250 560 q40 -120 120 -140 h360 q90 20 150 140 h80 a40 40 0 0 1 40 40 v70 h-60 a55 55 0 0 0 -110 0 h-300 a55 55 0 0 0 -110 0 h-70 a40 40 0 0 1 -40 -40 v-30 a40 40 0 0 1 40 -40 z"/>
    <circle cx="425" cy="670" r="42" fill="hsl(${hue},60%,26%)"/>
    <circle cx="425" cy="670" r="20" fill="#ffffff"/>
    <circle cx="835" cy="670" r="42" fill="hsl(${hue},60%,26%)"/>
    <circle cx="835" cy="670" r="20" fill="#ffffff"/>
  </g>
  <text x="600" y="820" font-family="system-ui, sans-serif" font-size="46" font-weight="700"
        fill="#ffffff" opacity="0.85" text-anchor="middle">${label}</text>
</svg>`.trim()
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const dummyListing: Listing = {
    id: 'lst_kia_cerato_2025',
    title: 'Kia Cerato Automatic 2025 Red',
    price: 26000,
    currency: 'GHC',
    negotiable: true,
    images: [
        carPhoto(0, 'Front View'),
        carPhoto(210, 'Side Profile'),
        carPhoto(150, 'Interior'),
        carPhoto(45, 'Dashboard'),
        carPhoto(280, 'Rear View'),
    ],
    description:
        "Sleek Kia Cerato in excellent condition. Engine runs smooth with no faults, " +
        "just serviced with fresh oil and new filters. Cold factory AC, reverse camera, " +
        "leather seats, alloy wheels and full sound system. Tyres are almost new. " +
        "Accident-free with clean documents. Test drive welcome — serious buyers only. " +
        "Price is slightly negotiable for a quick sale.",
    specs: {
        condition: 'Local Used',
        transmission: 'Automatic',
        brand: 'Kia',
        model: 'Cerato',
        year: '2025',
        color: 'Red',
        fuel: 'Petrol',
        mileage: '18,500 km',
        bodyType: 'Sedan',
        engineSize: '2.0L',
    },
    location: 'East Legon, Accra',
    postedAt: '2 hours ago',
    views: 1243,
    featured: true,
    status: 'active',
    seller: {
        id: 'sel_kwasi_ben',
        name: 'Kwasi Ben',
        memberSince: '3+ years on Jiji',
        verified: true,
        phone: '+233 24 123 4567',
    },
}
