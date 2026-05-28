import { Crown, ShieldCheck, BadgeCheck, UserCircle, Store, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'sub-admin' | 'agent' | 'dealer' | 'customer'

interface RoleConfigItem {
    icon: LucideIcon
    label: string
    rank: string
    color: string
    bgColor: string
    textColor: string
    gradient: string
    badgeClass: string
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
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    },
    'sub-admin': {
        icon: ShieldCheck,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        textColor: '#10B981',
        gradient: 'from-emerald-500 to-teal-700',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#0056B3',
        bgColor: 'rgba(0, 86, 179, 0.1)',
        textColor: '#0056B3',
        gradient: 'from-blue-600 to-sky-700',
        badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    },
    'dealer': {
        icon: Store,
        label: 'Dealer',
        rank: '#4',
        color: '#7C3AED',
        bgColor: 'rgba(124, 58, 237, 0.1)',
        textColor: '#7C3AED',
        gradient: 'from-violet-600 to-purple-700',
        badgeClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    },
    'customer': {
        icon: UserCircle,
        label: 'Customer',
        rank: '#5',
        color: '#EAB308',
        bgColor: 'rgba(234, 179, 8, 0.1)',
        textColor: '#CA8A04',
        gradient: 'from-yellow-400 to-yellow-600',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    }
}
