"use client"

import { Toaster as Sonner } from "sonner"
import { AlertTriangle, Check, Info, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Every toast in the app renders through here, so this file is the whole
 * message style. It follows the same rule the announcements do: the kind of
 * message picks the colour, and nothing else does — success is emerald, error
 * is rose, warning is amber, info is blue. See lib/announcement-tones.ts.
 *
 * Two Tailwind prefixes matter and neither is decoration:
 *
 *   group-[.toaster]:   sonner ships its own stylesheet targeting
 *                       [data-sonner-toast], which outranks a bare utility
 *                       class. This raises ours above it.
 *   data-[styled=true]: sonner stamps data-styled="false" on toast.custom()
 *                       output. Without this guard the card below would wrap
 *                       around custom toasts — see components/welcome-toast.tsx
 *                       — and frame them twice.
 */

const TILE = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"

const ICONS = {
    success: (
        <span className={cn(TILE, "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.9)]")}>
            <Check className="h-[18px] w-[18px]" strokeWidth={3} />
        </span>
    ),
    error: (
        <span className={cn(TILE, "bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_8px_20px_-8px_rgba(225,29,72,0.9)]")}>
            <X className="h-[18px] w-[18px]" strokeWidth={3} />
        </span>
    ),
    warning: (
        <span className={cn(TILE, "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_20px_-8px_rgba(249,115,22,0.9)]")}>
            <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2.6} />
        </span>
    ),
    info: (
        <span className={cn(TILE, "bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_8px_20px_-8px_rgba(37,99,235,0.9)]")}>
            <Info className="h-[18px] w-[18px]" strokeWidth={2.6} />
        </span>
    ),
    loading: (
        <span className={cn(TILE, "bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_8px_20px_-8px_rgba(71,85,105,0.9)]")}>
            <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.6} />
        </span>
    ),
}

// Plain join rather than cn(): twMerge has no reason to be in the way of a
// fixed list of literal classes, and every one of these has to survive the
// production purge exactly as written.
const TOAST_CARD = [
    "group toast",
    "group-[.toaster]:data-[styled=true]:relative group-[.toaster]:data-[styled=true]:overflow-hidden",
    "group-[.toaster]:data-[styled=true]:w-full group-[.toaster]:data-[styled=true]:items-center group-[.toaster]:data-[styled=true]:gap-3",
    "group-[.toaster]:data-[styled=true]:rounded-2xl group-[.toaster]:data-[styled=true]:p-3.5",
    "group-[.toaster]:data-[styled=true]:border group-[.toaster]:data-[styled=true]:border-gray-200/80 group-[.toaster]:dark:data-[styled=true]:border-white/10",
    "group-[.toaster]:data-[styled=true]:bg-white/95 group-[.toaster]:dark:data-[styled=true]:bg-[#0f1524]/95 group-[.toaster]:data-[styled=true]:backdrop-blur-xl",
    "group-[.toaster]:data-[styled=true]:text-gray-900 group-[.toaster]:dark:data-[styled=true]:text-white",
    "group-[.toaster]:data-[styled=true]:shadow-[0_24px_50px_-20px_rgba(2,6,23,0.35)]",
    // The tone hairline across the top of the card; the colour comes from the
    // per-kind classNames below.
    "data-[styled=true]:before:absolute data-[styled=true]:before:inset-x-0 data-[styled=true]:before:top-0",
    "data-[styled=true]:before:h-[3px] data-[styled=true]:before:content-['']",
].join(" ")

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            className="toaster group"
            icons={ICONS}
            toastOptions={{
                classNames: {
                    toast: TOAST_CARD,
                    title: "group-[.toast]:text-[14px] group-[.toast]:font-black group-[.toast]:leading-tight group-[.toast]:tracking-tight",
                    description:
                        "group-[.toast]:mt-0.5 group-[.toast]:text-[12px] group-[.toast]:font-medium group-[.toast]:leading-snug group-[.toast]:text-gray-500 group-[.toast]:dark:text-gray-400",
                    icon: "group-[.toast]:m-0 group-[.toast]:h-9 group-[.toast]:w-9",
                    actionButton:
                        "group-[.toast]:rounded-xl group-[.toast]:bg-gray-900 group-[.toast]:font-bold group-[.toast]:text-white group-[.toast]:dark:bg-white group-[.toast]:dark:text-gray-900",
                    cancelButton:
                        "group-[.toast]:rounded-xl group-[.toast]:bg-gray-100 group-[.toast]:font-bold group-[.toast]:text-gray-600 group-[.toast]:dark:bg-white/10 group-[.toast]:dark:text-gray-300",
                    closeButton:
                        "group-[.toast]:rounded-full group-[.toast]:border-gray-200 group-[.toast]:bg-white group-[.toast]:text-gray-400 group-[.toast]:dark:border-white/10 group-[.toast]:dark:bg-[#0f1524] group-[.toast]:dark:text-gray-500",

                    // Colour by kind — hairline only. The card itself stays
                    // neutral so a red wash never competes with the red tile.
                    success: "before:bg-gradient-to-r before:from-emerald-400 before:to-teal-500",
                    error: "before:bg-gradient-to-r before:from-rose-400 before:to-red-600",
                    warning: "before:bg-gradient-to-r before:from-amber-400 before:to-orange-500",
                    info: "before:bg-gradient-to-r before:from-sky-400 before:to-blue-600",
                    loading: "before:bg-gradient-to-r before:from-slate-300 before:to-slate-500",
                    default: "before:bg-gradient-to-r before:from-gray-200 before:to-gray-300 dark:before:from-white/20 dark:before:to-white/10",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
