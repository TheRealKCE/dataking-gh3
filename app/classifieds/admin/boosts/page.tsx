'use client'

import { useEffect, useState } from 'react'
import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

interface BoostTier {
    id: string
    name: string
    price: number
    duration_days: number
    description: string
}

export default function AdminBoostsPage() {
    const { session } = useAuth()
    const [tiers, setTiers] = useState<BoostTier[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (session?.access_token) {
            loadTiers()
        }
    }, [session?.access_token])

    const loadTiers = async () => {
        try {
            setIsLoading(true)
            const res = await fetch('/api/classifieds/admin/boost-tiers', {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            })

            if (res.ok) {
                const data = await res.json()
                setTiers(data.tiers || defaultTiers)
            }
        } catch (error) {
            console.error('Error loading tiers:', error)
            setTiers(defaultTiers)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePriceChange = (index: number, newPrice: string) => {
        const updated = [...tiers]
        updated[index].price = parseFloat(newPrice) || 0
        setTiers(updated)
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)
            const res = await fetch('/api/classifieds/admin/boost-tiers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ tiers }),
            })

            if (res.ok) {
                toast.success('Boost prices saved successfully!')
            } else {
                toast.error('Failed to save boost prices')
            }
        } catch (error) {
            toast.error('Error saving boost prices')
        } finally {
            setIsSaving(false)
        }
    }

    const defaultTiers: BoostTier[] = [
        { id: '1', name: 'Standard Boost', price: 50, duration_days: 7, description: 'Boost your listing for 7 days' },
        { id: '2', name: 'Premium Boost', price: 100, duration_days: 14, description: 'Boost your listing for 14 days' },
        { id: '3', name: 'Elite Boost', price: 150, duration_days: 30, description: 'Boost your listing for 30 days' },
    ]

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Promotion Fees</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Configure boost tier prices for listing promotions</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-12">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {tiers.map((tier, index) => (
                                <div key={tier.id} className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                                Tier Name
                                            </label>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{tier.name}</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                                Price (GHS)
                                            </label>
                                            <Input
                                                type="number"
                                                value={tier.price}
                                                onChange={(e) => handlePriceChange(index, e.target.value)}
                                                className="w-full"
                                                min="0"
                                                step="10"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                                Duration
                                            </label>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">{tier.duration_days} days</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                                                Description
                                            </label>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{tier.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save Prices
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    💡 Set the promotion fees that sellers will pay to boost their listings. These prices are displayed when sellers create or edit listings.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
