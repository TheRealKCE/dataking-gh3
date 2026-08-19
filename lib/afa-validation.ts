/**
 * Shared AFA registration constants and validation.
 *
 * Single source of truth for both entry points — the logged-in dashboard form
 * (/dashboard/afa-orders + /api/user/afa-registration) and the public storefront
 * (ShopStorefront + /api/shop/afa/initialize). Keeping the ID formats in one
 * module is the point: a storefront that accepted an ID shape the dashboard
 * rejects would put unprocessable applications in the admin queue.
 *
 * Client-safe — no server-only imports, so the storefront component can use the
 * masking helpers directly.
 */

// ── Allowlists ──────────────────────────────────────────────────────────────
export const VALID_ID_TYPES = ['Ghana Card', 'Passport', "Driver's License", 'Voter ID'] as const

export const VALID_REGIONS = [
    'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern',
    'Volta', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
    'Savannah', 'North East', 'Oti', 'Western North',
] as const

/** Alias kept for the dashboard form, which renders this as a plain string list. */
export const REGIONS: readonly string[] = VALID_REGIONS

/** Select options for the ID type dropdown, with per-type input hints. */
export const ID_TYPES = [
    { value: 'Ghana Card', label: 'Ghana Card', placeholder: 'GHA-XXXXXXXXX-X', hint: 'Format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)' },
    { value: 'Passport', label: 'Passport', placeholder: 'G1234567', hint: 'Format: Letter followed by 7 digits (e.g. G1234567)' },
    { value: "Driver's License", label: "Driver's License", placeholder: 'DVLA-XXXXXXXXXX', hint: 'Format: DVLA- followed by 10 digits' },
    { value: 'Voter ID', label: 'Voter ID', placeholder: '0123456789', hint: 'Format: 10 digit numeric code' },
]

export const ID_PATTERNS: Record<string, RegExp> = {
    'Ghana Card': /^GHA-\d{9}-\d$/,
    'Passport': /^[A-Z]\d{7}$/,
    "Driver's License": /^DVLA-\d{10}$/,
    'Voter ID': /^\d{10}$/,
}

/** Server-side view of ID_PATTERNS, carrying the human-readable format hint. */
export const ID_FORMAT_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
    'Ghana Card':       { pattern: ID_PATTERNS['Ghana Card'],       hint: 'GHA-XXXXXXXXX-X'  },
    'Passport':         { pattern: ID_PATTERNS['Passport'],         hint: '[A-Z]XXXXXXX'     },
    "Driver's License": { pattern: ID_PATTERNS["Driver's License"], hint: 'DVLA-XXXXXXXXXX'  },
    'Voter ID':         { pattern: ID_PATTERNS['Voter ID'],         hint: '10 numeric digits' },
}

/** Maximum character lengths per field (protects against oversized DB payloads). */
export const FIELD_MAX_LENGTHS: Record<string, number> = {
    full_name: 100,
    phone:     20,
    id_number: 20,
    id_type:   50,
    region:    100,
    location:  100,
    notes:     500,
}

export const AFA_REQUIRED_FIELDS = [
    'full_name', 'phone', 'id_type', 'id_number', 'location', 'region', 'date_of_birth',
] as const

export const MIN_AFA_AGE = 18

// ── Client helpers ──────────────────────────────────────────────────────────

/** Returns an error hint when the ID number does not match its type, else null. */
export function validateId(idType: string, idNumber: string): string | null {
    const pattern = ID_PATTERNS[idType]
    if (!pattern) return null
    if (!pattern.test(idNumber.trim())) {
        const meta = ID_TYPES.find(t => t.value === idType)
        return meta?.hint ?? 'Invalid ID format'
    }
    return null
}

/**
 * Auto-formats the id_number field as the user types, matching Ghana ID formats.
 * Handles backspace correctly by always re-deriving the formatted value from raw digits.
 */
