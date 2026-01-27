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
        if (name.includes('AT')) return 'at.png' // Both AT-iShare and AT-BigTime use AT logo
        return `${name.toLowerCase()}.png`
    }

    // Fallback styling if image not found
    const getFallbackStyle = (name: string) => {
        if (name === 'MTN') return 'bg-yellow-400 text-black'
        if (name === 'Telecel') return 'bg-red-600 text-white'
        if (name.includes('AT')) return 'bg-blue-700 text-white'
        return 'bg-gray-800 text-white'
    }

    const getFallbackInitial = (name: string) => {
        if (name === 'MTN') return 'M'
        if (name === 'Telecel') return 'T'
        if (name.includes('AT')) return 'A'
        return name[0]
    }

    if (!imageError) {
        return (
            <div className={`relative overflow-hidden rounded-full ${className}`} style={{ width: size, height: size }}>
                <Image
                    src={`/images/networks/${getFileName(network)}`}
                    alt={network}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                />
            </div>
        )
    }

    // Fallback UI
    return (
        <div
            className={`flex items-center justify-center rounded-full font-bold shadow-sm ${getFallbackStyle(network)} ${className}`}
            style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
            {getFallbackInitial(network)}
        </div>
    )
}
