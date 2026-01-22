'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AFAOrdersPage() {
    const { dbUser } = useAuth()
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        ghana_card: '',
        location: '',
        region: 'Greater Accra',
        occupation: '',
        notes: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [applicationStatus, setApplicationStatus] = useState<string | null>(null)

    useEffect(() => {
        checkExistingApplication()
    }, [dbUser])

    const checkExistingApplication = async () => {
        if (!dbUser) return
        const { data } = await supabase
            .from('afa_orders')
            .select('status')
            .eq('user_id', dbUser.id)
            .single()

        if (data) {
            setApplicationStatus((data as any).status)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const { error } = await (supabase.from('afa_orders') as any).insert({
                user_id: dbUser?.id,
                ...formData,
                status: 'pending'
            })

            if (error) throw error

            toast.success('Application submitted successfully!')
            setApplicationStatus('pending')
        } catch (error) {
            toast.error('Failed to submit application')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (applicationStatus) {
        return (
            <div className="max-w-xl mx-auto py-12">
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>Application Status</CardTitle>
                        <CardDescription>
                            Your Authorized Field Agent application
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold capitalize">{applicationStatus}</h2>
                        <p className="text-muted-foreground">
                            {applicationStatus === 'pending'
                                ? 'Your application is currently under review by our team. We will contact you shortly.'
                                : applicationStatus === 'completed'
                                    ? 'Congratulations! You are now an authorized agent.'
                                    : 'Your application has been processed.'}
                        </p>
                        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Become an Agent</h1>
                <p className="text-muted-foreground mt-2">
                    Apply to become an Authorized Field Agent (AFA) and earn commissions
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Application Form</CardTitle>
                    <CardDescription>Please provide accurate details</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="024xxxxxxx"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Ghana Card Number</Label>
                            <Input
                                required
                                value={formData.ghana_card}
                                onChange={e => setFormData(p => ({ ...p, ghana_card: e.target.value }))}
                                placeholder="GHA-xxxxxxxxx-x"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Region</Label>
                                <Select
                                    value={formData.region}
                                    onValueChange={v => setFormData(p => ({ ...p, region: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Greater Accra">Greater Accra</SelectItem>
                                        <SelectItem value="Ashanti">Ashanti</SelectItem>
                                        <SelectItem value="Western">Western</SelectItem>
                                        <SelectItem value="Eastern">Eastern</SelectItem>
                                        <SelectItem value="Central">Central</SelectItem>
                                        <SelectItem value="Northern">Northern</SelectItem>
                                        <SelectItem value="Volta">Volta</SelectItem>
                                        {/* Add others as needed */}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>City/Town</Label>
                                <Input
                                    required
                                    value={formData.location}
                                    onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                    placeholder="Accra"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Occupation</Label>
                            <Input
                                required
                                value={formData.occupation}
                                onChange={e => setFormData(p => ({ ...p, occupation: e.target.value }))}
                                placeholder="Student, Trader, etc."
                            />
                        </div>

                        <Alert className="bg-blue-50 dark:bg-blue-900/10 border-blue-200">
                            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                                By submitting this form, you agree to our terms and conditions for agents.
                            </AlertDescription>
                        </Alert>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting Application...
                                </>
                            ) : (
                                'Submit Application'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
