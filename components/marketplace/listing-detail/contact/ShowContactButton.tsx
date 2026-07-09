'use client'

import { Phone, Loader2 } from 'lucide-react'
import { useListingContact } from './ListingContactContext'

/**
 * Green filled "Show Contact" button for the seller card.
 * - Logged out → opens the login gate, then reveals.
 * - Logged in  → logs a reveal, shows the number, opens the action sheet.
 * Once revealed the button label becomes the tappable number.
 */
export function ShowContactButton() {
    const { revealed, revealing, revealContact, revealCountToday, seller, contactDisabled } =
        useListingContact()

    return (
        <div>
            <button
                type="button"
                onClick={revealContact}
                disabled={revealing || contactDisabled}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00A652] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#008f47] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
                {revealing ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </>
                ) : (
                    <>
                        <Phone className="h-4 w-4" />
                        {contactDisabled
                            ? 'No longer available'
                            : revealed
                              ? seller.phone
                              : 'Show Contact'}
                    </>
                )}
            </button>

            {/* Social proof / urgency */}
            {!contactDisabled && revealCountToday != null && revealCountToday > 0 && (
                <p className="mt-1.5 text-center text-xs text-gray-500">
                    Contact revealed {revealCountToday} times today
                </p>
            )}
        </div>
    )
}
