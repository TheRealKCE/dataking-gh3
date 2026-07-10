'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react'

interface ImageGalleryProps {
    images: string[]
    title: string
    featured?: boolean
    /** Semi-transparent diagonal text over the image for anti-scraping. */
    watermark?: string
    /** Save/bookmark control rendered in the top-right overlay cluster. */
    saveSlot?: ReactNode
}

export function ImageGallery({ images, title, featured, watermark, saveSlot }: ImageGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    const count = images.length
    const go = (dir: number) => setActiveIndex((i) => (i + dir + count) % count)

    return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {/* Main image */}
            <div className="relative aspect-[4/3] w-full bg-gray-100 sm:aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={images[activeIndex]}
                    alt={`${title} — photo ${activeIndex + 1}`}
                    className="h-full w-full object-cover"
                />

                {/* Watermark */}
                {watermark && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span className="-rotate-[30deg] whitespace-nowrap text-4xl font-extrabold tracking-widest text-white/25 sm:text-6xl">
                            {watermark}
                        </span>
                    </div>
                )}

                {/* Featured ribbon (top-left) */}
                {featured && (
                    <span className="absolute left-0 top-4 rounded-r-md bg-[#00A652] px-3 py-1 text-xs font-semibold text-white shadow">
                        Featured
                    </span>
                )}

                {/* Share / bookmark (top-right) */}
                <div className="absolute right-3 top-3 flex gap-2">
                    <button
                        type="button"
                        aria-label="Share listing"
                        className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
                    >
                        <Share2 className="h-4 w-4" />
                    </button>
                    {saveSlot}
                </div>

                {/* Prev / next arrows */}
                {count > 1 && (
                    <>
                        <button
                            type="button"
                            aria-label="Previous photo"
                            onClick={() => go(-1)}
                            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-gray-800 shadow backdrop-blur transition hover:bg-white"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Next photo"
                            onClick={() => go(1)}
                            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-gray-800 shadow backdrop-blur transition hover:bg-white"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </>
                )}

                {/* Counter (bottom-left) */}
                <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                    {activeIndex + 1}/{count}
                </span>

                {/* Dot indicators (bottom-center) */}
                {count > 1 && (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                        {images.map((_, i) => (
                            <span
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Thumbnail strip */}
            {count > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                    {images.map((src, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActiveIndex(i)}
                            aria-label={`View photo ${i + 1}`}
                            aria-current={i === activeIndex}
                            className={`relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-lg border-2 transition ${
                                i === activeIndex
                                    ? 'border-[#00A652]'
                                    : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
