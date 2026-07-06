'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getCategories } from '@/lib/classifieds-queries'
import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { CategoryPicture } from '@/components/classifieds/category-picture'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ClassifiedCategory } from '@/types/supabase'

export default function AdminCategoriesPage() {
    const { session } = useAuth()
    const [categories, setCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

    useEffect(() => {
        getCategories()
            .then((data) => setCategories(data))
            .catch(() => toast.error('Failed to load categories'))
            .finally(() => setIsLoading(false))
    }, [])

    const mains = categories
        .filter((c) => !c.parent_id)
        .sort((a, b) => a.display_order - b.display_order)

    const subsOf = (parentId: string) =>
        categories
            .filter((c) => c.parent_id === parentId)
            .sort((a, b) => a.display_order - b.display_order)

    const updateLocal = (id: string, image_url: string | null) =>
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, image_url } : c)))

    const handleUpload = async (cat: ClassifiedCategory, file: File) => {
        if (!session?.access_token) {
            toast.error('Please log in as an admin')
            return
        }
        setBusyId(cat.id)
        try {
            const body = new FormData()
            body.append('image', file)
            const res = await fetch(`/api/classifieds/admin/categories/${cat.id}/image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Upload failed')
            updateLocal(cat.id, data.image_url)
            toast.success(`Updated picture for ${cat.name}`)
        } catch (err: any) {
            toast.error(err.message || 'Upload failed')
        } finally {
            setBusyId(null)
        }
    }

    const handleRemove = async (cat: ClassifiedCategory) => {
        if (!session?.access_token) return
        setBusyId(cat.id)
        try {
            const res = await fetch(`/api/classifieds/admin/categories/${cat.id}/image`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to remove')
            updateLocal(cat.id, null)
            toast.success(`Removed picture for ${cat.name}`)
        } catch (err: any) {
            toast.error(err.message || 'Failed to remove')
        } finally {
            setBusyId(null)
        }
    }

    const Row = ({ cat, sub = false }: { cat: ClassifiedCategory; sub?: boolean }) => (
        <div
            className={`flex items-center gap-3 py-3 ${sub ? 'pl-6' : ''} border-b border-gray-100 dark:border-gray-800`}
        >
            <CategoryPicture
                imageUrl={cat.image_url}
                iconName={cat.icon}
                name={cat.name}
                className={sub ? 'w-9 h-9 rounded-md' : 'w-12 h-12 rounded-lg'}
                iconClassName={sub ? 'w-5 h-5 text-gray-700 dark:text-gray-300' : 'w-6 h-6 text-gray-700 dark:text-gray-300'}
            />
            <div className="flex-1 min-w-0">
                <div className={`font-semibold text-gray-900 dark:text-white ${sub ? 'text-sm' : ''}`}>{cat.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {cat.image_url ? 'Picture set' : 'Using fallback icon'}
                </div>
            </div>
            <input
                ref={(el) => {
                    fileInputs.current[cat.id] = el
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(cat, f)
                    e.target.value = ''
                }}
            />
            <button
                type="button"
                onClick={() => fileInputs.current[cat.id]?.click()}
                disabled={busyId === cat.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
                {busyId === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {cat.image_url ? 'Replace' : 'Upload'}
            </button>
            {cat.image_url && (
                <button
                    type="button"
                    onClick={() => handleRemove(cat)}
                    disabled={busyId === cat.id}
                    aria-label={`Remove picture for ${cat.name}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1 min-w-0">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-4xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Category Pictures</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Upload a picture for each category and subcategory. Where no picture is set, the
                            fallback icon is shown. Recommended: square images (e.g. 400×400).
                        </p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 py-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {mains.map((main) => (
                                <div
                                    key={main.id}
                                    className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 px-4"
                                >
                                    <Row cat={main} />
                                    {subsOf(main.id).map((sub) => (
                                        <Row key={sub.id} cat={sub} sub />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
