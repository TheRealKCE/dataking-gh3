'use client'

import Image from 'next/image'
import { useState } from 'react'

interface NetworkIconProps {
    network: string
    size?: number
    className?: string
    variant?: 'default' | 'card'
}

export function NetworkIcon({ network, size = 40, className = '', variant = 'default' }: NetworkIconProps) {
    const [imageError, setImageError] = useState(false)

    // Standardize network name for file path
    const getFileName = (name: string) => {
        if (name === 'Special MTN Mashup' || name === 'EXPRESS MTN') return 'mtn.png' // Reuse MTN logo
        if (name.includes('AT')) return 'at.png' // Both AT-iShare and AT-BigTime use AT logo
        return `${name.toLowerCase()}.png`
    }

    // Fallback styling if image not found
    const getFallbackStyle = (name: string) => {
        if (name === 'MTN' || name === 'Special MTN Mashup' || name === 'EXPRESS MTN') return 'bg-yellow-400 text-black'
        if (name === 'Telecel') return 'bg-red-600 text-white'
        if (name.includes('AT')) return 'bg-blue-700 text-white'
        return 'bg-gray-800 text-white'
    }

    const getFallbackInitial = (name: string) => {
        if (name === 'MTN' || name === 'Special MTN Mashup') return 'M'
        if (name === 'EXPRESS MTN') return 'E'
        if (name === 'Telecel') return 'T'
        if (name.includes('AT')) return 'A'
        return name[0]
    }

    if (!imageError) {
        return (
            <>
                <style>{`.net-icon-${size} { width: ${size}px; height: ${size}px; }`}</style>
                <div className={`relative overflow-hidden rounded-full net-icon-${size} ${className}`}>
                <Image
                    src={`/images/networks/${getFileName(network)}`}
                    alt={network}
                    fill
                    sizes={`${size}px`}
                    priority
                    className="object-cover"
                    onError={() => setImageError(true)}
                />
            </div>
            </>
        )
    }

    // Fallback UI
    return (
        <>
            <style>{`.net-fallback-${size} { width: ${size}px; height: ${size}px; font-size: ${size * 0.5}px; }`}</style>
            <div
                className={`flex items-center justify-center rounded-full font-bold shadow-sm ${getFallbackStyle(network)} net-fallback-${size} ${className}`}
            >
                {getFallbackInitial(network)}
            </div>
        </>
    )
}
