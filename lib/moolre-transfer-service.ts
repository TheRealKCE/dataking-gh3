/**
 * Moolre Transfer Service
 *
 * Handles Mobile Money and Bank account name validation, fund transfers,
 * transfer status checks, and bank list retrieval via the Moolre Transfer API.
 *
 * IMPORTANT: This file is completely isolated from the SMS service.
 * Uses: MOOLRE_TRANSFER_API_USER, MOOLRE_TRANSFER_API_KEY, MOOLRE_ACCOUNT_NUMBER
 * Never import or reference MOOLRE_API_KEY (SMS key) from this file.
 */

const MOOLRE_BASE_URL = 'https://api.moolre.com'

// ─── Channel Mapping ───────────────────────────────────────────────────────────
export const MOOLRE_CHANNEL_MAP: Record<string, number> = {
    'MTN MoMo': 1,
    'Telecel Cash': 6,
    'AirtelTigo Money': 7,
    'Bank': 2,
}

// ─── Response Types ────────────────────────────────────────────────────────────

export interface ValidateNameResult {
    success: boolean
    name: string | null
    error?: string
}

export interface InitiateTransferParams {
    amount: number          // Net amount to send (after fees)
    receiver: string        // MoMo number or bank account number
    channel: number         // Moolre channel ID
    shopName: string        // For building the reference string
    transactionId: string   // shop_wallet_transactions.id — used as externalref
    bankId?: string         // Required if channel=2 (bank transfer)
}

export interface InitiateTransferResult {
    success: boolean
    txstatus: number | null // 1=completed, 0=pending, 2=failed, 3=pending
    transactionid: string | null
    externalref: string | null
    error?: string
}

export interface CheckStatusResult {
    txstatus: number | null
    transactionid: string | null
    error?: string
}

export interface BankEntry {
    id: string
    name: string
}

// ─── Memory Cache for bank list ────────────────────────────────────────────────
let bankListCache: BankEntry[] | null = null
let bankListCachedAt: number | null = null
const BANK_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ─── Helper: Build headers for authenticated requests ──────────────────────────
function getAuthHeaders(): HeadersInit {
    const apiUser = process.env.MOOLRE_TRANSFER_API_USER
    const apiKey = process.env.MOOLRE_TRANSFER_API_KEY

    if (!apiUser || !apiKey) {
        throw new Error(
            '[MoolreTransfer] MOOLRE_TRANSFER_API_USER or MOOLRE_TRANSFER_API_KEY is not configured.'
        )
    }

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-USER': apiUser,
        'X-API-KEY': apiKey,
    }
}

// ─── Helper: Get account number ────────────────────────────────────────────────
function getAccountNumber(): string {
    const accountNumber = process.env.MOOLRE_ACCOUNT_NUMBER
    if (!accountNumber) {
        throw new Error('[MoolreTransfer] MOOLRE_ACCOUNT_NUMBER is not configured.')
    }
    return accountNumber
}

// ─── Method 1: Validate Account Name ──────────────────────────────────────────
/**
 * Validates the name on a Mobile Money or Bank account before initiating a transfer.
 * @param receiver - MoMo number or bank account number
 * @param channel  - Moolre channel ID (1=MTN, 6=Telecel, 7=AT, 2=Bank)
 * @param bankId   - Required only when channel=2 (bank transfer)
 */
