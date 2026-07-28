/**
 * Data model for the Scout niche-discovery tool.
 *
 * These types intentionally mirror the suggested API shapes so the mock data
 * below can be swapped for real analytics later with no component changes:
 *   GET /scout/stats     -> PlatformStats
 *   GET /scout/niches    -> Niche[]
 *   GET /scout/niches/:id-> Niche (with trend + relatedNiches populated)
 *   GET /scout/trending  -> string[]
 */

export type CompetitionLevel = 'low' | 'medium' | 'high'

export type SortKey = 'opportunity' | 'volume' | 'competition'

export type ViewMode = 'grid' | 'list'

export interface TrendPoint {
    /** ISO-ish short label, e.g. "Jun 12" */
    label: string
    /** searches on that day */
    value: number
}

export interface TopListing {
    title: string
    price: number
    location: string
}

export interface Niche {
    id: string
    name: string
    category: string
    /** searches per month */
    searchVolume: number
    /** % change vs previous period (can be negative) */
    searchVolumeTrend: number
    competitionLevel: CompetitionLevel
    /** 0-100, higher = better opportunity */
    opportunityScore: number
    trendingRank: number
    relatedNiches: string[]
    avgPrice: { min: number; max: number }
    topListingsCount: number
    /** last ~90 days of daily search volume for the detail chart */
    history: TrendPoint[]
    topListings: TopListing[]
}

export interface PlatformStats {
    totalSearches: number
    productsTracked: number
    totalCategories: number
    nichesFound: number
}

/* ------------------------------------------------------------------ */
/* Mock data — replace with fetches to the /scout endpoints later.     */
/* ------------------------------------------------------------------ */

export const MOCK_STATS: PlatformStats = {
    totalSearches: 114_200_000,
    productsTracked: 3_100_000,
    totalCategories: 172,
    nichesFound: 62_400,
}

export const MOCK_TRENDING: string[] = [
    'mazda demo',
    'Chevy Cruze',
    'tecno camron 50 ultra',
    'iphone 13 pro max',
    'ps5 slim',
    'ring light',
]

/**
 * Deterministic 90-point history so server and client render identically
 * (no Math.random / Date at module load, which would break hydration).
 */
function makeHistory(base: number, trend: number): TrendPoint[] {
    const months = ['Apr', 'May', 'Jun']
    const points: TrendPoint[] = []
    for (let i = 0; i < 90; i++) {
        // gentle drift towards the trend direction + a repeatable wobble
        const drift = (i / 89) * (trend / 100) * base
        const wobble = Math.sin(i / 4) * base * 0.06 + Math.cos(i / 9) * base * 0.03
        const value = Math.max(0, Math.round(base * 0.7 + drift + wobble))
        const month = months[Math.floor(i / 30)] ?? 'Jun'
        const day = (i % 30) + 1
        points.push({ label: `${month} ${day}`, value })
    }
    return points
}

interface NicheSeed {
    id: string
    name: string
    category: string
    searchVolume: number
    searchVolumeTrend: number
    competitionLevel: CompetitionLevel
    opportunityScore: number
    relatedNiches: string[]
    avgPrice: { min: number; max: number }
    topListingsCount: number
    topListings: TopListing[]
}

