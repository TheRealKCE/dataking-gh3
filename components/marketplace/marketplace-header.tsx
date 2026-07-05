'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { LogOut, User as UserIcon, Store, MessageSquare, Heart, Zap } from 'lucide-react'

export function MarketplaceHeader() {
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

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

    return (
        <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-50">
            <div className="container h-16 flex items-center justify-between">
                {/* Logo */}
                <Link
                    href="/marketplace-domain"
                    className="text-xl font-bold text-primary hover:text-primary/80 transition-colors"
                >
                    Arhms
                </Link>

                {/* Navigation */}
                <nav className="hidden sm:flex items-center gap-1">
                    <Link href="/marketplace-domain/browse">
                        <Button
                            variant={isActive('/marketplace-domain/browse') ? 'default' : 'ghost'}
                            size="sm"
                        >
                            Browse
                        </Button>
                    </Link>
                    <Link href="/marketplace-domain/categories">
                        <Button
                            variant={isActive('/marketplace-domain/categories') ? 'default' : 'ghost'}
                            size="sm"
                        >
                            Categories
                        </Button>
                    </Link>
                    {user && (
                        <Link href="/marketplace-domain/sell">
                            <Button
                                variant={isActive('/marketplace-domain/sell') ? 'default' : 'ghost'}
                                size="sm"
                            >
                                Sell
                            </Button>
                        </Link>
                    )}
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-2">
                    {!loading && user ? (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="Favorites"
                            >
                                <Link href="/marketplace-domain/favorites">
                                    <Heart className="w-5 h-5" />
                                </Link>
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="Messages"
                            >
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
                                            <Store className="w-4 h-4 mr-2" />
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
                            <Button variant="ghost" asChild size="sm">
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
