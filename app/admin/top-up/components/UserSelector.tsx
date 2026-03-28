'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, AlertTriangle, Clock, X, Crown, User, Users, Zap } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'

interface UserResult {
    id: string
    first_name: string
    last_name: string
    phone_number: string
    role: string
    wallet_balance: number
    last_admin_topup_at: string | null
    last_admin_topup_amount: number | null
    pending_debt_total: number
    topup_count?: number
}

interface UserSelectorProps {
    roleFilter: string
    onUserSelect: (user: UserResult) => void
    selectedUser: UserResult | null
    onClear: () => void
}

const ROLE_ICONS: Record<string, any> = {
    agent: Crown,
    customer: User,
    admin: Users,
}

const ROLE_COLORS: Record<string, string> = {
    agent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function UserMiniCard({ user, onSelect }: { user: UserResult; onSelect: () => void }) {
    const RoleIcon = ROLE_ICONS[user.role] || User
    const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    return (
        <button
            onClick={onSelect}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
        >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                {initials}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{user.first_name} {user.last_name}</span>
                    <Badge className={cn('text-[10px] px-1.5 py-0', ROLE_COLORS[user.role])}>{user.role}</Badge>
                    {user.pending_debt_total > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">Owes {formatCurrency(user.pending_debt_total)}</Badge>
                    )}
                </div>
                <div className="text-xs text-muted-foreground">{user.phone_number}</div>
                {user.last_admin_topup_at && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Last top-up: {formatCurrency(user.last_admin_topup_amount || 0)} · {formatDistanceToNow(new Date(user.last_admin_topup_at), { addSuffix: true })}
                    </div>
                )}
            </div>
            <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-emerald-600">{formatCurrency(user.wallet_balance)}</div>
            </div>
        </button>
    )
}

export function UserSelector({ roleFilter, onUserSelect, selectedUser, onClear }: UserSelectorProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserResult[]>([])
    const [frequentUsers, setFrequentUsers] = useState<UserResult[]>([])
    const [loading, setLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout>()

    const fetchFrequent = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/top-up/frequent-users?role=${roleFilter}`)
            if (res.ok) {
                const data = await res.json()
                setFrequentUsers(data.users || [])
            }
        } catch { /* silent */ }
    }, [roleFilter])

    useEffect(() => { fetchFrequent() }, [fetchFrequent])

    useEffect(() => {
        clearTimeout(debounceRef.current)
        if (!query.trim()) { setResults([]); setShowDropdown(false); return }
        debounceRef.current = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/admin/top-up/search-users?q=${encodeURIComponent(query)}&role=${roleFilter}`)
                if (res.ok) {
                    const data = await res.json()
                    setResults(data.users || [])
                    setShowDropdown(true)
                }
            } catch { /* silent */ } finally { setLoading(false) }
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [query, roleFilter])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    if (selectedUser) {
        return (
            <SelectedUserCard
                user={selectedUser}
                onClear={onClear}
            />
        )
    }

    return (
        <div className="space-y-4">
            {/* Frequent Users */}
            {frequentUsers.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-yellow-500" /> Frequently Topped-Up
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {frequentUsers.map(u => {
                            const initials = `${u.first_name[0]}${u.last_name[0]}`.toUpperCase()
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => onUserSelect(u)}
                                    className="flex-shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 w-36 text-left hover:border-yellow-400 hover:shadow-md transition-all"
                                >
                                    <div className="relative mb-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold">
                                            {initials}
                                        </div>
                                        {u.pending_debt_total > 0 && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold truncate">{u.first_name} {u.last_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{u.topup_count} top-ups</p>
                                    <p className="text-xs font-bold text-emerald-600 mt-1">{formatCurrency(u.wallet_balance)}</p>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Search Input */}
            <div className="relative" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name, phone, or email…"
                    aria-label="Search users to top up"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    className="pl-9 pr-9"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                {query && !loading && (
                    <button 
                        onClick={() => { setQuery(''); setShowDropdown(false) }} 
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        title="Clear search"
                    >
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                )}

                {showDropdown && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                        {results.map(u => (
                            <UserMiniCard key={u.id} user={u} onSelect={() => { onUserSelect(u); setQuery(''); setShowDropdown(false) }} />
                        ))}
                    </div>
                )}
                {showDropdown && results.length === 0 && !loading && query && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 text-center text-sm text-muted-foreground">
                        No users found for &quot;{query}&quot;
                    </div>
                )}
            </div>
        </div>
    )
}

function SelectedUserCard({ user, onClear }: { user: UserResult; onClear: () => void }) {
    const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    const minutesSinceTopup = user.last_admin_topup_at
        ? differenceInMinutes(new Date(), new Date(user.last_admin_topup_at))
        : null

    return (
        <div className="space-y-3">
            {/* Debt Alert */}
            {user.pending_debt_total > 0 && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">⚠️ DEBT ALERT</p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                            This user owes you <strong>{formatCurrency(user.pending_debt_total)}</strong>
                            {user.last_admin_topup_at && ` since ${formatDistanceToNow(new Date(user.last_admin_topup_at), { addSuffix: true })}`}.
                            Consider settling before adding more credit.
                        </p>
                    </div>
                </div>
            )}

            {/* Recent Top-Up Warning (< 10 mins) */}
            {minutesSinceTopup !== null && minutesSinceTopup < 10 && (
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        ⏱ You topped up this user just <strong>{minutesSinceTopup < 1 ? 'less than a minute' : `${minutesSinceTopup} minute${minutesSinceTopup > 1 ? 's' : ''}`}</strong> ago
                        ({formatCurrency(user.last_admin_topup_amount || 0)}). Are you sure you want to top up again?
                    </p>
                </div>
            )}

            {/* User Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base">{user.first_name} {user.last_name}</span>
                            <Badge className={cn('text-[10px]', ROLE_COLORS[user.role])}>{user.role}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                        {user.last_admin_topup_at && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                Last top-up: {formatCurrency(user.last_admin_topup_amount || 0)} · {formatDistanceToNow(new Date(user.last_admin_topup_at), { addSuffix: true })}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black text-emerald-600">{formatCurrency(user.wallet_balance)}</p>
                        <p className="text-[10px] text-muted-foreground">Current balance</p>
                        {user.pending_debt_total > 0 && (
                            <p className="text-xs font-bold text-amber-600 mt-1">Owes {formatCurrency(user.pending_debt_total)}</p>
                        )}
                    </div>
                </div>
                <button 
                    onClick={onClear} 
                    title="Change user"
                    className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                    <X className="w-3 h-3" /> Change user
                </button>
            </div>
        </div>
    )
}
