/**
 * Single source of truth for network brand identity.
 *
 * Before this file the same networks were defined in four places with values
 * that did not agree:
 *
 *   tailwind.config network.*      MTN #FFCC00  Telecel #E30613  AT #ED1C24
 *   ShopStorefront networkColors   MTN #FFCE00  Telecel #E60000  iShare #0056B3
 *   ShopStorefront getNetworkCardStyle          Telecel #da291c  iShare #2463eb
 *   inline SVG logo fills                       Telecel #e63946
 *
 * Four different Telecel reds and two MTN yellows, so the same network looked
 * like a different brand depending on which component rendered it. The values
 * below are the canonical ones (MTN and Telecel match the operators' actual
 * brand colours); everything else derives from here.
 *
 * Network colours are brand identity, NOT theme: they must stay fixed in light
 * and dark, and must never be swept into a design token. scripts/check-theme-scope.js
 * enforces that these hexes appear nowhere else.
 */

export type NetworkId =
    | 'MTN'
    | 'Telecel'
    | 'AT-iShare'
    | 'AT-BigTime'
    | 'AT'
    | 'Special MTN Mashup'
    | 'EXPRESS MTN'

export interface NetworkBrand {
    id: NetworkId
    /** Short label for chips and segmented controls. */
    label: string
    /** Canonical brand colour. */
    hex: string
    /** One step darker — borders, the recessed strip on a card. */
    hexDeep: string
    /**
     * Which ink stays legible on `hex`. MTN yellow needs black (white on
     * #FFCC00 is 1.7:1 and unreadable); the rest carry white.
     */
    ink: 'black' | 'white'
    /** Which logo mark to draw. */
    mark: 'mtn' | 'telecel' | 'at'
}

/** Fixed display order, matching the main platform. */
export const NETWORK_ORDER: NetworkId[] = [
    'MTN',
    'Telecel',
    'AT-iShare',
    'AT-BigTime',
    'AT',
    'Special MTN Mashup',
    'EXPRESS MTN',
]

export const NETWORKS: Record<NetworkId, NetworkBrand> = {
    MTN: { id: 'MTN', label: 'MTN', hex: '#FFCC00', hexDeep: '#E6B800', ink: 'black', mark: 'mtn' },
    Telecel: { id: 'Telecel', label: 'Telecel', hex: '#E30613', hexDeep: '#B8040F', ink: 'white', mark: 'telecel' },
    'AT-iShare': { id: 'AT-iShare', label: 'AT iShare', hex: '#0056B3', hexDeep: '#004494', ink: 'white', mark: 'at' },
    'AT-BigTime': { id: 'AT-BigTime', label: 'AT BigTime', hex: '#6F42C1', hexDeep: '#5A32A3', ink: 'white', mark: 'at' },
    AT: { id: 'AT', label: 'AT', hex: '#F97316', hexDeep: '#EA580C', ink: 'white', mark: 'at' },
    'Special MTN Mashup': { id: 'Special MTN Mashup', label: 'MTN Mashup', hex: '#FFCC00', hexDeep: '#E6B800', ink: 'black', mark: 'mtn' },
    'EXPRESS MTN': { id: 'EXPRESS MTN', label: 'MTN Express', hex: '#FFCC00', hexDeep: '#E6B800', ink: 'black', mark: 'mtn' },
}

/** Safe lookup: unknown network ids fall back to MTN rather than crashing. */
export function getNetwork(id: string): NetworkBrand {
    return NETWORKS[id as NetworkId] ?? NETWORKS.MTN
}

/**
 * Inline style for a network-coloured surface. Returned as `style` rather than
 * Tailwind classes on purpose — arbitrary-value classes built from data have to
 * be safelisted, and these come from the database.
 */
export function networkSurface(id: string): React.CSSProperties {
    const n = getNetwork(id)
    return { backgroundColor: n.hex, color: n.ink === 'black' ? '#000000' : '#FFFFFF' }
}

export function networkAccentBar(id: string): React.CSSProperties {
    const n = getNetwork(id)
    return { background: `linear-gradient(90deg, ${n.hex} 0%, ${n.hexDeep} 100%)` }
}

/** Ink that stays legible on top of the network colour. */
export function networkInk(id: string): string {
    return getNetwork(id).ink === 'black' ? '#000000' : '#FFFFFF'
}

/* ── Payment (MoMo) networks ──────────────────────────────────────────────
   The wallet being charged, which is not necessarily the bundle's network. */

export type PayNetwork = 'MTN' | 'Telecel' | 'AT'

export const PAY_NETWORK_PREFIXES: Record<PayNetwork, string[]> = {
    MTN: ['024', '054', '055', '059', '025', '053', '098'],
    Telecel: ['020', '050'],
    AT: ['026', '027', '056', '028', '058', '057'],
}

export function detectPayNetwork(raw: string): PayNetwork | null {
    const prefix = raw.replace(/\s+/g, '').substring(0, 3)
    if (prefix.length < 3) return null
    for (const [net, prefixes] of Object.entries(PAY_NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) return net as PayNetwork
    }
    return null
}

/* ── Logo marks ───────────────────────────────────────────────────────────
   Fills reference the canonical hexes above so a logo can never drift from
   the surface it sits on. */

function MtnMark() {
    return (
        <svg viewBox="0 0 60 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="30" fill={NETWORKS.MTN.hex} />
            <ellipse cx="30" cy="30" rx="26" ry="14" fill="#005B82" />
            <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="900" fill="#FFFFFF" fontStyle="italic" fontFamily="Arial Black, Arial, sans-serif" letterSpacing="-0.5">MTN</text>
        </svg>
    )
}

function TelecelMark() {
    return (
        <svg viewBox="0 0 60 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="30" fill={NETWORKS.Telecel.hex} />
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FFFFFF">Telecel</text>
        </svg>
    )
}

function AtMark() {
    return (
        <svg viewBox="0 0 60 60" className="w-full h-full bg-white rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="29" y="38" textAnchor="end" fontSize="26" fontWeight="bold" fill={NETWORKS.Telecel.hex} fontFamily="Arial, sans-serif">a</text>
            <text x="30" y="38" textAnchor="start" fontSize="26" fontWeight="bold" fill={NETWORKS['AT-iShare'].hex} fontFamily="Arial, sans-serif">t</text>
            <text x="30" y="48" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#444444" fontFamily="Arial, sans-serif" letterSpacing="0.2">life is simple</text>
        </svg>
    )
}

export function NetworkLogo({ id }: { id: string }) {
    const mark = getNetwork(id).mark
    if (mark === 'mtn') return <MtnMark />
    if (mark === 'telecel') return <TelecelMark />
    return <AtMark />
}