const SEEDS: NicheSeed[] = [
    {
        id: 'toyota-vitz',
        name: 'Toyota Vitz',
        category: 'Vehicles',
        searchVolume: 214_000,
        searchVolumeTrend: 12,
        competitionLevel: 'high',
        opportunityScore: 58,
        relatedNiches: ['Toyota Yaris', 'Toyota Passo', 'Honda Fit'],
        avgPrice: { min: 45_000, max: 95_000 },
        topListingsCount: 1240,
        topListings: [
            { title: '2015 Toyota Vitz - Registered', price: 78_000, location: 'Accra' },
            { title: 'Toyota Vitz 2013 Fresh Import', price: 62_000, location: 'Kumasi' },
            { title: 'Clean Toyota Vitz 2016', price: 89_000, location: 'Tema' },
        ],
    },
    {
        id: 'mazda-demio',
        name: 'Mazda Demio',
        category: 'Vehicles',
        searchVolume: 41_800,
        searchVolumeTrend: 34,
        competitionLevel: 'low',
        opportunityScore: 91,
        relatedNiches: ['Mazda 2', 'Mazda Axela', 'Ford Fiesta'],
        avgPrice: { min: 38_000, max: 72_000 },
        topListingsCount: 96,
        topListings: [
            { title: 'Mazda Demio 2016 Skyactiv', price: 58_000, location: 'Accra' },
            { title: 'Neat Mazda Demio 2014', price: 44_000, location: 'Takoradi' },
        ],
    },
    {
        id: 'chevy-cruze',
        name: 'Chevy Cruze',
        category: 'Vehicles',
        searchVolume: 33_500,
        searchVolumeTrend: 21,
        competitionLevel: 'low',
        opportunityScore: 84,
        relatedNiches: ['Chevrolet Malibu', 'Hyundai Elantra', 'Kia Cerato'],
        avgPrice: { min: 42_000, max: 80_000 },
        topListingsCount: 71,
        topListings: [
            { title: 'Chevy Cruze 2014 - AC Chilling', price: 55_000, location: 'Accra' },
            { title: 'Chevrolet Cruze LT 2013', price: 48_000, location: 'Kumasi' },
        ],
    },
    {
        id: 'iphone-13-pro-max',
        name: 'iPhone 13 Pro Max',
        category: 'Phones & Tablets',
        searchVolume: 128_000,
        searchVolumeTrend: -6,
        competitionLevel: 'high',
        opportunityScore: 46,
        relatedNiches: ['iPhone 14 Pro Max', 'iPhone 12 Pro Max', 'iPhone 15'],
        avgPrice: { min: 4_800, max: 8_200 },
        topListingsCount: 2100,
        topListings: [
            { title: 'iPhone 13 Pro Max 256GB', price: 6_500, location: 'Accra' },
            { title: 'UK Used iPhone 13 Pro Max', price: 5_400, location: 'Kumasi' },
            { title: 'iPhone 13 Pro Max - Clean', price: 7_100, location: 'Tema' },
        ],
    },
    {
        id: 'tecno-camon-50',
        name: 'Tecno Camon 50 Ultra',
        category: 'Phones & Tablets',
        searchVolume: 52_300,
        searchVolumeTrend: 58,
        competitionLevel: 'low',
        opportunityScore: 88,
        relatedNiches: ['Tecno Camon 40', 'Infinix Note 40', 'itel S25'],
        avgPrice: { min: 2_100, max: 3_400 },
        topListingsCount: 58,
        topListings: [
            { title: 'Tecno Camon 50 Ultra 512GB', price: 3_200, location: 'Accra' },
            { title: 'New Tecno Camon 50 Ultra', price: 2_900, location: 'Kumasi' },
        ],
    },
    {
        id: 'samsung-a15',
        name: 'Samsung Galaxy A15',
        category: 'Phones & Tablets',
        searchVolume: 67_400,
        searchVolumeTrend: 9,
        competitionLevel: 'medium',
        opportunityScore: 64,
        relatedNiches: ['Samsung A25', 'Samsung A05s', 'Redmi 13C'],
        avgPrice: { min: 1_400, max: 2_300 },
        topListingsCount: 430,
        topListings: [
            { title: 'Samsung Galaxy A15 128GB', price: 1_850, location: 'Accra' },
            { title: 'Brand New Samsung A15', price: 2_100, location: 'Tema' },
        ],
    },
    {
        id: 'ps5-slim',
        name: 'PS5 Slim',
        category: 'Electronics',
        searchVolume: 44_900,
        searchVolumeTrend: 41,
        competitionLevel: 'low',
        opportunityScore: 86,
        relatedNiches: ['PS5 Pro', 'PS5 Controller', 'Xbox Series X'],
        avgPrice: { min: 5_500, max: 8_000 },
        topListingsCount: 84,
        topListings: [
            { title: 'PS5 Slim Disc Edition Sealed', price: 7_200, location: 'Accra' },
            { title: 'PS5 Slim + 2 Pads', price: 6_400, location: 'Kumasi' },
        ],
    },
    {
        id: 'ring-light',
        name: 'Ring Light',
        category: 'Electronics',
        searchVolume: 38_200,
        searchVolumeTrend: 27,
        competitionLevel: 'medium',
        opportunityScore: 72,
        relatedNiches: ['Softbox Light', 'Tripod Stand', 'Studio Microphone'],
        avgPrice: { min: 120, max: 650 },
        topListingsCount: 260,
        topListings: [
            { title: '18" Ring Light with Tripod', price: 320, location: 'Accra' },
            { title: 'Ring Light 26cm + Phone Holder', price: 180, location: 'Tema' },
        ],
    },
    {
        id: 'hp-elitebook',
        name: 'HP EliteBook',
        category: 'Electronics',
        searchVolume: 58_600,
        searchVolumeTrend: 4,
        competitionLevel: 'medium',
        opportunityScore: 61,
        relatedNiches: ['Dell Latitude', 'Lenovo ThinkPad', 'HP ProBook'],
        avgPrice: { min: 1_800, max: 4_500 },
        topListingsCount: 510,
        topListings: [
            { title: 'HP EliteBook 840 G5 i7', price: 3_200, location: 'Accra' },
            { title: 'HP EliteBook i5 8th Gen', price: 2_400, location: 'Kumasi' },
        ],
    },
    {
        id: 'air-fryer',
        name: 'Air Fryer',
        category: 'Home, Furniture & Appliances',
        searchVolume: 49_700,
        searchVolumeTrend: 33,
        competitionLevel: 'low',
        opportunityScore: 82,
        relatedNiches: ['Deep Fryer', 'Electric Oven', 'Blender'],
        avgPrice: { min: 380, max: 1_200 },
        topListingsCount: 140,
        topListings: [
            { title: '5.5L Digital Air Fryer', price: 650, location: 'Accra' },
            { title: 'Air Fryer 8L Family Size', price: 890, location: 'Tema' },
        ],
    },
    {
        id: 'office-chair',
        name: 'Ergonomic Office Chair',
        category: 'Home, Furniture & Appliances',
        searchVolume: 22_400,
        searchVolumeTrend: 18,
        competitionLevel: 'low',
        opportunityScore: 79,
        relatedNiches: ['Executive Desk', 'Gaming Chair', 'Standing Desk'],
        avgPrice: { min: 450, max: 2_000 },
        topListingsCount: 88,
        topListings: [
            { title: 'Ergonomic Mesh Office Chair', price: 780, location: 'Accra' },
            { title: 'Executive Leather Chair', price: 1_450, location: 'Kumasi' },
        ],
    },
    {
        id: 'gas-cooker',
        name: '4-Burner Gas Cooker',
        category: 'Home, Furniture & Appliances',
        searchVolume: 31_100,
        searchVolumeTrend: -3,
        competitionLevel: 'high',
        opportunityScore: 42,
        relatedNiches: ['Table Top Cooker', 'Gas Oven', 'Standing Cooker'],
        avgPrice: { min: 700, max: 2_600 },
        topListingsCount: 720,
        topListings: [
            { title: '4 Burner Gas Cooker with Oven', price: 1_500, location: 'Accra' },
            { title: 'Standing Gas Cooker 60x60', price: 1_950, location: 'Tema' },
        ],
    },
    {
        id: 'sneakers',
        name: 'Designer Sneakers',
        category: 'Fashion',
        searchVolume: 74_800,
        searchVolumeTrend: 15,
        competitionLevel: 'high',
        opportunityScore: 51,
        relatedNiches: ['Nike Air Force', 'Jordan 1', 'New Balance 550'],
        avgPrice: { min: 150, max: 900 },
        topListingsCount: 1600,
        topListings: [
            { title: 'Nike Air Force 1 - All Sizes', price: 320, location: 'Accra' },
            { title: 'Jordan 1 Retro High', price: 650, location: 'Kumasi' },
        ],
    },
    {
        id: 'thrift-bale',
        name: 'Thrift Clothing Bale',
        category: 'Fashion',
        searchVolume: 28_900,
        searchVolumeTrend: 46,
        competitionLevel: 'low',
        opportunityScore: 90,
        relatedNiches: ['First Grade Jeans', 'Vintage Tees', 'Kids Bale'],
        avgPrice: { min: 400, max: 3_500 },
        topListingsCount: 64,
        topListings: [
            { title: 'UK First Grade Jeans Bale', price: 2_800, location: 'Accra' },
            { title: 'Vintage T-Shirt Bale 45kg', price: 1_900, location: 'Kumasi' },
        ],
    },
    {
        id: 'baby-stroller',
        name: 'Baby Stroller',
        category: 'Babies & Kids',
        searchVolume: 19_600,
        searchVolumeTrend: 11,
        competitionLevel: 'medium',
        opportunityScore: 68,
        relatedNiches: ['Baby Cot', 'Car Seat', 'Baby Walker'],
        avgPrice: { min: 250, max: 1_400 },
        topListingsCount: 150,
        topListings: [
            { title: '3-in-1 Baby Stroller', price: 650, location: 'Accra' },
            { title: 'Foldable Travel Stroller', price: 380, location: 'Tema' },
        ],
    },
    {
        id: 'solar-inverter',
        name: 'Solar Inverter',
        category: 'Electronics',
        searchVolume: 35_700,
        searchVolumeTrend: 62,
        competitionLevel: 'low',
        opportunityScore: 93,
        relatedNiches: ['Solar Panel', 'Deep Cycle Battery', 'Power Backup'],
        avgPrice: { min: 1_200, max: 12_000 },
        topListingsCount: 74,
        topListings: [
            { title: '3.5KVA Solar Inverter', price: 4_800, location: 'Accra' },
            { title: '5KVA Hybrid Inverter Kit', price: 9_500, location: 'Kumasi' },
        ],
    },
]

export const MOCK_NICHES: Niche[] = SEEDS.map((seed, i) => ({
    ...seed,
    trendingRank: i + 1,
    history: makeHistory(seed.searchVolume / 30, seed.searchVolumeTrend),
}))

export const MOCK_CATEGORIES: string[] = [
    'All',
    'Vehicles',
    'Phones & Tablets',
    'Electronics',
    'Home, Furniture & Appliances',
    'Fashion',
    'Babies & Kids',
]
