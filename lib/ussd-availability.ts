/**
 * The master switch for everything USSD.
 *
 * One admin_settings key gates the whole stack: the dial-in service, the sale of
 * short codes, and every surface that advertises either. It exists so USSD can be
 * taken off the air from /admin/settings without a deploy — the dial code itself
 * lives in the Hubtel dashboard, so a deploy could not take it down anyway.
 */
export const USSD_ENABLED_KEY = 'ussd_enabled'

/**
 * Hard block. USSD is closed by decision, not by configuration.
 *
 * The admin_settings switch was flipped off and USSD kept taking money — the
 * toggle in /admin/settings only writes on Save, so it is easy to believe the
 * service is shut when the stored value is still 'true'. Rather than keep
 * chasing that, the answer no longer depends on the database at all.
 *
 * While this is true, `ussd_enabled` is ignored everywhere and no stored value,
 * stale cache or unsaved form can reopen the service.
 *
 * TO REOPEN USSD: set this to false. The admin switch then works as before and
 * decides on its own. Nothing else here needs changing, and short codes shops
 * already bought are untouched throughout — this closes the door, it does not
 * cancel anything.
 */
const USSD_HARD_DISABLED = true

/**
 * Whether USSD is open for business.
 *
 * Fails CLOSED on purpose: a missing row, an unreachable admin_settings read, or
 * any value that isn't exactly 'true' all mean off. A switch whose job is to stop
 * a live service taking money is worthless if a failed lookup leaves the service
 * running, and every USSD step past this point needs the same database anyway.
 * Turning it back on is one deliberate 'true'.
 */
export function isUssdEnabled(
    settings: Record<string, string | null | undefined> | null | undefined
): boolean {
    if (USSD_HARD_DISABLED) return false
    return settings?.[USSD_ENABLED_KEY] === 'true'
}

/**
 * What a caller hears before the line drops when they dial in while USSD is off.
 *
 * ASCII only and well under a 160-character screen: a non-ASCII character makes
 * the Hubtel call throw, and a long one gets truncated mid-sentence.
 */
export const USSD_OFFLINE_MESSAGE =
    'ARHMS USSD is currently unavailable. Please buy at arhmsgh.com. Thank you.'

/** Shown wherever someone tries to buy or manage a short code while USSD is off. */
export const USSD_UNAVAILABLE_MESSAGE =
    'USSD short codes are currently unavailable. Please check back later.'
