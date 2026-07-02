'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClassifiedsSellerSidebar } from '@/components/classifieds/seller-sidebar'
import { CategorySelector } from '@/components/classifieds/category-selector'
import { ArrowLeft, Loader2, X, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import type { ClassifiedCategory } from '@/types/supabase'

export default function NewListingPage() {
    const router = useRouter()
    const { user, session } = useAuth()
    const [categories, setCategories] = useState<ClassifiedCategory[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingCategories, setIsLoadingCategories] = useState(true)
    const [images, setImages] = useState<File[]>([])
    const [imagePreviews, setImagePreviews] = useState<string[]>([])

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category_id: '',
        price: '',
        condition: 'used',
        location: '',
        region: '',
        contact_phone: '',
        contact_email: '',
    })

    const regions = [
        'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
        'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
        'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'
    ]

    useEffect(() => {
        if (!user) {
            toast.error('Please log in to create a listing')
            router.push('/auth/login')
        }
    }, [user, router])

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const res = await fetch('/api/classifieds/categories')
                if (res.ok) {
                    const data = await res.json()
                    setCategories(data.categories || [])
                }
            } catch (error) {
                console.error('Error loading categories:', error)
                toast.error('Failed to load categories')
            } finally {
                setIsLoadingCategories(false)
            }
        }

        loadCategories()
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])

        if (images.length + files.length > 5) {
            toast.error('Maximum 5 images allowed')
            return
        }

        const newImages = [...images, ...files]
        setImages(newImages)

        // Create previews
        const newPreviews = [...imagePreviews]
        files.forEach(file => {
            const reader = new FileReader()
            reader.onload = (e) => {
                if (e.target?.result) {
                    newPreviews.push(e.target.result as string)
                    setImagePreviews([...newPreviews])
                }
            }
            reader.readAsDataURL(file)
        })
    }

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
        setImagePreviews(imagePreviews.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim() || !formData.description.trim() || !formData.category_id || !formData.price) {
            toast.error('Please fill in all required fields')
            return
        }

        if (!session?.access_token) {
            toast.error('Please log in to create a listing')
            router.push('/auth/login')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('/api/classifieds/listings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    category_id: formData.category_id,
                    price: parseFloat(formData.price),
                    condition: formData.condition,
                    location: formData.location,
                    region: formData.region,
                    contact_phone: formData.contact_phone,
                    contact_email: formData.contact_email,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const listingId = data?.id

                if (!listingId) {
                    console.error('No listing ID in response:', data)
                    toast.error('Failed to create listing: No ID returned')
                    return
                }

                // Upload images if any
                if (images.length > 0) {
                    const formDataImages = new FormData()
                    images.forEach(image => {
                        formDataImages.append(`images`, image)
                    })
                    formDataImages.append('listing_id', listingId)

                    try {
                        const imageResponse = await fetch('/api/classifieds/listings/upload-images', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${session.access_token}`,
                            },
                            body: formDataImages,
                        })

                        if (!imageResponse.ok) {
                            console.warn('Some images failed to upload, but listing was created')
                        }
                    } catch (imageError) {
                        console.warn('Error uploading images:', imageError)
                    }
                }

                toast.success('Listing created successfully!')
                router.refresh()
                setTimeout(() => {
                    router.push(`/classifieds/seller/dashboard`)
                }, 500)
            } else {
                let errorMessage = 'Failed to create listing'
                try {
                    const errorData = await response.json()
                    errorMessage = errorData?.error || errorMessage
                } catch {
                    errorMessage = `Error ${response.status}: ${response.statusText}`
                }
                console.error('API error:', errorMessage, 'Status:', response.status)
                toast.error(errorMessage)
            }
        } catch (error: any) {
            console.error('Error creating listing:', error)
            toast.error(error?.message || 'An error occurred while creating your listing')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsSellerSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-4xl mx-auto px-6 py-8">
                        <Link href="/classifieds/seller/dashboard" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4">
                            <ArrowLeft className="w-4 h-4" />
                            Back to My Listings
                        </Link>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Post New Listing
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Create a new listing to sell your item
                        </p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 py-12">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Title <span className="text-red-600">*</span>
                            </label>
                            <Input
                                type="text"
                                name="title"
                                placeholder="e.g., iPhone 13 Pro Max"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                className="w-full"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Be specific and clear about your item</p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Description <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                name="description"
                                placeholder="Describe your item in detail. Include condition, features, and any defects."
                                value={formData.description}
                                onChange={handleChange}
                                required
                                rows={6}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Category <span className="text-red-600">*</span>
                            </label>
                            {isLoadingCategories ? (
                                <div className="w-full p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                                    <p className="text-gray-500 dark:text-gray-400">Loading categories...</p>
                                </div>
                            ) : categories.length === 0 ? (
                                <div className="w-full p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500 dark:text-gray-400">No categories available</p>
                                </div>
                            ) : (
                                <CategorySelector
                                    categories={categories}
                                    selectedCategoryId={formData.category_id}
                                    onSelectCategory={(categoryId) =>
                                        setFormData(prev => ({ ...prev, category_id: categoryId }))
                                    }
                                />
                            )}
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Price (GHS) <span className="text-red-600">*</span>
                            </label>
                            <Input
                                type="number"
                                name="price"
                                placeholder="0.00"
                                value={formData.price}
                                onChange={handleChange}
                                step="0.01"
                                min="0"
                                required
                                className="w-full"
                            />
                        </div>

                        {/* Condition & Region */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                    Condition
                                </label>
                                <select
                                    name="condition"
                                    title="Condition"
                                    value={formData.condition}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="new">New</option>
                                    <option value="like-new">Like New</option>
                                    <option value="used">Used</option>
                                    <option value="refurbished">Refurbished</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                    Region
                                </label>
                                <select
                                    name="region"
                                    title="Region"
                                    value={formData.region}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select a region</option>
                                    {regions.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                City / Town
                            </label>
                            <Input
                                type="text"
                                name="location"
                                placeholder="e.g., Accra, Kumasi, Tema"
                                value={formData.location}
                                onChange={handleChange}
                                className="w-full"
                            />
                        </div>

                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                    Phone Number
                                </label>
                                <Input
                                    type="tel"
                                    name="contact_phone"
                                    placeholder="0241234567"
                                    value={formData.contact_phone}
                                    onChange={handleChange}
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    name="contact_email"
                                    placeholder="your@email.com"
                                    value={formData.contact_email}
                                    onChange={handleChange}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Images */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                Images (up to 5)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6">
                                <div className="flex items-center justify-center">
                                    <label className="flex flex-col items-center cursor-pointer w-full">
                                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                            Click to upload or drag and drop
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            PNG, JPG, GIF up to 5MB
                                        </span>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            disabled={images.length >= 5}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Image Previews */}
                            {imagePreviews.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                                        Uploaded Images ({imagePreviews.length}/5)
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {imagePreviews.map((preview, index) => (
                                            <div key={index} className="relative">
                                                <img
                                                    src={preview}
                                                    alt={`Preview ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
                                                    aria-label="Remove image"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-4 pt-6">
                            <Link href="/classifieds/seller/dashboard" className="flex-1">
                                <Button variant="outline" className="w-full">
                                    Cancel
                                </Button>
                            </Link>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Listing'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
