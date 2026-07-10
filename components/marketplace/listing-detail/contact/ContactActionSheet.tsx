'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Phone, MessageCircle, Send } from 'lucide-react'
import { useListingContact } from './ListingContactContext'

/**
 * Bottom action sheet shown after the number is revealed. Three actions:
 * Call (tel:), WhatsApp (wa.me), and Send Message (in-app chat).
 */
export function ContactActionSheet() {
    const { actionSheetOpen, closeActionSheet, telHref, whatsappHref, onSendMessage, seller } =
        useListingContact()

    return (
        <DialogPrimitive.Root open={actionSheetOpen} onOpenChange={(o) => !o && closeActionSheet()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white p-4 pb-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:bottom-4 sm:rounded-2xl"
                >
                    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 sm:hidden" />

                    <DialogPrimitive.Title className="text-center text-sm font-semibold text-gray-900">
                        Contact {seller.name}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="mb-4 text-center text-xs text-gray-500">
                        {seller.phone}
                    </DialogPrimitive.Description>

                    <div className="space-y-2">
                        <ActionRow
                            as="a"
                            href={telHref}
                            icon={<Phone className="h-5 w-5" />}
                            iconClass="bg-[#00A652]/10 text-[#00A652]"
                            label="Call"
                            sub="Open your phone dialer"
                        />
                        <ActionRow
                            as="a"
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            icon={<MessageCircle className="h-5 w-5" />}
                            iconClass="bg-[#25D366]/10 text-[#25D366]"
                            label="WhatsApp"
                            sub="Chat with a pre-filled message"
                        />
                        <ActionRow
                            as="button"
                            onClick={onSendMessage}
                            icon={<Send className="h-5 w-5" />}
                            iconClass="bg-blue-500/10 text-blue-600"
                            label="Send Message"
                            sub="Chat in-app with the listing pinned"
                        />
                    </div>

                    <DialogPrimitive.Close asChild>
                        <button
                            type="button"
                            className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </DialogPrimitive.Close>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

type ActionRowProps = {
    icon: React.ReactNode
    iconClass: string
    label: string
    sub: string
} & (
    | ({ as: 'a' } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ as: 'button' } & React.ButtonHTMLAttributes<HTMLButtonElement>)
)

function ActionRow({ icon, iconClass, label, sub, as, ...rest }: ActionRowProps) {
    const inner = (
        <>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClass}`}>
                {icon}
            </span>
            <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500">{sub}</span>
            </span>
        </>
    )
    const cls =
        'flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 transition hover:bg-gray-50'

    if (as === 'a') {
        return (
            <a className={cls} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {inner}
            </a>
        )
    }
    return (
        <button type="button" className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
            {inner}
        </button>
    )
}
