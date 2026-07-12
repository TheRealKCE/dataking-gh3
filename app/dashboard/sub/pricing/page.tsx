'use client'

/**
 * Sub-Agent pricing engine (de-branded). The sub sets a selling price per
 * package for their own storefront, bounded by the parent's retail price
 * (floor) and parent price + markup ceiling (cap).
 */

import { useEffect, useState } from 'react'

interface Item {
  packageId: string
  network: string
  size: string
  parentPrice: number
  maxPrice: number
  currentPrice: number | null
}

export default function SubPricingPage() {
  const [items, setItems] = useState<Item[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [ceiling, setCeiling] = useState(0)
  const [needsShop, setNeedsShop] = useState(false)
  const [noParent, setNoParent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/dashboard/sub/pricing')
        const data = await res.json()
        if (!res.ok) {
          setMsg({ type: 'err', text: data.error || 'Failed to load pricing' })
        } else {
          setNeedsShop(!!data.needsShop)
          setNoParent(!!data.noParentPricing)
          setCeiling(data.ceiling || 0)
          const list: Item[] = data.items || []
          setItems(list)
          const init: Record<string, string> = {}
          for (const it of list) {
            init[it.packageId] = String(it.currentPrice ?? it.parentPrice)
          }
          setPrices(init)
        }
      } catch {
        setMsg({ type: 'err', text: 'Something went wrong' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const payload = items.map((it) => ({
        packageId: it.packageId,
        sellingPrice: parseFloat(prices[it.packageId] || '0'),
      }))
      const res = await fetch('/api/dashboard/sub/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      })
      const data = await res.json()
      if (!res.ok) setMsg({ type: 'err', text: data.error || 'Could not save' })
      else setMsg({ type: 'ok', text: 'Prices saved' })
    } catch {
      setMsg({ type: 'err', text: 'Something went wrong' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto p-4 py-16 text-center text-gray-500 dark:text-gray-400">Loading pricing…</div>
  }

  if (needsShop) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create your shop first</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 mb-5">
            You need a storefront before you can set prices.
          </p>
          <a href="/dashboard/sub/shop" className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
            Create my shop
          </a>
        </div>
      </div>
    )
  }

  if (noParent || items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
          <p className="text-4xl mb-3">⏳</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">No packages to price yet</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Your Lead hasn't published prices you can resell yet. Check back soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Set your prices</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Price each bundle between your Lead's price and ₵{ceiling.toFixed(2)} above it.
          Your profit is the difference.
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
          const val = parseFloat(prices[it.packageId] || '0')
          const profit = Number.isFinite(val) ? val - it.parentPrice : 0
          const outOfRange = val < it.parentPrice || val > it.maxPrice
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
                  Parent ₵{it.parentPrice.toFixed(2)} · max ₵{it.maxPrice.toFixed(2)}
                </p>
              </div>
              <div className="w-28 shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min={it.parentPrice}
                    max={it.maxPrice}
                    value={prices[it.packageId] ?? ''}
                    onChange={(e) => setPrices((p) => ({ ...p, [it.packageId]: e.target.value }))}
                    className={`w-full pl-6 pr-2 py-2 rounded-lg border text-right focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 ${
                      outOfRange
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Profit</p>
                <p
                  className={`font-bold ${
                    profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  ₵{(profit > 0 ? profit : 0).toFixed(2)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="sticky bottom-0 py-3 bg-gray-50 dark:bg-gray-950">
        <button
          onClick={save}
          disabled={saving || items.some((it) => {
            const v = parseFloat(prices[it.packageId] || '0')
            return !Number.isFinite(v) || v < it.parentPrice || v > it.maxPrice
          })}
          className="w-full px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save prices'}
        </button>
      </div>
    </div>
  )
}
