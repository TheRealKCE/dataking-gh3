import { createServerClient } from '@/lib/supabase'

// Isolated DataGod Fulfillment Service

const DATAGOD_API_KEY = process.env.DATAGOD_API_KEY || ''
const DATAGOD_API_BASE_URL = process.env.DATAGOD_API_BASE_URL || 'https://datagod.store/api/v1'

export interface DataGodResponse {
    success: boolean
    reference?: string
    error?: string
    apiResponse?: any
}

export interface DataGodStatusResponse {
    success: boolean
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
    data?: any
}

export async function fetchDataGodBalance(): Promise<{ success: boolean; balance?: number; currency?: string; username?: string; role?: string; error?: string }> {
    if (!DATAGOD_API_KEY) return { success: false, error: 'DataGod API key not configured' }

    try {
        const response = await fetch(`${DATAGOD_API_BASE_URL}/balance`, {
            method: 'GET',
            headers: { 'X-API-Key': DATAGOD_API_KEY },
        })

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            const rawText = await response.text()
            console.error('[DataGod Balance] Non-JSON response (HTTP', response.status, '):', rawText.slice(0, 300))
            return { success: false, error: `Supplier returned unexpected response (HTTP ${response.status})` }
        }

        const data = await response.json()
        console.log('[DataGod Balance] API Response:', JSON.stringify(data))

        if (response.ok) {
            let balance = 0
            if (data.balance !== undefined) {
                balance = parseFloat(data.balance) || 0
            } else if (data.data?.balance !== undefined) {
                balance = parseFloat(data.data.balance) || 0
            }

            // Attempt to extract user identity
            const username = data.username || data.name || data.user || data.data?.username || data.data?.name || data.data?.user || 'Unknown User'
            const role = data.role || data.account_type || data.data?.role || data.data?.account_type || 'User'

            return { success: true, balance, currency: 'GHS', username, role }
        }

        return { success: false, error: data.message || data.error || 'Failed to fetch DataGod balance' }
    } catch (error: any) {
        console.error('[DataGod Balance] Error:', error)
        return { success: false, error: error.message }
    }
}

export async function fulfillDataGodOrder(
    network: string,
    recipient: string,
    volumeGB: string | number,
    reference: string
): Promise<DataGodResponse> {
    if (!DATAGOD_API_KEY) return { success: false, error: 'DataGod API key not configured' }

    try {
        // DataGod requires integer volume (e.g., 5 for "5GB")
        let volumeInt = 0
        if (typeof volumeGB === 'string') {
            const sizeMatch = volumeGB.match(/[\d.]+/)
            if (sizeMatch) {
                // For safety we parse float and round/cast if needed, but docs say integer or number
                volumeInt = parseInt(sizeMatch[0], 10)
            }
        } else {
            volumeInt = parseInt(volumeGB as any, 10)
        }

        if (!volumeInt || isNaN(volumeInt)) {
             return { success: false, error: `Invalid data size format: ${volumeGB}. Could not extract volume.` }
        }

        // Normalize phone number to start with 0 if it starts with 233
        let normalizedPhone = recipient
        if (normalizedPhone.startsWith('233')) normalizedPhone = '0' + normalizedPhone.slice(3)

        const requestBody = {
            network: network,
            volume_gb: volumeInt,
            recipient: normalizedPhone,
            reference: reference
        }

        console.log(`[DataGod] Request payload:`, JSON.stringify(requestBody))

        const response = await fetch(`${DATAGOD_API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': DATAGOD_API_KEY,
            },
            body: JSON.stringify(requestBody),
        })

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            const rawText = await response.text()
            console.error(`[DataGod Fulfillment] Non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 300))
            return { success: false, error: `Supplier returned unexpected response (HTTP ${response.status})` }
        }

        const data = await response.json()
        console.log(`[DataGod] Full API response (HTTP ${response.status}):`, JSON.stringify(data))

        // Analyze success criteria based on status code or data success flag
        if (response.ok && data.status !== 'failed' && data.status !== 'error') {
            return {
                success: true,
                reference: reference, // the custom reference we sent
                apiResponse: data,
            }
        }

        return {
            success: false,
            error: data.message || data.error || 'DataGod Fulfillment failed',
            apiResponse: data,
        }
    } catch (error: any) {
        console.error('[DataGod Fulfillment] Error:', error)
        return { success: false, error: error.message || 'Connection error to DataGod' }
    }
}

export async function checkDataGodOrderStatus(reference: string): Promise<DataGodStatusResponse> {
    if (!DATAGOD_API_KEY) return { success: false, status: 'pending', message: 'API not configured' }

    try {
        const response = await fetch(`${DATAGOD_API_BASE_URL}/orders?reference=${reference}`, {
            method: 'GET',
            headers: {
                'X-API-Key': DATAGOD_API_KEY,
            }
        })

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            console.error(`[DataGod Status] Non-JSON response (HTTP ${response.status})`)
            return { success: false, status: 'pending', message: `Supplier returned unexpected response (HTTP ${response.status})` }
        }

        const data = await response.json()
        console.log(`[DataGod Status] Raw Response for ${reference}:`, JSON.stringify(data).slice(0, 500))

        if (response.ok) {
            let statusStr = ''

            // Some APIs return /orders as a list even when queried by reference
            const dataList = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : null)
            
            if (dataList && dataList.length > 0) {
                // If the response is a list, pull the status from the first item
                statusStr = (dataList[0].status || '').toLowerCase()
            } else {
                // Otherwise it's exactly an object. Sometimes nested in `data`, sometimes in `order`
                statusStr = (data.status || data.data?.status || data.order?.status || '').toLowerCase()
            }

            let mappedStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'processing'
            
            if (['success', 'completed', 'delivered'].includes(statusStr)) mappedStatus = 'completed'
            else if (['failed', 'error', 'rejected'].includes(statusStr)) mappedStatus = 'failed'
            else if (['pending', 'processing', 'queued'].includes(statusStr)) mappedStatus = 'processing'

            return {
                success: true,
                status: mappedStatus,
                message: data.message,
                data: data.data || data,
            }
        }

        return { success: false, status: 'pending', message: data.message || 'Failed to check status' }
    } catch (error) {
        return { success: false, status: 'pending', message: 'Connection error' }
    }
}
