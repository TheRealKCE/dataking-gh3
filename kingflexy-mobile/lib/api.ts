import { supabase } from './supabase';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kingflexygh.com';

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();

    const headers = new Headers(options.headers);
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(error.message || response.statusText);
    }

    return response.json();
}

export const api = {
    getPackages: () => fetchWithAuth('/api/shop/packages'),
    getOrders: () => fetchWithAuth('/api/orders/history'),
    createOrder: (orderData: any) => fetchWithAuth('/api/orders/create', {
        method: 'POST',
        body: JSON.stringify(orderData),
    }),
    getWalletBalance: () => fetchWithAuth('/api/wallet/balance'),
    topUpWallet: (amount: number) => fetchWithAuth('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    }),
};
