'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    User,
    Mail,
    Phone,
    Calendar,
    Shield,
    LogOut,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Trash2,
    Crown
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'
import { roleConfig, UserRole } from '@/lib/roles'

export default function ProfilePage() {
    const { dbUser, signOut, refreshUser } = useAuth()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone_number: '',
    })

    // Calculate days remaining for agents
    const calculateDaysRemaining = () => {
        if (!dbUser?.agent_expires_at || dbUser?.role !== 'agent') return null
        const now = new Date()
        const expiresAt = new Date(dbUser.agent_expires_at)
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysRemaining > 0 ? daysRemaining : 0
    }

    const daysRemaining = calculateDaysRemaining()

    // Password change
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [passwordSaving, setPasswordSaving] = useState(false)

    // Delete account
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (dbUser) {
            setFormData({
                first_name: dbUser.first_name || '',
                last_name: dbUser.last_name || '',
                phone_number: dbUser.phone_number || '',
            })
        }
    }, [dbUser])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const { error } = await (supabase
                .from('users') as any)
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone_number: formData.phone_number,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', dbUser?.id as any)

            if (error) throw error

            await refreshUser()
            setIsEditing(false)
            toast.success('Profile updated successfully')
        } catch (error) {
            toast.error('Failed to update profile')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (passwordData.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }

        setPasswordSaving(true)
        try {
            // Verify current password by re-signing in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: dbUser?.email || '',
                password: passwordData.currentPassword,
            })

            if (signInError) {
                toast.error('Current password is incorrect')
                return
            }

            // Update password
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword,
            })

            if (error) throw error

            setIsChangingPassword(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
            toast.success('Password changed successfully')
        } catch (error) {
            toast.error('Failed to change password')
        } finally {
            setPasswordSaving(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            toast.error('Please enter your password to confirm')
            return
        }

        setIsDeleting(true)
        try {
            const response = await fetch('/api/users/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: deletePassword })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete account')
            }

            toast.success('Account deleted successfully. Redirecting...')

            // Wait briefly for toast to show, then redirect to login
            setTimeout(() => {
                window.location.href = '/auth/login'
            }, 1500)
        } catch (error: any) {
            console.error('Delete account error:', error)
            toast.error(error.message || 'Failed to delete account')
        } finally {
            setIsDeleting(false)
        }
    }

    const getInitials = () => {
        return `${dbUser?.first_name?.[0] || ''}${dbUser?.last_name?.[0] || ''}`.toUpperCase()
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <h1 className="text-2xl font-bold">My Profile</h1>

            {/* Profile Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        {(() => {
                            const userRole = (dbUser?.role || 'customer') as UserRole
                            const config = roleConfig[userRole] || roleConfig['customer']
                            const RoleIcon = config.icon
                            return (
                                <div
                                    className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white dark:ring-gray-800"
                                    style={{ backgroundColor: config.color }}
                                >
                                    <RoleIcon className="w-10 h-10" />
                                </div>
                            )
                        })()}
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2 flex-wrap">
                                {dbUser?.role === 'agent' && (
                                    <>
                                        <span className="relative flex items-center">
                                            {dbUser.last_name.slice(-1) && (
                                                <span className="relative">
                                                    {dbUser.last_name.slice(-1)}
                                                    <Crown className="absolute -top-4 -right-2.5 w-5 h-5 text-yellow-500 fill-yellow-500 -rotate-[15deg] drop-shadow-md" />
                                                </span>
                                            )}
                                        </span>
                                        {daysRemaining !== null && (
                                            <Badge className={cn(
                                                "font-bold text-xs ml-2",
                                                daysRemaining <= 3
                                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                                    : "bg-green-100 text-green-700 hover:bg-green-200"
                                            )}>
                                                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                            </Badge>
                                        )}
                                    </>
                                )}
                            </CardTitle>
                            <CardDescription>{dbUser?.email}</CardDescription>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant={dbUser?.role === 'admin' ? 'destructive' : 'secondary'}>
                                    {dbUser?.role || 'User'}
                                </Badge>
                                <Badge variant={dbUser?.status === 'active' ? 'completed' : 'failed'}>
                                    {dbUser?.status || 'Active'}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isEditing ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">First Name</Label>
                                    <Input
                                        id="first_name"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name">Last Name</Label>
                                    <Input
                                        id="last_name"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone_number">Phone Number</Label>
                                <Input
                                    id="phone_number"
                                    name="phone_number"
                                    value={formData.phone_number}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save Changes
                                </Button>
                                <Button variant="outline" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Full Name</p>
                                        <p className="font-medium flex items-center gap-2">
                                            {dbUser?.first_name} {dbUser?.last_name}
                                            {dbUser?.role === 'agent' && (
                                                <span className="relative ml-1">
                                                    <span className="opacity-0">{dbUser.last_name.slice(-1)}</span>
                                                    <Crown className="absolute -top-3 -right-2 w-4 h-4 text-yellow-500 fill-yellow-500 -rotate-[15deg] drop-shadow-sm" />
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <Mail className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-medium">{dbUser?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Phone Number</p>
                                        <p className="font-medium">{dbUser?.phone_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <Calendar className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Member Since</p>
                                        <p className="font-medium">{dbUser?.created_at ? formatDate(dbUser.created_at) : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Security Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Security
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isChangingPassword ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handlePasswordChange} disabled={passwordSaving}>
                                    {passwordSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Change Password
                                </Button>
                                <Button variant="outline" onClick={() => setIsChangingPassword(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
                            Change Password
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                    <CardDescription>
                        Irreversible and destructive actions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteDialogOpen(true)}
                            className="flex-1"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Account
                        </Button>
                        <Button
                            variant="outline"
                            onClick={signOut}
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Account Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Account Permanently?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove all your data including:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Your profile information</li>
                                <li>Order history</li>
                                <li>Transaction records</li>
                                <li>Wallet balance</li>
                                <li>All associated data</li>
                            </ul>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="deletePassword">Enter your password to confirm</Label>
                            <Input
                                id="deletePassword"
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Your password"
                                disabled={isDeleting}
                            />
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                            <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                                <AlertCircle className="w-4 h-4 inline mr-2" />
                                Warning: This action is permanent and cannot be reversed!
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteDialogOpen(false)
                                setDeletePassword('')
                            }}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={isDeleting || !deletePassword}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Delete My Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
