'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload } from 'lucide-react'
import Image from 'next/image'

interface Photo {
    base64: string
    preview: string
}

interface StepPhotosProps {
    images: Photo[]
    onChange: (images: Photo[]) => void
}

export function StepPhotos({ images, onChange }: StepPhotosProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files
        if (!files) return

        setUploading(true)
        const newImages: Photo[] = [...images]

        for (let i = 0; i < Math.min(files.length, 10 - images.length); i++) {
            const file = files[i]
            if (!file.type.startsWith('image/')) continue

            const reader = new FileReader()
            reader.onload = (event) => {
                const base64 = event.target?.result as string
                newImages.push({
                    base64,
                    preview: base64,
                })
                if (newImages.length === files.length + images.length || newImages.length === 10) {
                    onChange(newImages)
                    setUploading(false)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const removeImage = (index: number) => {
        onChange(images.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Photos ({images.length}/10)</Label>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || images.length >= 10}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photos
                </Button>
                <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                />
            </div>

            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {images.map((image, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={image.preview}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-sm text-muted-foreground">
                Upload clear photos of your item. The first photo will be the cover image.
            </p>
        </div>
    )
}
