/**
 * One tone per badge.
 *
 * Every colour an announcement or a welcome toast paints is derived from the
 * badge it carries — an "Official Platform Notice" is amber end to end, a
 * "Shop Announcement" is blue end to end. Nothing picks a colour on its own,
 * so a new badge only ever means a new entry here.
 *
 * The class strings are written out in full on purpose: Tailwind's purge reads
 * source text, so `bg-${tone}-500` would ship as an empty rule in production.
 */

export type AnnouncementTone = 'official' | 'shop' | 'success' | 'alert'

export interface ToneStyle {
    /** Default badge copy — callers may override. */
    label: string
    /** Hairline across the very top of the card. */
    bar: string
    /** Radial wash behind the header. */
    wash: string
    /** The two blurred orbs floating in the header. */
    orbA: string
    orbB: string
    /** Icon squircle + the halo that pulses behind it. */
    tile: string
    halo: string
    /** Badge pill. */
    badge: string
    dot: string
    /** Vertical spine down the left of the message panel. */
    spine: string
    panel: string
    /** Primary call to action. */
    cta: string
    /** Tone-coloured text for secondary links. */
    ink: string
    /** Progress hairline (welcome toast). */
    progress: string
}

export const ANNOUNCEMENT_TONES: Record<AnnouncementTone, ToneStyle> = {
    official: {
        label: 'Official Platform Notice',
        bar: 'bg-gradient-to-r from-amber-300 via-orange-500 to-amber-300',
        wash: 'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(245,158,11,0.18),rgba(245,158,11,0.04)_45%,transparent_75%)]',
        orbA: 'bg-amber-400/30',
        orbB: 'bg-orange-500/25',
        tile: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_12px_30px_-12px_rgba(249,115,22,0.85)]',
        halo: 'bg-amber-400/40',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30',
        dot: 'bg-amber-500',
        spine: 'bg-gradient-to-b from-amber-400 to-orange-500',
        panel: 'bg-amber-50/70 dark:bg-amber-500/[0.06]',
        cta: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-[0_14px_32px_-14px_rgba(249,115,22,0.95)]',
        ink: 'text-amber-700 dark:text-amber-300',
        progress: 'bg-gradient-to-r from-amber-400 to-orange-500',
    },
    shop: {
        label: 'Shop Announcement',
        bar: 'bg-gradient-to-r from-sky-300 via-blue-600 to-sky-300',
        wash: 'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(37,99,235,0.18),rgba(37,99,235,0.04)_45%,transparent_75%)]',
        orbA: 'bg-sky-400/30',
        orbB: 'bg-blue-600/25',
        tile: 'bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_12px_30px_-12px_rgba(37,99,235,0.85)]',
        halo: 'bg-sky-400/40',
        badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30',
        dot: 'bg-blue-500',
        spine: 'bg-gradient-to-b from-sky-400 to-blue-600',
        panel: 'bg-blue-50/70 dark:bg-blue-500/[0.06]',
        cta: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-[0_14px_32px_-14px_rgba(37,99,235,0.95)]',
        ink: 'text-blue-700 dark:text-blue-300',
        progress: 'bg-gradient-to-r from-sky-400 to-blue-600',
    },
    success: {
        label: 'Signed In',
        bar: 'bg-gradient-to-r from-emerald-300 via-teal-500 to-emerald-300',
        wash: 'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(16,185,129,0.18),rgba(16,185,129,0.04)_45%,transparent_75%)]',
        orbA: 'bg-emerald-400/30',
        orbB: 'bg-teal-500/25',
        tile: 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.85)]',
        halo: 'bg-emerald-400/40',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30',
        dot: 'bg-emerald-500',
        spine: 'bg-gradient-to-b from-emerald-400 to-teal-500',
        panel: 'bg-emerald-50/70 dark:bg-emerald-500/[0.06]',
        cta: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_14px_32px_-14px_rgba(16,185,129,0.95)]',
        ink: 'text-emerald-700 dark:text-emerald-300',
        progress: 'bg-gradient-to-r from-emerald-400 to-teal-500',
    },
    alert: {
        label: 'Service Alert',
        bar: 'bg-gradient-to-r from-rose-300 via-red-600 to-rose-300',
        wash: 'bg-[radial-gradient(120%_100%_at_50%_0%,rgba(225,29,72,0.18),rgba(225,29,72,0.04)_45%,transparent_75%)]',
        orbA: 'bg-rose-400/30',
        orbB: 'bg-red-600/25',
        tile: 'bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_12px_30px_-12px_rgba(225,29,72,0.85)]',
        halo: 'bg-rose-400/40',
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30',
        dot: 'bg-rose-500',
        spine: 'bg-gradient-to-b from-rose-400 to-red-600',
        panel: 'bg-rose-50/70 dark:bg-rose-500/[0.06]',
        cta: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-[0_14px_32px_-14px_rgba(225,29,72,0.95)]',
        ink: 'text-rose-700 dark:text-rose-300',
        progress: 'bg-gradient-to-r from-rose-400 to-red-600',
    },
}

export function getTone(tone?: AnnouncementTone | null): ToneStyle {
    return ANNOUNCEMENT_TONES[tone ?? 'official'] ?? ANNOUNCEMENT_TONES.official
}
