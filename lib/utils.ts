import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
        minimumFractionDigits: 2,
    }).format(amount)
}

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-GH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(date))
}

export function generateReferenceCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `GHD-${timestamp}-${random}`
}

export function getNetworkColor(network: string): string {
    const colors: Record<string, string> = {
        'MTN': 'bg-yellow-500',
        'Telecel': 'bg-red-500',
        'AT-iShare': 'bg-orange-500',
        'AT-BigTime': 'bg-orange-600',
    }
    return colors[network] || 'bg-gray-500'
}

export function getNetworkGradient(network: string): string {
    const gradients: Record<string, string> = {
        'MTN': 'from-yellow-400 to-yellow-600',
        'Telecel': 'from-red-500 to-red-700',
        'AT-iShare': 'from-orange-400 to-red-500',
        'AT-BigTime': 'from-orange-500 to-red-600',
    }
    return gradients[network] || 'from-gray-400 to-gray-600'
}

export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        'pending': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        'processing': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        'completed': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        'failed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
}

export function calculatePaystackFee(amount: number, feePercentage: number = 1.95): number {
    const fee = (amount * feePercentage) / 100
    return Math.round(fee * 100) / 100
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function normalizeWhatsAppNumber(phone: string): string {
    // Remove all non-numeric characters (including +)
    const numeric = phone.replace(/\D/g, '')

    // Handle common Ghana formats:
    // 1. Starts with 0 and has 10 digits (e.g. 0555...) -> replace 0 with 233
    if (numeric.startsWith('0') && numeric.length === 10) {
        return '233' + numeric.substring(1)
    }

    // 2. Starts with a digit like 5, 2 and has 9 digits (e.g. 555...) -> prefix with 233
    if (numeric.length === 9 && (numeric.startsWith('5') || numeric.startsWith('2') || numeric.startsWith('4'))) {
        return '233' + numeric
    }

    // 3. Otherwise return numeric as is (e.g. if it already has 233)
    return numeric
}
