import { Crown, Star, BadgeCheck, UserCircle, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'sub-admin' | 'agent' | 'customer'

interface RoleConfigItem {
    icon: LucideIcon
    label: string
    rank: string
    color: string
    bgColor: string
    textColor: string
}

export const roleConfig: Record<UserRole, RoleConfigItem> = {
    'admin': {
        icon: Crown,
        label: 'Admin',
        rank: '#1',
        color: '#E60000',
        bgColor: 'rgba(230, 0, 0, 0.1)',
        textColor: '#E60000'
    },
    'sub-admin': {
        icon: Star,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#FACC15',
        bgColor: 'rgba(250, 204, 21, 0.15)',
        textColor: '#B59410'
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#25D366',
        bgColor: 'rgba(37, 211, 102, 0.1)',
        textColor: '#25D366'
    },
    'customer': {
        icon: UserCircle,
        label: 'Customer',
        rank: '#4',
        color: '#0056B3',
        bgColor: 'rgba(0, 86, 179, 0.1)',
        textColor: '#0056B3'
    }
}
