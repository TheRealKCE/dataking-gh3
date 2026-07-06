'use client'

import { CategoryIcon } from '@/components/classifieds/category-icon'

interface CategoryPictureProps {
    imageUrl?: string | null
    iconName?: string | null
    name: string
    /** Wrapper size + shape, e.g. "w-11 h-11 rounded-lg". */
    className?: string
    /** Fallback icon sizing/color when no picture is set. */
    iconClassName?: string
}

// Renders a category's uploaded picture (Jiji-style tile). Falls back to the
// lucide CategoryIcon whenever no image_url has been uploaded yet, so categories
// without a picture keep working and the switch is seamless as images arrive.
export function CategoryPicture({
    imageUrl,
    iconName,
    name,
    className = 'w-11 h-11 rounded-lg',
    iconClassName = 'w-6 h-6 text-gray-700 dark:text-gray-300',
}: CategoryPictureProps) {
    if (imageUrl) {
        return (
            <div className={`${className} overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
            </div>
        )
    }

    return (
        <div className={`${className} bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0`}>
            <CategoryIcon name={iconName} className={iconClassName} />
        </div>
    )
}
