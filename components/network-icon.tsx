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
    if (network.includes('AT')) {
        return (
            <>
                <style>{`.net-fallback-${size} { width: ${size}px; height: ${size}px; }`}</style>
                <div className={`flex flex-col items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 overflow-hidden net-fallback-${size} ${className}`}>
                    <div className="flex items-baseline" style={{ marginBottom: `-${size * 0.08}px`, marginTop: `${size * 0.08}px` }}>
                        <span className="text-[#e60000] font-bold" style={{ fontSize: size * 0.46, fontFamily: 'Arial, sans-serif' }}>a</span>
                        <span className="text-[#0056B3] font-bold" style={{ fontSize: size * 0.46, fontFamily: 'Arial, sans-serif' }}>t</span>
                    </div>
                    <span className="text-[#444] font-bold tracking-tighter" style={{ fontSize: size * 0.11, letterSpacing: '0.2px', fontFamily: 'Arial, sans-serif' }}>life is simple</span>
                </div>
            </>
        )
    }

    if (network === 'MTN' || network === 'Special MTN Mashup' || network === 'EXPRESS MTN') {
        return (
            <>
                <style>{`.net-fallback-${size} { width: ${size}px; height: ${size}px; }`}</style>
                <div className={`flex items-center justify-center rounded-full bg-[#FFCC00] shadow-sm overflow-hidden net-fallback-${size} ${className}`}>
                    <div className="flex items-center justify-center bg-white rounded-[50%] w-[75%] h-[45%] border-[1.5px] border-[#e60000]">
                        <span className="text-[#004b87] font-black tracking-tighter" style={{ fontSize: size * 0.22, fontFamily: 'Arial, sans-serif', marginTop: '1px' }}>MTN</span>
                    </div>
                </div>
            </>
        )
    }

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
