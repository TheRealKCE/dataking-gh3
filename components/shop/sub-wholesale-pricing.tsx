'use client'

/**
 * Wholesale pricing — what your sub-agents PAY you.
 *
 * Distinct from retail pricing, which is what your own customers pay. They are
 * two different numbers on the same shop_pricing row:
 *
 *   selling_price  what a customer buying from YOUR storefront pays
 *   sub_price      what a sub-agent below you pays   ← this screen
 *
 * Your sub keeps whatever they add on top of sub_price. So the gap between your
 * cost and the price set here is what you earn per downline sale, and the gap
 * between here and your own retail price is the room your sub has to work with.
 *
 * Mounted by both portals — a Lead pricing their subs, and a level-1 sub
 * pricing their own recruits. /api/shop/sub-pricing resolves the caller's cost
 * through the chain, so a sub is floored at what they pay their own Lead rather
 * than at the platform price.
 */

import { useEffect, useState } from 'react'

interface Item {
    packageId: string
    network: string
    size: string
    /** What the caller pays for this package. */
    myCost: number
    /** The caller's own retail price — the ceiling. */
    myPrice: number
    /** myCost plus the platform minimum margin. */
    minPrice: number
    currentSubPrice: number | null
}

export default function SubWholesalePricing({ backHref }: { backHref?: string }) {
    const [items, setItems] = useState<Item[]>([])
    const [prices, setPrices] = useState<Record<string, string>>({})
    const [minMargin, setMinMargin] = useState(0.5)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
    const [blocked, setBlocked] = useState<string | null>(null)

    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch('/api/shop/sub-pricing')
                const data = await res.json()
                if (!res.ok) {
                    // 403/404 here means "you may not price a downline" — not a
                    // crash. Say which, rather than showing an empty table.
                    setBlocked(data.error || 'Could not load wholesale pricing')
                    return
                }
                const list: Item[] = data.items || []
                setItems(list)
                setMinMargin(data.minMargin ?? 0.5)
                setPrices(
                    Object.fromEntries(
                        list.map((it) => [
                            it.packageId,
                            it.currentSubPrice != null ? String(it.currentSubPrice) : '',
                        ])
                    )
                )
            } catch {
                setBlocked('Something went wrong')
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    // Blank is valid and meaningful: readers fall back to the retail price.
    const invalid = (it: Item) => {
        const raw = prices[it.packageId]
        if (raw === '' || raw == null) return false
        const v = parseFloat(raw)
        return !Number.isFinite(v) || v < it.minPrice || v > it.myPrice
    }

    const save = async () => {
        setSaving(true)
        setMsg(null)
        try {
            const res = await fetch('/api/shop/sub-pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map((it) => {
                        const raw = prices[it.packageId]
                        return {
                            packageId: it.packageId,
                            subPrice: raw === '' || raw == null ? null : parseFloat(raw),
                        }
                    }),
                }),
            })
            const data = await res.json()
            if (!res.ok) setMsg({ type: 'err', text: data.error || 'Could not save' })
            else setMsg({ type: 'ok', text: 'Sub-agent prices saved.' })
        } catch {
            setMsg({ type: 'err', text: 'Something went wrong' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-4 py-16 text-center text-gray-500 dark:text-gray-400">
                Loading…
            </div>
        )
    }

    if (blocked) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <p className="text-4xl mb-3">🔒</p>
                    <h1 className="text-lg font-bold text-yellow-900">Sub-agent pricing unavailable</h1>
                    <p className="text-yellow-800 text-sm mt-1">{blocked}</p>
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
                    <p className="text-4xl mb-3">🏷️</p>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Set your own prices first
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        You need retail prices on your shop before you can decide what your
                        sub-agents pay for the same packages.
                    </p>
                </div>
            </div>
        )
    }

    const anyInvalid = items.some(invalid)

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sub-agent prices</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    What your sub-agents pay you for each bundle. You keep the difference
                    between your own cost and this price; they keep whatever they add on top
                    when they resell.
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                    At least ₵{minMargin.toFixed(2)} above your cost, and no higher than your
                    own selling price. Leave blank to charge them your retail price.
                </p>
            </div>

            {msg && (
                <div
                    className={`rounded-lg p-3 text-sm ${
                        msg.type === 'ok'
                            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300'
                            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300'
                    }`}
                >
                    {msg.text}
                </div>
            )}

            <div className="space-y-2">
                {items.map((it) => {
                    const raw = prices[it.packageId]
                    const v = parseFloat(raw || '')
                    const myProfit = Number.isFinite(v) ? v - it.myCost : 0
                    const theirRoom = Number.isFinite(v) ? it.myPrice - v : 0
                    const bad = invalid(it)

                    return (
                        <div
                            key={it.packageId}
                            className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center gap-4"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {it.network} · {it.size}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    You pay ₵{it.myCost.toFixed(2)} · you sell at ₵{it.myPrice.toFixed(2)}
                                </p>
                            </div>
                            <div className="w-28 shrink-0">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                        ₵
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={it.minPrice}
                                        max={it.myPrice}
                                        placeholder={it.myPrice.toFixed(2)}
                                        value={raw ?? ''}
                                        onChange={(e) =>
                                            setPrices((p) => ({ ...p, [it.packageId]: e.target.value }))
                                        }
                                        className={`w-full pl-6 pr-2 py-2 rounded-lg border text-right focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 ${
                                            bad
                                                ? 'border-red-400 focus:ring-red-400'
                                                : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
                                        }`}
                                    />
                                </div>
                            </div>
                            <div className="w-24 shrink-0 text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">You earn</p>
                                <p
                                    className={`font-bold ${
                                        myProfit > 0
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    ₵{(myProfit > 0 ? myProfit : 0).toFixed(2)}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                    their room ₵{(theirRoom > 0 ? theirRoom : 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="sticky bottom-0 py-3 bg-gray-50 dark:bg-gray-950 flex gap-3">
                {backHref && (
                    <a
                        href={backHref}
                        className="px-5 py-3 rounded-lg border border-gray-300 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 text-center"
                    >
                        Back
                    </a>
                )}
                <button
                    onClick={save}
                    disabled={saving || anyInvalid}
                    className="flex-1 px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save sub-agent prices'}
                </button>
            </div>
        </div>
    )
}
