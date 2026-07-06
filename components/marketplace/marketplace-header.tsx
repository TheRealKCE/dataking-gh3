'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
    LogOut,
    User as UserIcon,
    Store,
    MessageSquare,
    Heart,
    Zap,
    Search,
    Menu,
    Tag,
} from 'lucide-react'

const NAV_LINKS = [
    { href: '/marketplace-domain/browse', label: 'Browse' },
    { href: '/marketplace-domain/categories', label: 'Categories' },
]

export function MarketplaceHeader() {
    const pathname = usePathname()
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const supabase = createBrowserClient()

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }

        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription?.unsubscribe()
    }, [])

    const handleLogout = async () => {
        const supabase = createBrowserClient()
        await supabase.auth.signOut()
        setUser(null)
        window.location.href = '/marketplace-domain'
    }

    const isActive = (href: string) => pathname === href

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault()
        const q = query.trim()
        setMobileOpen(false)
        router.push(q ? `/marketplace-domain/browse?q=${encodeURIComponent(q)}` : '/marketplace-domain/browse')
    }

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
            <div className="container h-16 flex items-center gap-3">
                {/* Mobile menu trigger */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
                            <Menu className="w-5 h-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72">
                        <SheetHeader>
                            <SheetTitle className="text-left">
                                <span className="font-heading font-extrabold text-lg">
                                    Arhms<span className="text-primary">Market</span>
                                </span>
                            </SheetTitle>
                        </SheetHeader>
                        <form onSubmit={submitSearch} className="mt-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search listings..."
                                className="pl-9"
                            />
                        </form>
                        <nav className="mt-6 flex flex-col gap-1">
                            {NAV_LINKS.map((link) => (
                                <SheetClose asChild key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </SheetClose>
                            ))}
                            {user && (
                                <SheetClose asChild>
                                    <Link
                                        href="/marketplace-domain/sell"
                                        className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        Sell an Item
                                    </Link>
                                </SheetClose>
                            )}
                        </nav>
                    </SheetContent>
                </Sheet>

                {/* Logo */}
                <Link
                    href="/marketplace-domain"
                    className="flex items-center gap-2 shrink-0"
                >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <Store className="w-5 h-5" />
                    </span>
                    <span className="font-heading text-lg font-extrabold tracking-tight">
                        Arhms<span className="text-primary">Market</span>
                    </span>
                </Link>

                {/* Desktop search */}
                <form onSubmit={submitSearch} className="hidden md:block flex-1 max-w-md mx-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search listings..."
                        className="pl-9 bg-muted/50 focus-visible:bg-background"
                    />
                </form>

                {/* Desktop nav */}
                <nav className="hidden sm:flex items-center gap-1 md:ml-auto">
                    {NAV_LINKS.map((link) => (
                        <Link href={link.href} key={link.href}>
                            <Button variant={isActive(link.href) ? 'default' : 'ghost'} size="sm">
                                {link.label}
                            </Button>
                        </Link>
                    ))}
                    {user && (
                        <Link href="/marketplace-domain/sell">
                            <Button variant={isActive('/marketplace-domain/sell') ? 'default' : 'ghost'} size="sm">
                                Sell
                            </Button>
                        </Link>
                    )}
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-1 ml-auto sm:ml-0">
                    {!loading && user ? (
                        <>
                            <Button variant="ghost" size="icon" asChild title="Favorites">
                                <Link href="/marketplace-domain/favorites">
                                    <Heart className="w-5 h-5" />
                                </Link>
                            </Button>

                            <Button variant="ghost" size="icon" asChild title="Messages">
                                <Link href="/marketplace-domain/messages">
                                    <MessageSquare className="w-5 h-5" />
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <UserIcon className="w-5 h-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                        {user.email}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/marketplace-domain/orders">
                                            <Store className="w-4 h-4 mr-2" />
                                            My Orders
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/marketplace-domain/my-listings">
                                            <Tag className="w-4 h-4 mr-2" />
                                            My Listings
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/marketplace-domain/promotions">
                                            <Zap className="w-4 h-4 mr-2" />
                                            My Promotions
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/marketplace-domain/settings">
                                            <UserIcon className="w-4 h-4 mr-2" />
                                            Profile Settings
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout}>
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : !loading ? (
                        <>
                            <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex">
                                <Link href="/auth/login?redirect=/marketplace-domain/sell">
                                    Login
                                </Link>
                            </Button>
                            <Button asChild size="sm">
                                <Link href="/auth/signup?redirect=/marketplace-domain/sell">
                                    Sign Up
                                </Link>
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