export async function validateAccountName(
    receiver: string,
    channel: number,
    bankId?: string
): Promise<ValidateNameResult> {
    try {
        const accountNumber = getAccountNumber()
        const headers = getAuthHeaders()

        const body: Record<string, unknown> = {
            type: 1,
            receiver,
            channel,
            currency: 'GHS',
            accountnumber: accountNumber,
        }

        if (channel === 2 && bankId) {
            body.sublistid = bankId
        }

        const response = await fetch(`${MOOLRE_BASE_URL}/open/transact/validate`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await response.json()

        if (String(data.status) === '1' && data.data) {
            return { success: true, name: String(data.data) }
        }

        return {
            success: false,
            name: null,
            error: data.message || 'Account validation failed',
        }
    } catch (err: any) {
        console.error('[MoolreTransfer] validateAccountName error:', err.message)
        return { success: false, name: null, error: err.message || 'Network error during validation' }
    }
}

// ─── Method 2: Initiate Transfer ───────────────────────────────────────────────
/**
 * Sends money to a Mobile Money or Bank account.
 * txstatus meaning: 1=completed, 0=moolre_pending, 2=failed, 3=moolre_pending
 */
export async function initiateTransfer(
    params: InitiateTransferParams
): Promise<InitiateTransferResult> {
    try {
        const accountNumber = getAccountNumber()
        const headers = getAuthHeaders()

        // Build the reference: "KingFlexy - {shop_name truncated to 20 chars}"
        const reference = `KingFlexy - ${params.shopName.substring(0, 20)}`

        const body: Record<string, unknown> = {
            type: 1,
            receiver: params.receiver,
            channel: params.channel,
            currency: 'GHS',
            amount: params.amount,
            accountnumber: accountNumber,
            reference,
            externalref: params.transactionId,
        }

        if (params.channel === 2 && params.bankId) {
            body.sublistid = params.bankId
        }

        const response = await fetch(`${MOOLRE_BASE_URL}/open/transact/transfer`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await response.json()

        const txstatus = data.txstatus ?? data.data?.txstatus ?? null
        const transactionid = data.transactionid ?? data.data?.transactionid ?? null
        const externalref = data.externalref ?? data.data?.externalref ?? params.transactionId

        // Moolre returns status as a string or number, e.g. "1" for success, "0" for failure
        if (!response.ok || String(data.status) === '0' || String(data.status) !== '1') {
            return {
                success: false,
                txstatus,
                transactionid,
                externalref,
                error: data.message || `Moolre API error (HTTP ${response.status})`,
            }
        }

        return {
            success: true,
            txstatus,
            transactionid,
            externalref,
        }
    } catch (err: any) {
        console.error('[MoolreTransfer] initiateTransfer error:', err.message)
        return {
            success: false,
            txstatus: null,
            transactionid: null,
            externalref: params.transactionId,
            error: err.message || 'Network error during transfer',
        }
    }
}

// ─── Method 3: Check Transfer Status ──────────────────────────────────────────
/**
 * Polls the current status of a previously initiated transfer.
 * Used by the cron job for moolre_pending transactions.
 * @param externalref - The shop_wallet_transactions.id used when transfer was initiated
 */
export async function checkTransferStatus(externalref: string): Promise<CheckStatusResult> {
    try {
        const accountNumber = getAccountNumber()
        const headers = getAuthHeaders()

        const body = {
            type: 1,
            idtype: 1,
            id: externalref,
            accountnumber: accountNumber,
        }

        const response = await fetch(`${MOOLRE_BASE_URL}/open/transact/status`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await response.json()

        const txstatus = data.txstatus ?? data.data?.txstatus ?? null
        const transactionid = data.transactionid ?? data.data?.transactionid ?? null

        return { txstatus, transactionid }
    } catch (err: any) {
        console.error('[MoolreTransfer] checkTransferStatus error:', err.message)
        return { txstatus: null, transactionid: null, error: err.message }
    }
}

// ─── Method 4: Get Bank List ────────────────────────────────────────────────────
/**
 * Retrieves the list of supported banks for instant bank transfers.
 * Result is cached in memory for 1 hour.
 * No authentication headers required per Moolre docs.
 */
export async function getBanks(): Promise<BankEntry[]> {
    // Serve from cache if still fresh
    if (bankListCache && bankListCachedAt && Date.now() - bankListCachedAt < BANK_CACHE_TTL_MS) {
        return bankListCache
    }

    try {
        const response = await fetch(
            `${MOOLRE_BASE_URL}/open/transact/data?country=gha&data=banks`,
            {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            }
        )

        const data = await response.json()

        // Moolre returns the list in data.data or data directly
        const rawList: any[] = Array.isArray(data) ? data : (data.data ?? [])

        const banks: BankEntry[] = rawList.map((b: any) => ({
            id: String(b.code ?? b.id ?? b.bankid ?? b.bank_id),
            name: String(b.name ?? b.bankname ?? b.bank_name),
        }))

        // Populate cache
        bankListCache = banks
        bankListCachedAt = Date.now()

        return banks
    } catch (err: any) {
        console.error('[MoolreTransfer] getBanks error:', err.message)
        // Return cached version if available even if stale, rather than crashing
        return bankListCache ?? []
    }
}
