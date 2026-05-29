'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User as DBUser } from '@/types/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
    user: User | null
    dbUser: DBUser | null
    session: Session | null
    isLoading: boolean
    isAdmin: boolean
    isSubAdmin: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (data: SignUpData) => Promise<{ error: any, data: { user: User | null, session: Session | null } | null }>
    signOut: () => Promise<void>
    refreshUser: () => Promise<void>
}

interface SignUpData {
    email: string
    password: string
    firstName: string
    lastName: string
    phoneNumber: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [dbUser, setDbUser] = useState<DBUser | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastActivity, setLastActivity] = useState(Date.now())
    const router = useRouter()

    const isAdmin = dbUser?.role === 'admin'
    const isSubAdmin = dbUser?.role === 'sub-admin'

    const fetchDbUser = useCallback(async (userId: string) => {
        try {
            // Add 10 second timeout to prevent hanging (increased from 5s)
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database timeout')), 10000)
            )

            // Use explicit columns instead of SELECT * for better performance
            const query = supabase
                .from('users')
                .select(`
                    id,
                    email,
                    first_name,
                    last_name,
                    phone_number,
                    role,
                    status,
                    agent_expires_at,
                    dealer_claimed_at,
                    dealer_expires_at,
                    created_at,
                    updated_at
                `)
                .eq('id', userId)
                .single()

            const { data, error } = await Promise.race([
                query,
                timeout
            ]) as any

            if (error) {
                console.error('Error fetching user data:', error)
                // Don't block UI on error - continue with auth user only
                return
            }

            if (data) {
                setDbUser(data)
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
            // Don't block UI on error - continue with auth user only
        }
    }, [])

    // Auto-downgrade expired agents and dealers
    useEffect(() => {
        const checkAndDowngradeExpired = async () => {
            if (dbUser?.role === 'agent' && dbUser?.agent_expires_at) {
                const expiryDate = new Date(dbUser.agent_expires_at)
                const now = new Date()

                if (expiryDate < now) {
                    console.log('[AuthContext] Agent expired, auto-downgrading to customer')
                    try {
                        const response = await fetch('/api/agent/downgrade', {
                            method: 'POST'
                        })

                        if (response.ok) {
                            console.log('[AuthContext] Auto-downgrade successful')
                            await refreshUser()
                        } else {
                            console.error('[AuthContext] Auto-downgrade failed:', await response.text())
                        }
                    } catch (error) {
                        console.error('[AuthContext] Auto-downgrade error:', error)
                    }
                }
            }

            if (dbUser?.role === 'dealer' && (dbUser as any)?.dealer_expires_at) {
                const expiryDate = new Date((dbUser as any).dealer_expires_at)
                const now = new Date()

                if (expiryDate < now) {
                    console.log('[AuthContext] Dealer expired, auto-downgrading to customer')
                    try {
                        const response = await fetch('/api/user/dealer-downgrade', {
                            method: 'POST'
                        })

                        if (response.ok) {
                            console.log('[AuthContext] Dealer auto-downgrade successful')
                            await refreshUser()
                        } else {
                            console.error('[AuthContext] Dealer auto-downgrade failed:', await response.text())
                        }
                    } catch (error) {
                        console.error('[AuthContext] Dealer auto-downgrade error:', error)
                    }
                }
            }
        }

        checkAndDowngradeExpired()
    }, [dbUser?.role, dbUser?.agent_expires_at, (dbUser as any)?.dealer_expires_at])

    const refreshUser = useCallback(async () => {
        if (user) {
            // Refresh the JWT session first so the new role is reflected in the token
            await supabase.auth.refreshSession()
            await fetchDbUser(user.id)
        }
    }, [user, fetchDbUser])

    const signIn = async (email: string, password: string) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 10
            return { error: { message: `TOO_MANY_ATTEMPTS:${minutes}` } as Error }
        }

        const data = await response.json()

        if (!response.ok) {
            return { error: { message: data.error } as Error }
        }

        // Refresh the Supabase client session from the server-set cookie
        await supabase.auth.getSession()

        return { error: null }
    }

    const signUp = async (data: SignUpData) => {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 10
            return { error: { message: `TOO_MANY_ATTEMPTS:${minutes}` } as Error, data: null }
        }

        const responseData = await response.json()

        if (!response.ok) {
            return { error: { message: responseData.error, details: responseData.details }, data: null }
        }

        // Refresh the Supabase client session from the server-set cookie
        await supabase.auth.getSession()

        return { error: null, data: { user: responseData.user, session: responseData.session } }
    }

    const signOut = async () => {
        await supabase.auth.signOut({ scope: 'global' })
        setUser(null)
        setDbUser(null)
        setSession(null)
        router.push('/auth/login')
    }

    // Track user activity
    useEffect(() => {
        // Only track if user is logged in
        if (!user) return

        const updateActivity = () => {
            setLastActivity(Date.now())
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
        events.forEach(event => {
            window.addEventListener(event, updateActivity)
        })

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity)
            })
        }
    }, [user])

    // Auto logout on inactivity
    useEffect(() => {
        if (!user) return

        const checkInactivity = setInterval(() => {
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                console.log('User inactive for 30 minutes, redirecting to home...')
                // Sign out and redirect to home page
                supabase.auth.signOut()
                setUser(null)
                setDbUser(null)
                setSession(null)
                router.push('/')
            }
        }, 60000) // Check every minute

        return () => clearInterval(checkInactivity)
    }, [user, lastActivity])

    // Handle tab visibility and session stale check
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && user) {
                console.log('[Auth] Tab visible, checking session...')
                const { data: { session: currentSession }, error } = await supabase.auth.getSession()
                
                // If there's an error or the session is gone, or UID changed
                if (error || !currentSession || currentSession.user.id !== user.id) {
                    console.warn('[Auth] Session stale or missing, reloading...')
                    window.location.reload()
                } else {
                    setSession(currentSession)
                    setUser(currentSession.user)
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [user])

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search)
                const mockRole = params.get('mockRole')
                if (mockRole) {
                    const mockData = {
                        id: 'mock-id',
                        email: 'derrick@example.com',
                        first_name: 'Derrick',
                        last_name: 'Awuah',
                        phone_number: '0240000000',
                        role: mockRole as 'admin' | 'sub-admin' | 'agent' | 'dealer' | 'customer',
                        status: 'active' as 'active' | 'suspended' | 'inactive',
                        dealer_claimed_at: new Date().toISOString(),
                        dealer_expires_at: new Date(Date.now() + 531 * 24 * 60 * 60 * 1000).toISOString(),
                        agent_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    }
                    setSession({ user: mockData } as any)
                    setUser(mockData as any)
                    setDbUser(mockData)
                    setIsLoading(false)
                    return
                }
            }

            try {
                // Add 8 second total timeout for initialization
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout')), 8000)
                )

                const init = async () => {
                    const { data: { session } } = await supabase.auth.getSession()

                    if (session) {
                        setSession(session)
                        setUser(session.user)
                        await fetchDbUser(session.user.id)
                    }
                }

                await Promise.race([init(), timeout])
            } catch (error) {
                console.error('Auth initialization error:', error)
                // Continue anyway - allow user to proceed without full auth
            } finally {
                // ALWAYS set loading to false, even on error
                setIsLoading(false)
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mockRole')) {
                    return
                }
                setSession(session)
                setUser(session?.user ?? null)

                if (session?.user) {
                    await fetchDbUser(session.user.id)
                } else {
                    setDbUser(null)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [fetchDbUser])

    return (
        <AuthContext.Provider
            value={{
                user,
                dbUser,
                session,
                isLoading,
                isAdmin,
                isSubAdmin,
                signIn,
                signUp,
                signOut,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
