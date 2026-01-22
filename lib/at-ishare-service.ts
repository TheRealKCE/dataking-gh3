// CodeCraft API Service for AT-iShare, Telecel, AT-BigTime fulfillment

const CODECRAFT_API_URL = process.env.CODECRAFT_API_URL || 'https://api.codecraftnetwork.com/api'
const CODECRAFT_API_KEY = process.env.CODECRAFT_API_KEY || ''

interface CodeCraftResponse {
    success: boolean
    reference_id?: string
    message?: string
    error?: string
}

interface OrderStatusResponse {
    success: boolean
    status: 'pending' | 'completed' | 'failed'
    message?: string
}

export async function initiateRegularOrder(
    recipientNumber: string,
    gig: string,
    network: string
): Promise<CodeCraftResponse> {
    try {
        const response = await fetch(`${CODECRAFT_API_URL}/initiate.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CODECRAFT_API_KEY,
            },
            body: JSON.stringify({
                recipient_number: recipientNumber,
                gig: gig,
                network: network.toLowerCase(),
            }),
        })

        const data = await response.json()

        return {
            success: data.success || false,
            reference_id: data.reference_id,
            message: data.message,
            error: data.error,
        }
    } catch (error) {
        console.error('CodeCraft initiate error:', error)
        return {
            success: false,
            error: 'Failed to connect to CodeCraft API',
        }
    }
}

export async function initiateSpecialOrder(
    recipientNumber: string,
    gig: string
): Promise<CodeCraftResponse> {
    try {
        const response = await fetch(`${CODECRAFT_API_URL}/special.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CODECRAFT_API_KEY,
            },
            body: JSON.stringify({
                recipient_number: recipientNumber,
                gig: gig,
            }),
        })

        const data = await response.json()

        return {
            success: data.success || false,
            reference_id: data.reference_id,
            message: data.message,
            error: data.error,
        }
    } catch (error) {
        console.error('CodeCraft special order error:', error)
        return {
            success: false,
            error: 'Failed to connect to CodeCraft API',
        }
    }
}

export async function checkRegularOrderStatus(referenceId: string): Promise<OrderStatusResponse> {
    try {
        const response = await fetch(
            `${CODECRAFT_API_URL}/response_regular.php?reference_id=${referenceId}`,
            {
                headers: {
                    'x-api-key': CODECRAFT_API_KEY,
                },
            }
        )

        const data = await response.json()

        return {
            success: true,
            status: mapCodeCraftStatus(data.status),
            message: data.message,
        }
    } catch (error) {
        console.error('CodeCraft status check error:', error)
        return {
            success: false,
            status: 'pending',
            message: 'Failed to check status',
        }
    }
}

export async function checkBigTimeOrderStatus(referenceId: string): Promise<OrderStatusResponse> {
    try {
        const response = await fetch(
            `${CODECRAFT_API_URL}/response_big_time.php?reference_id=${referenceId}`,
            {
                headers: {
                    'x-api-key': CODECRAFT_API_KEY,
                },
            }
        )

        const data = await response.json()

        return {
            success: true,
            status: mapCodeCraftStatus(data.status),
            message: data.message,
        }
    } catch (error) {
        console.error('CodeCraft BigTime status check error:', error)
        return {
            success: false,
            status: 'pending',
            message: 'Failed to check status',
        }
    }
}

function mapCodeCraftStatus(status: string): 'pending' | 'completed' | 'failed' {
    const lowerStatus = (status || '').toLowerCase()

    if (lowerStatus === 'success' || lowerStatus === 'completed') {
        return 'completed'
    }
    if (lowerStatus === 'failed' || lowerStatus === 'error') {
        return 'failed'
    }
    return 'pending'
}

export async function fulfillOrder(
    phoneNumber: string,
    size: string,
    network: string
): Promise<CodeCraftResponse> {
    // Normalize phone number (remove leading 0, add country code if needed)
    const normalizedPhone = phoneNumber.startsWith('0')
        ? phoneNumber.slice(1)
        : phoneNumber

    // Extract gig value from size (e.g., "1GB" -> "1")
    const gigMatch = size.match(/(\d+(?:\.\d+)?)/);
    const gig = gigMatch ? gigMatch[1] : size;

    if (network === 'AT-BigTime') {
        return initiateSpecialOrder(normalizedPhone, gig)
    }

    // Map network names to CodeCraft format
    const networkMap: Record<string, string> = {
        'Telecel': 'telecel',
        'AT-iShare': 'airteltigo',
    }

    const codecraftNetwork = networkMap[network] || network.toLowerCase()

    return initiateRegularOrder(normalizedPhone, gig, codecraftNetwork)
}
