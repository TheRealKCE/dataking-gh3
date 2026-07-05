/**
 * Marketplace Content Filter
 * Pre-filters listings for scam/contraband/inappropriate content
 */

// Keywords that trigger automatic flagging
const SCAM_KEYWORDS = [
    'wire money',
    'send payment first',
    'bank account',
    'credit card details',
    'routing number',
    'guarantee quick money',
    'guaranteed return',
]

const CONTRABAND_KEYWORDS = [
    'drug',
    'cocaine',
    'heroin',
    'methamphetamine',
    'marijuana',
    'weed',
    'weapons',
    'gun',
    'knife',
    'explosives',
    'fake id',
    'counterfeit',
    'stolen',
]

const INAPPROPRIATE_KEYWORDS = [
    'escort',
    'adult services',
    'xxx',
    'nsfw',
]

// Phone number patterns (to redact in pre-moderation)
const PHONE_PATTERN = /\+?233\s?[\d\s\-\.]{8,}/gi
const PHONE_SIMPLE = /0[2-5]\d\s?\d{3}\s?\d{3,4}/gi

// WhatsApp/MoMo redaction (before showing to other sellers)
const SOCIAL_PATTERN = /(?:whatsapp|telegram|signal|wickr|momo)[\s:]*[\w\d\s\-\.]+/gi

export interface ContentFilterResult {
    passed: boolean
    issues: string[]
    flags: {
        scam: boolean
        contraband: boolean
        inappropriate: boolean
        hasPhone: boolean
        hasSocial: boolean
    }
}

/**
 * Filter listing content for policy violations
 */
export function filterListingContent(
    title: string,
    description: string
): ContentFilterResult {
    const combinedText = `${title} ${description}`.toLowerCase()
    const issues: string[] = []
    const flags = {
        scam: false,
        contraband: false,
        inappropriate: false,
        hasPhone: false,
        hasSocial: false,
    }

    // Check for scam keywords
    for (const keyword of SCAM_KEYWORDS) {
        if (combinedText.includes(keyword.toLowerCase())) {
            flags.scam = true
            issues.push(`Possible scam indicator: "${keyword}"`)
            break
        }
    }

    // Check for contraband
    for (const keyword of CONTRABAND_KEYWORDS) {
        if (combinedText.includes(keyword.toLowerCase())) {
            flags.contraband = true
            issues.push(`Prohibited item: "${keyword}"`)
            break
        }
    }

    // Check for inappropriate content
    for (const keyword of INAPPROPRIATE_KEYWORDS) {
        if (combinedText.includes(keyword.toLowerCase())) {
            flags.inappropriate = true
            issues.push(`Inappropriate content: "${keyword}"`)
            break
        }
    }

    // Check for phone numbers
    if (PHONE_PATTERN.test(description) || PHONE_SIMPLE.test(description)) {
        flags.hasPhone = true
        issues.push('Direct contact information detected (should use in-app messaging)')
    }

    // Check for social/payment info
    if (SOCIAL_PATTERN.test(description)) {
        flags.hasSocial = true
        issues.push('Off-platform contact method detected')
    }

    const passed = !flags.scam && !flags.contraband && !flags.inappropriate

    return {
        passed,
        issues,
        flags,
    }
}

/**
 * Redact sensitive info from description before showing to buyers
 */
export function redactSensitiveInfo(description: string): string {
    let redacted = description
        .replace(PHONE_PATTERN, '[PHONE]')
        .replace(PHONE_SIMPLE, '[PHONE]')
        .replace(SOCIAL_PATTERN, '[CONTACT_INFO]')
    return redacted
}

/**
 * Severity score for moderation queue (higher = more urgent)
 * 0-10 scale
 */
export function calculateRiskScore(filterResult: ContentFilterResult): number {
    let score = 0

    if (filterResult.flags.contraband) score += 10 // Highest
    if (filterResult.flags.scam) score += 8
    if (filterResult.flags.inappropriate) score += 6
    if (filterResult.flags.hasSocial) score += 3
    if (filterResult.flags.hasPhone) score += 2

    return Math.min(score, 10)
}
