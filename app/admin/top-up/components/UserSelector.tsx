'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Loader2, Search, AlertTriangle, Clock, X, Crown, User, Users,
    Zap, Star, Plus, Check, ChevronDown, Trash2, ListPlus
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { formatDistanceToNow, differenceInMinutes } from 'date-fns'
import { toast } from 'sonner'

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

interface CustomList {
    id: string
    name: string
    users: UserResult[]
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
    subadmin: Users,
}

const ROLE_COLORS: Record<string, string> = {
    agent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    subadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

// ─────────────────────────────────────────────
// Search result mini-card (dropdown)
// ─────────────────────────────────────────────
function UserMiniCard({ user, onSelect }: { user: UserResult; onSelect: () => void }) {
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
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Owes {formatCurrency(user.pending_debt_total)}
                        </Badge>
                    )}
                </div>
                <div className="text-xs text-muted-foreground">{user.phone_number}</div>
                {user.last_admin_topup_at && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Last: {formatCurrency(user.last_admin_topup_amount || 0)} · {formatDistanceToNow(new Date(user.last_admin_topup_at), { addSuffix: true })}
                    </div>
                )}
            </div>
            <div className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatCurrency(user.wallet_balance)}</div>
        </button>
    )
}

// ─────────────────────────────────────────────
// Frequent/List user chip
// ─────────────────────────────────────────────
function UserChip({ user, onSelect }: { user: UserResult; onSelect: () => void }) {
    const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    return (
        <button
            onClick={() => onSelect()}
            className="flex-shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 w-36 text-left hover:border-yellow-400 dark:hover:border-yellow-500 hover:shadow-md transition-all group"
        >
            <div className="relative mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                </div>
                {user.pending_debt_total > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
            </div>
            <p className="text-xs font-semibold truncate">{user.first_name} {user.last_name}</p>
            {user.topup_count && (
                <p className="text-[10px] text-muted-foreground">{user.topup_count} top-ups</p>
            )}
            <p className="text-xs font-bold text-emerald-600 mt-1">{formatCurrency(user.wallet_balance)}</p>
        </button>
    )
}

// ─────────────────────────────────────────────
// Add-to-List Popover
// ─────────────────────────────────────────────
function AddToListPopover({
    user,
    lists,
    onRefreshLists,
    onClose,
}: {
    user: UserResult
    lists: CustomList[]
    onRefreshLists: () => void
    onClose: () => void
}) {
    const [newListName, setNewListName] = useState('')
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [creatingList, setCreatingList] = useState(false)

    const isInList = (list: CustomList) => list.users.some(u => u.id === user.id)

    const toggleMembership = async (list: CustomList) => {
        setLoadingId(list.id)
        const action = isInList(list) ? 'remove' : 'add'
        try {
            const res = await fetch('/api/admin/top-up/user-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, listId: list.id, userId: user.id })
            })
            if (res.ok) {
                toast.success(action === 'add' ? `Added to "${list.name}"` : `Removed from "${list.name}"`)
                onRefreshLists()
            } else {
                const d = await res.json()
                toast.error(d.error || 'Failed')
            }
        } catch { toast.error('Network error') }
        finally { setLoadingId(null) }
    }

    const createAndAdd = async () => {
        if (!newListName.trim()) { toast.error('Enter a list name'); return }
        setCreatingList(true)
        try {
            // Create list
            const createRes = await fetch('/api/admin/top-up/user-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', listName: newListName.trim() })
            })
            const createData = await createRes.json()
            if (!createRes.ok) { toast.error(createData.error || 'Failed to create list'); return }

            // Add user to new list
            await fetch('/api/admin/top-up/user-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', listId: createData.list.id, userId: user.id })
            })
            toast.success(`Created "${newListName.trim()}" and added ${user.first_name}!`)
            setNewListName('')
            onRefreshLists()
        } catch { toast.error('Network error') }
        finally { setCreatingList(false) }
    }

    return (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add to List</p>
            {lists.length === 0 && (
                <p className="text-xs text-muted-foreground py-1">No lists yet. Create one below.</p>
            )}
            {lists.map(list => (
                <button
                    key={list.id}
                    onClick={() => toggleMembership(list)}
                    disabled={loadingId === list.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                    {loadingId === list.id
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : isInList(list)
                        ? <Check className="w-4 h-4 text-emerald-500" />
                        : <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600" />
                    }
                    <span className={cn('font-medium flex-1 text-left', isInList(list) && 'text-emerald-600 dark:text-emerald-400')}>
                        {list.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{list.users.length}</span>
                </button>
            ))}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-semibold">Create new list</p>
                <div className="flex gap-1.5">
                    <Input
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        placeholder="e.g. Favorites"
                        className="h-7 text-xs flex-1"
                        onKeyDown={e => e.key === 'Enter' && createAndAdd()}
                    />
                    <Button size="sm" onClick={createAndAdd} disabled={creatingList} className="h-7 px-2">
                        {creatingList ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </Button>
                </div>
            </div>
            <button onClick={onClose} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground pt-1">
                Close
            </button>
        </div>
    )
}

// ─────────────────────────────────────────────
// Premium Selected User Card
// ─────────────────────────────────────────────
function SelectedUserCard({
    user,
    onClear,
    lists,
    onRefreshLists,
}: {
    user: UserResult
    onClear: () => void
    lists: CustomList[]
    onRefreshLists: () => void
}) {
    const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    const minutesSinceTopup = user.last_admin_topup_at
        ? differenceInMinutes(new Date(), new Date(user.last_admin_topup_at))
        : null
    const [showListPicker, setShowListPicker] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Close popover on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowListPicker(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const RoleIcon = ROLE_ICONS[user.role] || User

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

            {/* ─── Premium User Card ─── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
                {/* Gradient accent top strip */}
                <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500" />

                <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-slate-800/80 p-5">
                    {/* Top row: avatar + main info + balance */}
                    <div className="flex items-start gap-4">
                        {/* Avatar with optional debt glow */}
                        <div className={cn(
                            'w-16 h-16 flex-shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md',
                            user.pending_debt_total > 0
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-300 dark:ring-amber-600 ring-offset-2 dark:ring-offset-slate-900'
                                : 'bg-gradient-to-br from-slate-600 to-slate-800'
                        )}>
                            {initials}
                        </div>

                        {/* Name + details */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-lg font-black tracking-tight">{user.first_name} {user.last_name}</span>
                                <Badge className={cn('text-[10px] font-bold px-2', ROLE_COLORS[user.role])}>
                                    <RoleIcon className="w-2.5 h-2.5 mr-1" />
                                    {user.role}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">{user.phone_number}</p>
                            {user.last_admin_topup_at && (
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>Last top-up: <strong>{formatCurrency(user.last_admin_topup_amount || 0)}</strong> · {formatDistanceToNow(new Date(user.last_admin_topup_at), { addSuffix: true })}</span>
                                </div>
                            )}
                        </div>

                        {/* Balance pill */}
                        <div className="flex-shrink-0 text-right">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                    {formatCurrency(user.wallet_balance)}
                                </p>
                                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 font-semibold">Balance</p>
                            </div>
                            {user.pending_debt_total > 0 && (
                                <div className="mt-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-1.5 text-right">
                                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 leading-none">
                                        {formatCurrency(user.pending_debt_total)}
                                    </p>
                                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-semibold">Owes</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                        {/* Add to List button with popover */}
                        <div className="relative" ref={popoverRef}>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowListPicker(prev => !prev)}
                                className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-700"
                            >
                                <Star className={cn('w-3.5 h-3.5', showListPicker && 'fill-yellow-400 text-yellow-500')} />
                                Add to List
                                <ChevronDown className={cn('w-3 h-3 transition-transform', showListPicker && 'rotate-180')} />
                            </Button>
                            {showListPicker && (
                                <AddToListPopover
                                    user={user}
                                    lists={lists}
                                    onRefreshLists={onRefreshLists}
                                    onClose={() => setShowListPicker(false)}
                                />
                            )}
                        </div>

                        <div className="flex-1" />

                        {/* Change user */}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onClear}
                            title="Change user"
                            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            Change
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Main UserSelector
// ─────────────────────────────────────────────
export function UserSelector({ roleFilter, onUserSelect, selectedUser, onClear }: UserSelectorProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<UserResult[]>([])
    const [frequentUsers, setFrequentUsers] = useState<UserResult[]>([])
    const [customLists, setCustomLists] = useState<CustomList[]>([])
    const [activeListTab, setActiveListTab] = useState<'frequent' | string>('frequent')
    const [loading, setLoading] = useState(false)
    const [loadingLists, setLoadingLists] = useState(false)
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

    const fetchLists = useCallback(async () => {
        setLoadingLists(true)
        try {
            const res = await fetch('/api/admin/top-up/user-lists')
            if (res.ok) {
                const data = await res.json()
                setCustomLists(data.lists || [])
            }
        } catch { /* silent */ }
        finally { setLoadingLists(false) }
    }, [])

    useEffect(() => { fetchFrequent() }, [fetchFrequent])
    useEffect(() => { fetchLists() }, [fetchLists])

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
                lists={customLists}
                onRefreshLists={fetchLists}
            />
        )
    }

    // Determine which users to show in the horizontal strip
    const activeListUsers = activeListTab === 'frequent'
        ? frequentUsers
        : customLists.find(l => l.id === activeListTab)?.users || []

    return (
        <div className="space-y-4">
            {/* List Tabs + Strip */}
            {(frequentUsers.length > 0 || customLists.length > 0) && (
                <div>
                    {/* Tab row */}
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                        <button
                            onClick={() => setActiveListTab('frequent')}
                            className={cn(
                                'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition-all',
                                activeListTab === 'frequent'
                                    ? 'bg-yellow-500 text-white border-yellow-500'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-yellow-400'
                            )}
                        >
                            <Zap className="w-3 h-3" /> Frequent
                        </button>
                        {(customLists as CustomList[]).map(list => (
                            <button
                                key={list.id}
                                onClick={() => setActiveListTab(list.id)}
                                className={cn(
                                    'flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition-all',
                                    activeListTab === list.id
                                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-slate-400'
                                )}
                            >
                                <Star className="w-3 h-3" /> {list.name}
                                <span className="opacity-60">({list.users.length})</span>
                            </button>
                        ))}
                        {loadingLists && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    </div>

                    {/* User chips horizontal scroll */}
                    {activeListUsers.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                            {activeListUsers.map(u => (
                                <UserChip key={u.id} user={u} onSelect={() => onUserSelect(u)} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground py-2">
                            {activeListTab === 'frequent'
                                ? 'No frequently topped-up users yet.'
                                : 'No users in this list yet. Select a user and add them using the ⭐ button.'}
                        </div>
                    )}
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