export function maskIdNumber(idType: string, raw: string): string {
    switch (idType) {
        case 'Ghana Card': {
            // User types digits only; GHA- and trailing dash are auto-inserted
            const digits = raw.replace(/\D/g, '').slice(0, 10)
            if (digits.length === 0) return ''
            if (digits.length <= 9) return 'GHA-' + digits
            return 'GHA-' + digits.slice(0, 9) + '-' + digits[9]
        }
        case 'Passport': {
            // First char must be an uppercase letter; rest are digits (max 7)
            const upper = raw.toUpperCase()
            const letter = upper[0]?.match(/[A-Z]/) ? upper[0] : ''
            const digits = upper.slice(1).replace(/\D/g, '').slice(0, 7)
            return letter + digits
        }
        case "Driver's License": {
            // Strip any existing DVLA- prefix, keep only up to 10 digits, re-add prefix
            const stripped = raw.replace(/^DVLA-?/i, '')
            const digits = stripped.replace(/\D/g, '').slice(0, 10)
            // Return '' when no digits so the field is fully clearable
            if (digits.length === 0) return ''
            return 'DVLA-' + digits
        }
        case 'Voter ID': {
            // Digits only, max 10
            return raw.replace(/\D/g, '').slice(0, 10)
        }
        default:
            return raw
    }
}

/** Age in whole years on today's date, or null when the input is unparseable. */
export function ageFromDob(dateOfBirth: string): number | null {
    const dob = new Date(dateOfBirth)
    if (isNaN(dob.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--
    }
    return age
}

/** `max` attribute for the DOB input — the latest date that is still 18+. */
export function maxDobInputValue(): string {
    const d = new Date()
    d.setFullYear(d.getFullYear() - MIN_AFA_AGE)
    return d.toISOString().split('T')[0]
}

// ── Server-side validation ──────────────────────────────────────────────────

export type AfaValidationError = {
    /** Message safe to return to the caller. */
    error: string
    /** 400 for bad input; 500 when the server itself is misconfigured. */
    status: 400 | 500
}

/**
 * Validates an AFA applicant payload. Returns null when valid, or the error and
 * the status the route should respond with.
 *
 * Shared verbatim by the dashboard and storefront routes so the two cannot drift.
 */
export function validateAfaFormData(formData: Record<string, any>): AfaValidationError | null {
    // Presence check on required fields
    for (const field of AFA_REQUIRED_FIELDS) {
        if (!formData[field] || String(formData[field]).trim() === '') {
            return { error: `Missing required field: ${field}`, status: 400 }
        }
    }

    // Field length caps — run before allowlist checks so oversized values are
    // rejected here rather than producing a confusing allowlist error.
    for (const [field, maxLen] of Object.entries(FIELD_MAX_LENGTHS)) {
        const val = formData[field]
        if (val && String(val).length > maxLen) {
            return { error: `Field "${field}" exceeds maximum length of ${maxLen} characters.`, status: 400 }
        }
    }

    if (!(VALID_ID_TYPES as readonly string[]).includes(formData.id_type)) {
        return { error: `Invalid ID type. Must be one of: ${VALID_ID_TYPES.join(', ')}.`, status: 400 }
    }

    if (!(VALID_REGIONS as readonly string[]).includes(formData.region)) {
        return { error: 'Invalid region. Must be one of the supported Ghana regions.', status: 400 }
    }

    // Fail closed: an id_type that passed the allowlist but has no pattern entry
    // is a configuration bug, not a bad request. Without this a new ID type added
    // to VALID_ID_TYPES alone would silently skip format validation.
    const idConfig = ID_FORMAT_PATTERNS[formData.id_type as string]
    if (!idConfig) {
        console.error(`[AFA] No format pattern configured for id_type: "${formData.id_type}"`)
        return { error: 'ID type validation is not configured. Please contact support.', status: 500 }
    }
    if (!idConfig.pattern.test(String(formData.id_number).trim())) {
        return {
            error: `Invalid ID number format for the selected ID type. Expected format: ${idConfig.hint}`,
            status: 400,
        }
    }

    const age = ageFromDob(formData.date_of_birth)
    if (age === null) {
        return { error: 'Invalid Date of Birth format', status: 400 }
    }
    if (age < MIN_AFA_AGE) {
        return { error: `Applicant must be at least ${MIN_AFA_AGE} years of age.`, status: 400 }
    }

    return null
}
