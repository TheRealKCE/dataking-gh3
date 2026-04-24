import { Crown, ShieldCheck, BadgeCheck, UserCircle, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'sub-admin' | 'agent' | 'customer'

interface RoleConfigItem {
    icon: LucideIcon
    label: string
    rank: string
    color: string
    bgColor: string
    textColor: string
    gradient: string
}

export const roleConfig: Record<UserRole, RoleConfigItem> = {
    'admin': {
        icon: Crown,
        label: 'Admin',
        rank: '#1',
        color: '#E60000',
        bgColor: 'rgba(230, 0, 0, 0.1)',
        textColor: '#E60000',
        gradient: 'from-rose-700 to-red-900',
    },
    'sub-admin': {
        icon: ShieldCheck,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#6366F1',
        bgColor: 'rgba(99, 102, 241, 0.15)',
        textColor: '#6366F1',
        gradient: 'from-indigo-600 to-slate-700',
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        textColor: '#10B981',
        gradient: 'from-emerald-500 to-teal-700',
    },
    'customer': {
        icon: UserCircle,
        label: 'Customer',
        rank: '#4',
        color: '#0056B3',
        bgColor: 'rgba(0, 86, 179, 0.1)',
        textColor: '#0056B3',
        gradient: 'from-blue-600 to-sky-700',
    }
}
