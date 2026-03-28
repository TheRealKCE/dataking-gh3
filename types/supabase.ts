export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    email: string
                    first_name: string
                    last_name: string
                    phone_number: string
                    role: 'customer' | 'agent' | 'admin' | 'sub-admin'
                    status: 'active' | 'suspended' | 'inactive'
                    agent_expires_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    email: string
                    first_name: string
                    last_name: string
                    phone_number: string
                    role?: 'customer' | 'agent' | 'admin' | 'sub-admin'
                    status?: 'active' | 'suspended' | 'inactive'
                    agent_expires_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    first_name?: string
                    last_name?: string
                    phone_number?: string
                    role?: 'customer' | 'agent' | 'admin' | 'sub-admin'
                    status?: 'active' | 'suspended' | 'inactive'
                    agent_expires_at?: string | null
                    updated_at?: string
                }
            }
            wallets: {
                Row: {
                    id: string
                    user_id: string
                    balance: number
                    total_credited: number
                    total_spent: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    balance?: number
                    total_credited?: number
                    total_spent?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    balance?: number
                    total_credited?: number
                    total_spent?: number
                    updated_at?: string
                }
            }
            wallet_transactions: {
                Row: {
                    id: string
                    wallet_id: string
                    user_id: string
                    type: 'credit' | 'debit'
                    amount: number
                    description: string
                    reference: string | null
                    source: 'payment' | 'refund' | 'admin' | 'purchase'
                    status: 'pending' | 'completed' | 'failed'
                    created_at: string
                }
                Insert: {
                    id?: string
                    wallet_id: string
                    user_id: string
                    type: 'credit' | 'debit'
                    amount: number
                    description: string
                    reference?: string | null
                    source: 'payment' | 'refund' | 'admin' | 'purchase'
                    status?: 'pending' | 'completed' | 'failed'
                    created_at?: string
                }
                Update: {
                    status?: 'pending' | 'completed' | 'failed'
                }
            }
            wallet_payments: {
                Row: {
                    id: string
                    user_id: string
                    wallet_id: string
                    amount: number
                    fee: number
                    total_amount: number
                    reference: string
                    provider: 'paystack'
                    status: 'pending' | 'completed' | 'failed'
                    provider_reference: string | null
                    metadata: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    wallet_id: string
                    amount: number
                    fee: number
                    total_amount: number
                    reference: string
                    provider?: 'paystack'
                    status?: 'pending' | 'completed' | 'failed'
                    provider_reference?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'completed' | 'failed'
                    provider_reference?: string | null
                    metadata?: Json | null
                    updated_at?: string
                }
            }
            data_packages: {
                Row: {
                    id: string
                    network: 'MTN' | 'Telecel' | 'AT-iShare' | 'AT-BigTime'
                    size: string
                    price: number
                    cost_price?: number
                    description: string | null
                    is_available: boolean
                    sort_order: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    network: 'MTN' | 'Telecel' | 'AT-iShare' | 'AT-BigTime'
                    size: string
                    price: number
                    description?: string | null
                    is_available?: boolean
                    sort_order?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    network?: 'MTN' | 'Telecel' | 'AT-iShare' | 'AT-BigTime'
                    size?: string
                    price?: number
                    description?: string | null
                    is_available?: boolean
                    sort_order?: number
                    updated_at?: string
                }
            }
            orders: {
                Row: {
                    id: string
                    user_id: string
                    phone_number: string
                    network: string
                    size: string
                    price: number
                    cost_price?: number
                    status: 'pending' | 'processing' | 'completed' | 'failed'
                    payment_status: 'paid' | 'refunded'
                    reference_code: string
                    fulfillment_method: 'auto' | 'manual'
                    codecraft_reference: string | null
                    error_message: string | null
                    download_batch_id: string | null
                    shop_order_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    phone_number: string
                    network: string
                    size: string
                    price: number
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    payment_status?: 'paid' | 'refunded'
                    reference_code: string
                    fulfillment_method?: 'auto' | 'manual'
                    codecraft_reference?: string | null
                    error_message?: string | null
                    download_batch_id?: string | null
                    shop_order_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    payment_status?: 'paid' | 'refunded'
                    codecraft_reference?: string | null
                    error_message?: string | null
                    download_batch_id?: string | null
                    shop_order_id?: string | null
                    updated_at?: string
                }
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    title: string
                    message: string
                    type: 'order_update' | 'complaint_resolved' | 'payment_success' | 'balance_updated' | 'system'
                    is_read: boolean
                    action_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    title: string
                    message: string
                    type: 'order_update' | 'complaint_resolved' | 'payment_success' | 'balance_updated' | 'system'
                    is_read?: boolean
                    action_url?: string | null
                    created_at?: string
                }
                Update: {
                    is_read?: boolean
                }
            }
            complaints: {
                Row: {
                    id: string
                    user_id: string
                    order_id: string
                    title: string
                    description: string
                    status: 'pending' | 'in_review' | 'resolved' | 'rejected'
                    priority: 'low' | 'medium' | 'high'
                    resolution_notes: string | null
                    evidence: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    order_id: string
                    title: string
                    description: string
                    status?: 'pending' | 'in_review' | 'resolved' | 'rejected'
                    priority?: 'low' | 'medium' | 'high'
                    resolution_notes?: string | null
                    evidence?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'in_review' | 'resolved' | 'rejected'
                    priority?: 'low' | 'medium' | 'high'
                    resolution_notes?: string | null
                    updated_at?: string
                }
            }
            mtn_fulfillment_tracking: {
                Row: {
                    id: string
                    order_id: string
                    status: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response: Json | null
                    retry_count: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    order_id: string
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response?: Json | null
                    retry_count?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response?: Json | null
                    retry_count?: number
                    updated_at?: string
                }
            }
            fulfillment_logs: {
                Row: {
                    id: string
                    order_id: string
                    status: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response: Json | null
                    codecraft_reference: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    order_id: string
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response?: Json | null
                    codecraft_reference?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'processing' | 'completed' | 'failed'
                    api_response?: Json | null
                    codecraft_reference?: string | null
                    updated_at?: string
                }
            }
            admin_settings: {
                Row: {
                    key: string
                    value: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    key: string
                    value: Json
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    value?: Json
                    updated_at?: string
                }
            }
            phone_blacklist: {
                Row: {
                    id: string
                    phone_number: string
                    reason: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    phone_number: string
                    reason?: string | null
                    created_at?: string
                }
                Update: {
                    reason?: string | null
                }
            }
            afa_orders: {
                Row: {
                    id: string
                    user_id: string
                    full_name: string
                    phone: string
                    ghana_card: string
                    location: string
                    region: string
                    occupation: string
                    date_of_birth?: string | null
                    status: 'pending' | 'processing' | 'completed' | 'cancelled'
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    full_name: string
                    phone: string
                    ghana_card: string
                    location: string
                    region: string
                    occupation: string
                    date_of_birth?: string | null
                    status?: 'pending' | 'processing' | 'completed' | 'cancelled'
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    status?: 'pending' | 'processing' | 'completed' | 'cancelled'
                    notes?: string | null
                    updated_at?: string
                }
            }
            customer_purchases: {
                Row: {
                    id: string
                    user_id: string
                    customer_phone: string
                    total_purchases: number
                    total_spent: number
                    first_purchase_at: string
                    last_purchase_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    customer_phone: string
                    total_purchases?: number
                    total_spent?: number
                    first_purchase_at?: string
                    last_purchase_at?: string
                }
                Update: {
                    total_purchases?: number
                    total_spent?: number
                    last_purchase_at?: string
                }
            }
            download_batches: {
                Row: {
                    id: string
                    filename: string
                    network: string
                    order_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    filename: string
                    network: string
                    order_count: number
                    created_at?: string
                }
                Update: {
                    filename?: string
                    network?: string
                    order_count?: number
                }
            }
            system_announcements: {
                Row: {
                    id: string
                    title: string
                    message: string
                    is_active: boolean
                    visible_on: 'main_site' | 'storefronts' | 'both'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    message: string
                    is_active?: boolean
                    visible_on?: 'main_site' | 'storefronts' | 'both'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    title?: string
                    message?: string
                    is_active?: boolean
                    visible_on?: 'main_site' | 'storefronts' | 'both'
                    updated_at?: string
                }
            }
            shop_announcements: {
                Row: {
                    id: string
                    shop_id: string
                    message: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    shop_id: string
                    message: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    message?: string
                    is_active?: boolean
                }
            }
            pending_settlements: {
                Row: {
                    id: string
                    user_id: string
                    wallet_transaction_id: string | null
                    amount_owed: number
                    amount_settled: number
                    status: 'pending' | 'partially_settled' | 'settled'
                    payment_method: string | null
                    notes: string | null
                    created_at: string
                    settled_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    wallet_transaction_id?: string | null
                    amount_owed: number
                    amount_settled?: number
                    status?: 'pending' | 'partially_settled' | 'settled'
                    payment_method?: string | null
                    notes?: string | null
                    created_at?: string
                    settled_at?: string | null
                }
                Update: {
                    amount_settled?: number
                    status?: 'pending' | 'partially_settled' | 'settled'
                    payment_method?: string | null
                    notes?: string | null
                    settled_at?: string | null
                }
            }
        }
    }
}

export type User = Database['public']['Tables']['users']['Row']
export type Wallet = Database['public']['Tables']['wallets']['Row']
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row']
export type WalletPayment = Database['public']['Tables']['wallet_payments']['Row']
export type DataPackage = Database['public']['Tables']['data_packages']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type Complaint = Database['public']['Tables']['complaints']['Row']
export type AdminSetting = Database['public']['Tables']['admin_settings']['Row']
export type AFAOrder = Database['public']['Tables']['afa_orders']['Row']
export type CustomerPurchase = Database['public']['Tables']['customer_purchases']['Row']
export type DownloadBatch = Database['public']['Tables']['download_batches']['Row']
export type SystemAnnouncement = Database['public']['Tables']['system_announcements']['Row']
export type ShopAnnouncement = Database['public']['Tables']['shop_announcements']['Row']
export type PendingSettlement = Database['public']['Tables']['pending_settlements']['Row']
