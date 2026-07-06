'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageCarouselProps {
    images: Array<{ url: string; alt: string }> | null
}

export function ImageCarousel({ images }: ImageCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const hasImages = images && images.length > 0

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') handlePrev()
            if (e.key === 'ArrowRight') handleNext()
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [hasImages])

    const handlePrev = () => {
        if (!hasImages) return
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    const handleNext = () => {
        if (!hasImages) return
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    if (!hasImages) {
        return (
            <div className="w-full h-64 sm:h-80 md:h-96 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center text-gray-500">
                <span>No images available</span>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Main image */}
            <div className="relative w-full h-64 sm:h-80 md:h-96 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                <div className="w-full h-full relative">
                    <Image
                        src={images[currentIndex].url}
                        alt={images[currentIndex].alt || 'Listing image'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 800px"
                        priority={currentIndex === 0}
                    />
                </div>

                {/* Navigation arrows */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {currentIndex + 1} / {images.length}
                    </div>
                )}
            </div>

            {/* Thumbnail dots */}
            {images.length > 1 && (
                <div className="flex gap-2 justify-center">
                    {images.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={cn(
                                'w-2.5 h-2.5 rounded-full transition-all',
                                index === currentIndex
                                    ? 'bg-emerald-600 dark:bg-emerald-400 w-6'
                                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                            )}
                            aria-label={`Go to image ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
