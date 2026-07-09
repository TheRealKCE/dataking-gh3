import { ShieldCheck, Check, PlusCircle } from 'lucide-react'

const TIPS = [
    'Avoid sending any prepayments',
    'Meet with the seller at a safe public place',
    "Inspect what you're going to buy to make sure it's what you need",
    "Check all the docs and only pay if you're satisfied",
]

export function SafetyTipsCard({ onPostAd }: { onPostAd?: () => void }) {
    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[#00A652]">
                    <ShieldCheck className="h-4 w-4" />
                    Safety tips
                </h3>
                <ul className="space-y-2">
                    {TIPS.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-sm text-gray-600">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00A652]" />
                            <span>{tip}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* CTA banner */}
            <button
                type="button"
                onClick={onPostAd}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00A652] bg-[#00A652]/5 px-4 py-3 text-sm font-semibold text-[#00A652] transition hover:bg-[#00A652]/10"
            >
                <PlusCircle className="h-4 w-4" />
                Post Ad Like This
            </button>
        </div>
    )
}
