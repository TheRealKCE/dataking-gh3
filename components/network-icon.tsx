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

    const getFileName = (name: string) => {
        if (name === 'Special MTN Mashup' || name === 'EXPRESS MTN') return 'mtn.png'
        if (name.includes('AT')) return 'at.png'
        return `${name.toLowerCase()}.png`
    }

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

    // ── MTN: render SVG directly (bypass image file) ───────────────────────────
    if (network === 'MTN' || network === 'Special MTN Mashup' || network === 'EXPRESS MTN') {
        return (
            <>
                <style>{`.net-mtn-${size} { width: ${size}px; height: ${size}px; }`}</style>
                <div className={`net-mtn-${size} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
                    <svg viewBox="0 0 60 60" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="30" cy="30" r="30" fill="#FFCC00" />
                        <ellipse cx="30" cy="30" rx="22" ry="13" fill="white" stroke="#cc0000" strokeWidth="2.5" />
                        <text x="30" y="34.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#003087" fontFamily="Arial Black, Arial, sans-serif">MTN</text>
                    </svg>
                </div>
            </>
        )
    }

    // ── AT networks: render SVG directly (bypass image file) ──────────────────
    if (network.includes('AT')) {
        return (
            <>
                <style>{`.net-at-${size} { width: ${size}px; height: ${size}px; }`}</style>
                <div className={`net-at-${size} rounded-full overflow-hidden bg-white border border-gray-100 flex-shrink-0 ${className}`}>
                    <svg viewBox="0 0 60 60" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="30" cy="30" r="30" fill="white" />
                        <text x="29" y="38" textAnchor="end" fontSize="26" fontWeight="bold" fill="#e60000" fontFamily="Arial, sans-serif">a</text>
                        <text x="30" y="38" textAnchor="start" fontSize="26" fontWeight="bold" fill="#0056B3" fontFamily="Arial, sans-serif">t</text>
                        <text x="30" y="48" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#444" fontFamily="Arial, sans-serif">life is simple</text>
                    </svg>
                </div>
            </>
        )
    }

    // ── All other networks (Telecel): use image file ───────────────────────────
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

    // Generic text fallback
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
