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
    sidebarBg: string
    sidebarNavHover: string
    sidebarNavActive: string
    headerBg: string
    headerText: string
    headerSubText: string
    headerButton: string
    greetingCard: string
    greetingRow: string
    greetingText: string
    greetingPill: string
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
        sidebarBg: "bg-card/80 backdrop-blur-xl border-r border-border/50 text-slate-800 dark:text-slate-100",
        sidebarNavHover: "text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-500/5",
        sidebarNavActive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold",
        headerBg: "bg-card/85 backdrop-blur-xl border-b border-border/60 text-slate-800 dark:text-slate-100",
        headerText: "text-slate-800 dark:text-slate-100",
        headerSubText: "text-slate-500 dark:text-slate-400",
        headerButton: "text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/5",
        greetingCard: "rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/70 bg-card shadow-sm hover:shadow-md transition-all overflow-hidden relative",
        greetingRow: "bg-secondary/35 border border-border/60 text-foreground",
        greetingText: "text-muted-foreground",
        greetingPill: "bg-rose-500/15 text-rose-500"
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
        sidebarBg: "bg-card/80 backdrop-blur-xl border-r border-border/50 text-slate-800 dark:text-slate-100",
        sidebarNavHover: "text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/5",
        sidebarNavActive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold",
        headerBg: "bg-card/85 backdrop-blur-xl border-b border-border/60 text-slate-800 dark:text-slate-100",
        headerText: "text-slate-800 dark:text-slate-100",
        headerSubText: "text-slate-500 dark:text-slate-400",
        headerButton: "text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/5",
        greetingCard: "rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border/70 bg-card shadow-sm hover:shadow-md transition-all overflow-hidden relative",
        greetingRow: "bg-secondary/35 border border-border/60 text-foreground",
        greetingText: "text-muted-foreground",
        greetingPill: "bg-emerald-500/15 text-emerald-500"
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
        sidebarBg: "bg-gradient-to-b from-blue-50/90 to-sky-100/50 dark:from-slate-950 dark:to-blue-950/20 border-r border-r-blue-200/50 dark:border-r-blue-900/50 text-slate-800 dark:text-slate-100 backdrop-blur-xl",
        sidebarNavHover: "text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/5",
        sidebarNavActive: "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold",
        headerBg: "bg-blue-50/90 dark:bg-slate-900/80 border-b border-blue-200/60 dark:border-b-blue-900/60 text-slate-800 dark:text-slate-100 backdrop-blur-xl",
        headerText: "text-slate-800 dark:text-slate-100",
        headerSubText: "text-slate-500 dark:text-slate-400",
        headerButton: "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/5",
        greetingCard: "rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-lg relative overflow-hidden",
        greetingRow: "bg-black/10 text-white/95 border border-white/5",
        greetingText: "text-white/85",
        greetingPill: "bg-white/20 text-white border border-white/30"
    },
    'dealer': {
        icon: Store,
        label: 'Dealer',
        rank: '#4',
        color: '#7C3AED',
        bgColor: 'rgba(124, 58, 237, 0.1)',
        textColor: '#7C3AED',
        gradient: 'from-purple-600 to-indigo-700',
        badgeClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
        sidebarBg: "bg-gradient-to-b from-[#6b21a8] to-[#4c1d95] text-purple-100 border-r border-r-purple-700/30 backdrop-blur-xl shadow-premium",
        sidebarNavHover: "text-purple-200/80 hover:text-white hover:bg-white/10",
        sidebarNavActive: "bg-white/15 text-white font-bold",
        headerBg: "bg-gradient-to-r from-purple-800 to-indigo-900 text-white border-b border-purple-700/30 backdrop-blur-xl",
        headerText: "text-white",
        headerSubText: "text-purple-200/80",
        headerButton: "text-purple-200 hover:text-white hover:bg-white/10",
        greetingCard: "rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-purple-600 to-indigo-800 text-white border-0 shadow-lg relative overflow-hidden",
        greetingRow: "bg-black/25 text-white/95 border border-white/10",
        greetingText: "text-purple-200/90",
        greetingPill: "bg-white/20 text-white border border-white/30"
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
        sidebarBg: "bg-gradient-to-b from-yellow-50/90 to-amber-100/50 dark:from-slate-950 dark:to-yellow-950/20 border-r border-r-yellow-200/50 dark:border-r-yellow-900/50 text-slate-800 dark:text-slate-100 backdrop-blur-xl",
        sidebarNavHover: "text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/5",
        sidebarNavActive: "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold",
        headerBg: "bg-yellow-50/90 dark:bg-slate-900/80 border-b border-yellow-200/60 dark:border-b-yellow-900/60 text-slate-800 dark:text-slate-100 backdrop-blur-xl",
        headerText: "text-slate-800 dark:text-slate-100",
        headerSubText: "text-slate-500 dark:text-slate-400",
        headerButton: "text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/5",
        greetingCard: "rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-amber-500 to-yellow-600 text-white border-0 shadow-lg relative overflow-hidden",
        greetingRow: "bg-black/10 text-white/95 border border-white/5",
        greetingText: "text-white/85",
        greetingPill: "bg-white/20 text-white border border-white/30"
    }
}
