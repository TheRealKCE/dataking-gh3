'use client'

import { LoginGateModal } from './LoginGateModal'
import { ContactActionSheet } from './ContactActionSheet'
import { RequestCallBackModal } from './RequestCallBackModal'
import { MarkUnavailableModal } from './MarkUnavailableModal'
import { ReportModal } from './ReportModal'

/**
 * Renders the global overlays for the contact + status system. Drop this once
 * inside a <ListingContactProvider> (e.g. at the bottom of the listing page).
 */
export function ListingContactModals() {
    return (
        <>
            <LoginGateModal />
            <ContactActionSheet />
            <RequestCallBackModal />
            <MarkUnavailableModal />
            <ReportModal />
        </>
    )
}
