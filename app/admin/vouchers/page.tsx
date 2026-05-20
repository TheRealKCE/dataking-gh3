'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function VouchersAdminPage() {
    const [types, setTypes] = useState<any[]>([])
    const [selectedType, setSelectedType] = useState<string>('')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetchTypes()
    }, [])

    async function fetchTypes() {
        const { data, error } = await supabase
            .from('results_checker_types')
            .select('*')
            .order('display_order')

        if (data) {
            setTypes(data)
            if (data.length > 0) setSelectedType((data[0] as any).id)
        }
    }

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedType || !file) {
            setMessage('Please select a voucher type and a CSV file.')
            return
        }

        setLoading(true)
        setMessage('')

        const formData = new FormData()
        formData.append('typeId', selectedType)
        formData.append('file', file)

        try {
            const res = await fetch('/api/admin/vouchers/upload', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (res.ok) {
                setMessage(data.message || 'Upload successful')
                setFile(null)
            } else {
                setMessage(data.error || 'Upload failed')
            }
        } catch (err: any) {
            setMessage('Network error occurred during upload')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Manage Results Checker Vouchers</h1>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-lg font-semibold mb-4">Upload Voucher Batch</h2>
                
                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500"
                        >
                            {types.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CSV File (Format: PIN, SERIAL)</label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="w-full border rounded-md p-2 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-gray-50"
                        />
                    </div>

                    {message && (
                        <div className={`p-3 rounded-md text-sm ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !file}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                    >
                        {loading ? 'Uploading...' : 'Upload Batch'}
                    </button>
                </form>
            </div>
        </div>
    )
}
