'use client'

import * as XLSX from 'xlsx'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Search,
    MoreVertical,
    Ban,
    CheckCircle,
    Wallet,
    UserCog,
    Shield,
    Loader2,
    Trash2,
    Store,
    Phone,
    Calendar,
    Mail,
    Download,
    KeyRound
} from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { roleConfig, UserRole } from '@/lib/roles'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const ITEMS_PER_PAGE = 20

    // Wallet Adjustment Dialog State
    const [adjustmentDialogUser, setAdjustmentDialogUser] = useState<any>(null)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit')
    const [adjustmentDescription, setAdjustmentDescription] = useState('Admin manual adjustment')
    const [isAdjusting, setIsAdjusting] = useState(false)

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Fetch initial data or when filters change
    useEffect(() => {
        setPage(0)
        fetchUsers(0, true)
    }, [debouncedSearch, roleFilter])

    const fetchUsers = async (pageToFetch: number, isNewSearch = false) => {
        try {
            setLoading(true)
            const offset = pageToFetch * ITEMS_PER_PAGE
            const url = `/api/admin/users?limit=${ITEMS_PER_PAGE}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}&role=${roleFilter}`

            const response = await fetch(url)
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch users')
            }
            const data = await response.json()

            const newUsers = data.users || []
            if (isNewSearch) {
                setUsers(newUsers)
            } else {
                setUsers(prev => [...prev, ...newUsers])
            }

            setTotalCount(data.totalCount || 0)
            setHasMore(newUsers.length === ITEMS_PER_PAGE)
        } catch (error: any) {
            console.error('Error fetching users:', error)
            toast.error(error.message || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    const loadMore = () => {
        if (!loading && hasMore) {
            const nextPage = page + 1
            setPage(nextPage)
            fetchUsers(nextPage)
        }
    }

    const handleStatusChange = async (userId: string, newStatus: string) => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/users/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update user status')

            setUsers(prevUsers => Array.isArray(prevUsers) ? prevUsers.map(u => u.id === userId ? { ...u, status: newStatus } : u) : [])
            toast.success(`User marked as ${newStatus}`)
        } catch (error: any) {
            console.error('Status change error:', error)
            toast.error(error.message || 'Failed to update user status')
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to make this user ${newRole}?`)) return

        try {
            setLoading(true)
            const response = await fetch('/api/admin/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update user role')

            setUsers(prevUsers => Array.isArray(prevUsers) ? prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u) : [])
            toast.success(`User role updated to ${newRole}`)
        } catch (error: any) {
            console.error('Role change error:', error)
            toast.error(error.message || 'Failed to update user role')
        } finally {
            setLoading(false)
        }
    }

    const handleManualAdjustment = async () => {
        if (!adjustmentDialogUser || !adjustmentAmount) return

        const amount = parseFloat(adjustmentAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount')
            return
        }

        setIsAdjusting(true)
        try {
            const response = await fetch('/api/admin/users/wallet/adjustment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: adjustmentDialogUser.id,
                    amount: amount,
                    type: adjustmentType,
                    description: adjustmentDescription
                })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to adjust wallet')

            toast.success(`Wallet ${adjustmentType === 'credit' ? 'credited' : 'debited'} successfully`)

            if (result.debug && adjustmentType === 'credit') {
                const { userFound, phoneFound, smsAttempted, smsResult } = result.debug
                if (!userFound) toast.error('DEBUG: User not found in DB')
                else if (!phoneFound) toast.error('DEBUG: No phone number on user record')
                else if (!smsAttempted) toast.error('DEBUG: SMS logic skipped (unknown reason)')
                else if (smsResult?.success) toast.success(`DEBUG: SMS Sent to ${phoneFound}`)
                else toast.error(`DEBUG: SMS Failed: ${smsResult?.error || 'Unknown error'}`)
            }

            fetchUsers(0, true) // Refresh list to show new balance
            setAdjustmentDialogUser(null)
            setAdjustmentAmount('')
        } catch (error: any) {
            console.error('Adjustment error:', error)
            toast.error(error.message || `Failed to ${adjustmentType} wallet`)
        } finally {
            setIsAdjusting(false)
        }
    }

    const handleResetPassword = async (userId: string, userName: string) => {
        if (!confirm(`Send a password reset email to ${userName}?\n\nThey will receive an email with a link to set a new password.`)) return

        try {
            const response = await fetch('/api/admin/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to send reset email')

            toast.success(`Password reset email sent to ${userName}`)
        } catch (error: any) {
            console.error('Reset password error:', error)
            toast.error(error.message || 'Failed to send reset email')
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('EXTREMELY IMPORTANT:\n\nThis will PERMANENTLY delete the user from both Authentication and Database records.\nThis includes their wallet, orders, and history.\nThis action CANNOT be undone.\n\nAre you sure you want to proceed?')) return

        try {
            setLoading(true)
            const response = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to delete user')

            setUsers(prevUsers => Array.isArray(prevUsers) ? prevUsers.filter(u => u.id !== userId) : [])
            toast.success('User permanently deleted')
        } catch (error: any) {
            console.error('Deletion error:', error)
            toast.error(error.message || 'Failed to delete user')
        } finally {
            setLoading(false)
        }
    }

    // Server-side filtered data is directly in 'users' state

    const exportForMNotify = () => {
        try {
            // mNotify requires: firstname, lastname, phone, email, date_of_birth (in this exact order)
            const usersWithPhones = (Array.isArray(users) ? users : []).filter(user => user.phone_number)

            if (usersWithPhones.length === 0) {
                toast.error('No users with phone numbers to export')
                return
            }

            // Build rows in mNotify's required column order
            const rows = usersWithPhones.map(user => ({
                firstname: user.first_name || 'Unknown',
                lastname: user.last_name || '',
                phone: user.phone_number,
                email: user.email || '',
                date_of_birth: '', // Not collected — mNotify accepts blank
            }))

            // Generate XLSX workbook
            const worksheet = XLSX.utils.json_to_sheet(rows, {
                header: ['firstname', 'lastname', 'phone', 'email', 'date_of_birth']
            })
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts')

            const timestamp = new Date().toISOString().split('T')[0]
            XLSX.writeFile(workbook, `mnotify_contacts_${timestamp}.xlsx`)

            toast.success(`Exported ${rows.length} contacts for mNotify`)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export contacts')
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col items-center gap-4 sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b text-center">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Users Management
                    </h1>
                    <p className="text-sm text-muted-foreground">Manage {totalCount} accounts and wallets</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            id="user-search"
                            name="user-search"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-purple-500 transition-all rounded-xl"
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="bg-secondary/50 border-0 focus:ring-1 focus:ring-purple-500 rounded-xl">
                                <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={exportForMNotify}
                        variant="outline"
                        className="w-full sm:w-auto gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 hover:border-blue-400 rounded-xl"
                    >
                        <Download className="w-4 h-4" />
                        Export for mNotify
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <p>No users found matching your search.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.isArray(users) && users.map((user) => (
                            <Card
                                key={user.id}
                                className="group relative overflow-hidden border border-purple-100 dark:border-purple-900/30 lg:hover:border-purple-500/50 transition-all duration-200 shadow-md lg:hover:shadow-xl lg:hover:-translate-y-1 bg-white dark:bg-slate-900/50"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-50 font-black text-6xl text-slate-100 dark:text-slate-800/50 -z-10 select-none pointer-events-none">
                                    {user.first_name?.[0]}
                                </div>

                                <CardContent className="p-6 space-y-6">
                                    {/* Header / ID Card Style */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4 items-center">
                                            {(() => {
                                                const userRole = (user.role || 'customer') as UserRole
                                                const config = roleConfig[userRole] || roleConfig['customer']
                                                const RoleIcon = config.icon
                                                return (
                                                    <div
                                                        className="h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-gray-800 transition-transform hover:scale-105"
                                                        style={{ backgroundColor: config.color }}
                                                    >
                                                        <RoleIcon className="w-8 h-8" />
                                                    </div>
                                                )
                                            })()}
                                            <div>
                                                <h3 className="font-bold text-xl text-slate-900 dark:text-white line-clamp-1">{user.first_name} {user.last_name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {user.role === 'admin' ? (
                                                        <Badge className="text-white" style={{ backgroundColor: '#E60000' }}>Admin</Badge>
                                                    ) : user.role === 'sub-admin' ? (
                                                        <Badge className="text-black" style={{ backgroundColor: '#FACC15' }}>Sub-Admin</Badge>
                                                    ) : user.role === 'agent' ? (
                                                        <Badge className="text-white" style={{ backgroundColor: '#25D366' }}>Agent</Badge>
                                                    ) : (
                                                        <Badge className="text-white" style={{ backgroundColor: '#0056B3' }}>Customer</Badge>
                                                    )}
                                                    <div className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                                </div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                                    <MoreVertical className="w-5 h-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => {
                                                    setAdjustmentDialogUser(user)
                                                    setAdjustmentType('credit')
                                                    setAdjustmentDescription('Admin manual credit')
                                                }}>
                                                    <Wallet className="w-4 h-4 mr-2" />
                                                    Credit Wallet
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                    setAdjustmentDialogUser(user)
                                                    setAdjustmentType('debit')
                                                    setAdjustmentDescription('Admin manual debit')
                                                }}>
                                                    <Wallet className="w-4 h-4 mr-2 text-red-500" />
                                                    Debit Wallet
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleStatusChange(user.id, user.status === 'suspended' ? 'active' : 'suspended')}
                                                >
                                                    {user.status === 'suspended' ? (
                                                        <>
                                                            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                                            Activate Account
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Ban className="w-4 h-4 mr-2 text-orange-500" />
                                                            Suspend Account
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                {/* Role Change Menu */}
                                                <DropdownMenuLabel className="text-xs text-muted-foreground pt-2">Change Role</DropdownMenuLabel>
                                                {user.role !== 'customer' && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'customer')}>
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#0056B3' }} />
                                                        Make Customer
                                                    </DropdownMenuItem>
                                                )}
                                                {user.role !== 'agent' && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'agent')}>
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#25D366' }} />
                                                        Make Agent
                                                    </DropdownMenuItem>
                                                )}
                                                {user.role !== 'sub-admin' && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'sub-admin')}>
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#FACC15' }} />
                                                        Make Sub-Admin
                                                    </DropdownMenuItem>
                                                )}
                                                {user.role !== 'admin' && (
                                                    <DropdownMenuItem onClick={() => handleRoleChange(user.id, 'admin')}>
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#E60000' }} />
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                )}

                                                <div className="h-px bg-border my-1" />

                                                <DropdownMenuItem
                                                    onClick={() => handleResetPassword(user.id, `${user.first_name} ${user.last_name}`.trim())}
                                                    className="text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                                                >
                                                    <KeyRound className="w-4 h-4 mr-2" />
                                                    Reset Password
                                                </DropdownMenuItem>

                                                <div className="h-px bg-border my-1" />

                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete User
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                <Mail className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <span className="truncate text-sm font-medium">{user.email}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Phone className="w-4 h-4 text-emerald-500" />
                                                </div>
                                                <span className="text-sm font-medium">{user.phone_number || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Calendar className="w-4 h-4 text-orange-500" />
                                                </div>
                                                <span className="text-sm font-medium">{formatDate(user.created_at).split(',')[0]}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Wallet Section */}
                                    <div className="pt-4 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-xs uppercase font-extrabold text-muted-foreground tracking-widest mb-1">Wallet Balance</span>
                                            <span className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500">
                                                {formatCurrency((Array.isArray(user.wallets) ? user.wallets[0]?.balance : user.wallets?.balance) || 0)}
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-10 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg transition-all"
                                            onClick={() => {
                                                setAdjustmentDialogUser(user)
                                                setAdjustmentType('credit')
                                                setAdjustmentDescription('Admin manual credit')
                                            }}
                                        >
                                            <Wallet className="w-4 h-4 mr-2" />
                                            Top up
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {hasMore && (
                        <div className="flex justify-center py-8">
                            <Button
                                onClick={loadMore}
                                disabled={loading}
                                variant="outline"
                                className="min-w-[200px] rounded-xl border-purple-200 hover:border-purple-500 hover:bg-purple-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Load More Users ({users.length} of {totalCount})
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Wallet Adjustment Dialog */}
            <Dialog open={!!adjustmentDialogUser} onOpenChange={() => setAdjustmentDialogUser(null)}>
                <DialogContent aria-describedby="adjustment-description">
                    <DialogHeader>
                        <DialogTitle>{adjustmentType === 'credit' ? 'Credit' : 'Debit'} User Wallet</DialogTitle>
                        <DialogDescription id="adjustment-description">
                            {adjustmentType === 'credit' ? 'Add funds to' : 'Deduct funds from'} {adjustmentDialogUser?.first_name} {adjustmentDialogUser?.last_name}'s wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Adjustment Type</Label>
                            <Select
                                value={adjustmentType}
                                onValueChange={(value: 'credit' | 'debit') => setAdjustmentType(value)}
                            >
                                <SelectTrigger id="adjustment-type" name="adjustment-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="credit">Credit (+)</SelectItem>
                                    <SelectItem value="debit">Debit (-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Amount (GHS)</Label>
                            <Input
                                id="adjustment-amount"
                                name="adjustment-amount"
                                type="number"
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                id="adjustment-description"
                                name="adjustment-description"
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjustmentDialogUser(null)}>Cancel</Button>
                        <Button
                            variant={adjustmentType === 'debit' ? 'destructive' : 'default'}
                            onClick={handleManualAdjustment}
                            disabled={isAdjusting}
                        >
                            {isAdjusting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {adjustmentType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
