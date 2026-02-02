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
    signUp: (data: SignUpData) => Promise<{ error: Error | null, data: { user: User | null, session: Session | null } | null }>
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

const INACTIVITY_TIMEOUT = 60 * 60 * 1000 // 1 hour (60 minutes)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [dbUser, setDbUser] = useState<DBUser | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastActivity, setLastActivity] = useState(Date.now())
    const router = useRouter()

    const isAdmin = dbUser?.role === 'admin'
    const isSubAdmin = dbUser?.role === 'sub-admin'

    // Browser close / Background detection
    useEffect(() => {
        // Mark session as active in sessionStorage (cleared when browser closes)
        if (typeof window !== 'undefined') {
            const isSessionActive = sessionStorage.getItem('is_session_active')

            // If we have a user in localStorage (Supabase default) but no flag in sessionStorage,
            // it means the browser was closed and reopened -> Force Logout
            if (!isSessionActive) {
                const clearAuth = async () => {
                    await supabase.auth.signOut()
                    setUser(null)
                    setDbUser(null)
                    setSession(null)
                    router.push('/')
                }
                clearAuth()
            }

            // Set the flag for this current session
            sessionStorage.setItem('is_session_active', 'true')
        }
    }, [router])

    const fetchDbUser = useCallback(async (userId: string) => {
        try {
            // Add 5 second timeout to prevent hanging
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database timeout')), 5000)
            )

            const query = supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            const { data, error } = await Promise.race([
                query,
                timeout
            ]) as any

            if (!error && data) {
                setDbUser(data)
            }
        } catch (error) {
            console.error('Error fetching user data:', error)
            // Don't block UI on error - continue with auth user only
        }
    }, [])

    const refreshUser = useCallback(async () => {
        if (user) {
            await fetchDbUser(user.id)
        }
    }, [user, fetchDbUser])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        // Set session active flag on login
        if (!error && typeof window !== 'undefined') {
            sessionStorage.setItem('is_session_active', 'true')
        }

        return { error }
    }

    const signUp = async (data: SignUpData) => {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    phone_number: data.phoneNumber,
                },
            },
        })

        if (authError) return { error: authError, data: null }

        return { error: null, data: authData }
    }

    const signOut = async () => {
        await supabase.auth.signOut()

        // Clear session flags
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('is_session_active')

            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('announcement_seen_')) {
                    sessionStorage.removeItem(key)
                }
            })
        }

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
            // Also keep session alive in storage
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('is_session_active', 'true')
            }
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
                console.log('User inactive for 1 hour, redirecting to home...')
                // Sign out and redirect to home page
                supabase.auth.signOut()
                setUser(null)
                setDbUser(null)
                setSession(null)
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('is_session_active')
                }
                router.push('/')
            }
        }, 60000) // Check every minute

        return () => clearInterval(checkInactivity)
    }, [user, lastActivity])

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
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
