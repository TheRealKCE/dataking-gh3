'use client'

/**
 * "Install as an app" for the sub-agent portal. Uses the shared usePwa hook to
 * trigger the browser install prompt (Android/desktop Chrome) and shows manual
 * Add-to-Home-Screen steps on iOS. De-branded / shop-branded, dark-mode aware.
 */

import { useEffect, useState } from 'react'
import { usePwa } from '@/hooks/use-pwa'
import type { BrandConfig } from '@/lib/brand-context'
import { Download, Share, Plus, CheckCircle2, Smartphone, Zap, WifiOff } from 'lucide-react'

export default function SubInstallPage() {
  const { isInstallable, isInstalled, isIOS, installPwa } = usePwa()
  const [brand, setBrand] = useState<BrandConfig | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/sub/data')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.brandConfig && setBrand(d.brandConfig))
      .catch(() => {})
  }, [])

  const shopName = brand?.shopName || brand?.appName || 'your portal'
  const teal = brand?.brandColor || '#1a6c78'

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <div className="text-center">
        {brand?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo} alt={shopName} className="h-16 w-16 rounded-2xl object-contain mx-auto bg-white shadow p-1" />
        ) : (
          <div
            className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-bold shadow"
            style={{ backgroundColor: teal }}
          >
            {shopName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">Install the app</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Add {shopName} to your home screen for one-tap access.
        </p>
      </div>

      {/* Perks */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Zap, label: 'Faster' },
          { icon: WifiOff, label: 'Works offline' },
          { icon: Smartphone, label: 'Home screen' },
        ].map((f) => (
          <div key={f.label} className="bg-white dark:bg-gray-900 rounded-lg shadow p-3 text-center">
            <f.icon className="w-5 h-5 mx-auto mb-1" style={{ color: teal }} />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.label}</p>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        {isInstalled ? (
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-600" />
            <p className="font-semibold text-gray-900 dark:text-gray-100 mt-2">App installed</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">You're already running the installed app.</p>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <p className="font-semibold text-gray-900 dark:text-gray-100">On iPhone / iPad</p>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold">1</span>
                Tap the <Share className="inline w-4 h-4 mx-1" /> Share button in Safari
              </li>
              <li className="flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold">2</span>
                Choose <Plus className="inline w-4 h-4 mx-1" /> "Add to Home Screen"
              </li>
              <li className="flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold">3</span>
                Tap "Add" — done!
              </li>
            </ol>
          </div>
        ) : isInstallable ? (
          <button
            onClick={installPwa}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-white font-semibold"
            style={{ backgroundColor: teal }}
          >
            <Download className="w-5 h-5" />
            Install app
          </button>
        ) : (
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <Download className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>
              Open this page in <strong>Chrome</strong>, then use the browser menu (⋮) →
              <strong> "Add to Home screen"</strong> to install.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
