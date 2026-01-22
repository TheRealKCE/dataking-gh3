'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Package
} from 'lucide-react'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

interface PackageFormData {
    network: typeof NETWORKS[number]
    size: string
    price: number
    cost_price: number
    description: string
    is_available: boolean
    sort_order: number
}

const defaultFormData: PackageFormData = {
    network: 'MTN',
    size: '',
    price: 0,
    cost_price: 0,
    description: '',
    is_available: true,
    sort_order: 0,
}

export default function AdminPackagesPage() {
    const [packages, setPackages] = useState<DataPackage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPackage, setEditingPackage] = useState<DataPackage | null>(null)
    const [formData, setFormData] = useState<PackageFormData>(defaultFormData)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchPackages()
    }, [])

    const fetchPackages = async () => {
        try {
            const { data, error } = await supabase
                .from('data_packages')
                .select('*')
                .order('network')
                .order('sort_order')

            if (error) throw error
            setPackages(data || [])
        } catch (error) {
            console.error('Error fetching packages:', error)
            toast.error('Failed to load packages')
        } finally {
            setIsLoading(false)
        }
    }

    const openCreateDialog = () => {
        setEditingPackage(null)
        setFormData(defaultFormData)
        setIsDialogOpen(true)
    }

    const openEditDialog = (pkg: DataPackage) => {
        setEditingPackage(pkg)
        setFormData({
            network: pkg.network,
            size: pkg.size,
            price: pkg.price,
            cost_price: (pkg as any).cost_price || 0,
            description: pkg.description || '',
            is_available: pkg.is_available,
            sort_order: pkg.sort_order,
        })
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.size || !formData.price) {
            toast.error('Please fill in all required fields')
            return
        }

        setIsSaving(true)
        try {
            if (editingPackage) {
                const { error } = await (supabase
                    .from('data_packages') as any)
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingPackage.id)

                if (error) throw error
                toast.success('Package updated successfully')
            } else {
                const { error } = await (supabase
                    .from('data_packages') as any)
                    .insert(formData)

                if (error) throw error
                toast.success('Package created successfully')
            }

            setIsDialogOpen(false)
            fetchPackages()
        } catch (error) {
            console.error('Error saving package:', error)
            toast.error('Failed to save package')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this package?')) return

        try {
            const { error } = await (supabase
                .from('data_packages') as any)
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Package deleted successfully')
            fetchPackages()
        } catch (error) {
            toast.error('Failed to delete package')
        }
    }

    const toggleAvailability = async (pkg: DataPackage) => {
        try {
            const { error } = await (supabase
                .from('data_packages') as any)
                .update({ is_available: !pkg.is_available })
                .eq('id', pkg.id)

            if (error) throw error
            setPackages(prev =>
                prev.map(p => p.id === pkg.id ? { ...p, is_available: !p.is_available } : p)
            )
        } catch (error) {
            toast.error('Failed to update package')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Data Packages</h1>
                    <p className="text-muted-foreground">Manage available data packages</p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Package
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Network</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {packages.map((pkg) => (
                                <TableRow key={pkg.id}>
                                    <TableCell>
                                        <Badge variant={pkg.network === 'MTN' ? 'mtn' : pkg.network === 'Telecel' ? 'telecel' : 'airteltigo'}>
                                            {pkg.network}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{pkg.size}</TableCell>
                                    <TableCell>{formatCurrency(pkg.price)}</TableCell>
                                    <TableCell className="max-w-xs truncate">{pkg.description}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={pkg.is_available}
                                            onCheckedChange={() => toggleAvailability(pkg)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => openEditDialog(pkg)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(pkg.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingPackage ? 'Edit Package' : 'Create Package'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPackage ? 'Update the package details' : 'Add a new data package'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Network</Label>
                                <Select
                                    value={formData.network}
                                    onValueChange={(value: typeof NETWORKS[number]) =>
                                        setFormData(prev => ({ ...prev, network: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {NETWORKS.map((network) => (
                                            <SelectItem key={network} value={network}>
                                                {network}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Size (e.g., 1GB, 5GB)</Label>
                                <Input
                                    value={formData.size}
                                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                                    placeholder="1GB"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Selling Price (GHS)</Label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cost Price (GHS)</Label>
                                <Input
                                    type="number"
                                    value={formData.cost_price}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Sort Order</Label>
                                <Input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Package description..."
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formData.is_available}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
                            />
                            <Label>Available for purchase</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {editingPackage ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
