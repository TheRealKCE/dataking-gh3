// Network prefixes for Ghanaian phone numbers
const NETWORK_PREFIXES: Record<string, string[]> = {
    'MTN': ['024', '025', '053', '054', '055', '059'],
    'Telecel': ['020', '050'],
    'AirtelTigo': ['026', '027', '056', '057'],
}

export interface PhoneValidationResult {
    isValid: boolean
    network: string | null
    normalizedNumber: string
    error?: string
}

export function validateGhanaianPhone(phone: string): PhoneValidationResult {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // Handle international format (+233)
    if (cleaned.startsWith('233')) {
        cleaned = '0' + cleaned.slice(3)
    }

    // Must be exactly 10 digits
    if (cleaned.length !== 10) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Phone number must be 10 digits',
        }
    }

    // Must start with 0
    if (!cleaned.startsWith('0')) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Phone number must start with 0',
        }
    }

    // Detect network from prefix
    const prefix = cleaned.substring(0, 3)
    let detectedNetwork: string | null = null

    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) {
            detectedNetwork = network
            break
        }
    }

    if (!detectedNetwork) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Invalid network prefix',
        }
    }

    return {
        isValid: true,
        network: detectedNetwork,
        normalizedNumber: cleaned,
    }
}

export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
    }
    return phone
}

export function toInternationalFormat(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.slice(1)
    }
    return '+' + cleaned
}

export function detectNetwork(phone: string): string | null {
    const result = validateGhanaianPhone(phone)
    return result.network
}

export function getNetworkFromPrefix(prefix: string): string | null {
    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) {
            return network
        }
    }
    return null
}

export function isValidPrefix(prefix: string): boolean {
    return Object.values(NETWORK_PREFIXES).flat().includes(prefix)
}
