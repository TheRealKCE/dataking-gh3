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

    // Only networks that fall through the inline-SVG branches below reach this, which
    // today means Telecel alone. The former 'mtn.png'/'at.png' mappings were dead --
    // MTN and AT short-circuit to SVG first -- and those two files are now deleted, so
    // returning them here would only ever produce a 404 into the fallback.
    const getFileName = (name: string) => `${name.toLowerCase()}.png`

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

    // Sized inline rather than through an injected <style> tag. Every icon used to
    // emit its own <style> element, so a 50-row order list built 50 duplicate style
    // nodes for what is two CSS properties.
    const box = { width: size, height: size }

    // ── MTN: render SVG directly (bypass image file) ───────────────────────────
    if (network === 'MTN' || network === 'Special MTN Mashup' || network === 'EXPRESS MTN') {
        return (
            <div style={box} className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}>
                <svg viewBox="0 0 60 60" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="30" cy="30" r="30" fill="#FFCC00" />
                    <ellipse cx="30" cy="30" rx="26" ry="14" fill="#005b82" />
                    <text x="30.5" y="35.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#e20010" fontStyle="italic" fontFamily="Arial Black, Arial, sans-serif" letterSpacing="-0.5">MTN</text>
                    <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="900" fill="white" fontStyle="italic" fontFamily="Arial Black, Arial, sans-serif" letterSpacing="-0.5">MTN</text>
                </svg>
            </div>
        )
    }

    // ── AT networks: render SVG directly (bypass image file) ──────────────────
    if (network.includes('AT')) {
        return (
            <div style={box} className={`rounded-full overflow-hidden bg-white border border-gray-100 flex-shrink-0 ${className}`}>
                <svg viewBox="0 0 60 60" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="30" cy="30" r="30" fill="white" />
                    <text x="29" y="38" textAnchor="end" fontSize="26" fontWeight="bold" fill="#e60000" fontFamily="Arial, sans-serif">a</text>
                    <text x="30" y="38" textAnchor="start" fontSize="26" fontWeight="bold" fill="#0056B3" fontFamily="Arial, sans-serif">t</text>
                    <text x="30" y="48" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#444" fontFamily="Arial, sans-serif">life is simple</text>
                </svg>
            </div>
        )
    }

    // ── All other networks (Telecel): use image file ───────────────────────────
    if (!imageError) {
        return (
            <div style={box} className={`relative overflow-hidden rounded-full flex-shrink-0 ${className}`}>
                <Image
                    src={`/images/networks/${getFileName(network)}`}
                    alt={network}
                    fill
                    sizes={`${size}px`}
                    // Deliberately not `priority`. These render inside order lists and
                    // package grids, so marking them high-priority had every row
                    // competing with the actual above-the-fold content for the first
                    // few connections — the worst thing to do on a 2G link.
                    loading="lazy"
                    className="object-cover"
                    onError={() => setImageError(true)}
                />
            </div>
        )
    }

    // Generic text fallback
    return (
        <div
            style={{ ...box, fontSize: size * 0.5 }}
            className={`flex items-center justify-center rounded-full font-bold shadow-sm flex-shrink-0 ${getFallbackStyle(network)} ${className}`}
        >
            {getFallbackInitial(network)}
        </div>
    )
}
