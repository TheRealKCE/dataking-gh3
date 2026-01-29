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
    User,
    Mail,
    Phone,
    Calendar,
    Shield,
    LogOut,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
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

    // Password change
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [passwordSaving, setPasswordSaving] = useState(false)

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
                            <CardTitle className="text-xl">
                                {dbUser?.first_name} {dbUser?.last_name}
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
                                        <p className="font-medium">{dbUser?.first_name} {dbUser?.last_name}</p>
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
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" onClick={signOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
