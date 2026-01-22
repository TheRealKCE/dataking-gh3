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
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (data: SignUpData) => Promise<{ error: Error | null }>
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

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [dbUser, setDbUser] = useState<DBUser | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastActivity, setLastActivity] = useState(Date.now())
    const router = useRouter()

    const isAdmin = dbUser?.role === 'admin'

    const fetchDbUser = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()

        if (!error && data) {
            setDbUser(data)
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

        if (authError) return { error: authError }

        return { error: null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setDbUser(null)
        setSession(null)
        router.push('/auth/login')
    }

    // Track user activity
    useEffect(() => {
        const updateActivity = () => setLastActivity(Date.now())

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
        events.forEach(event => {
            window.addEventListener(event, updateActivity)
        })

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity)
            })
        }
    }, [])

    // Auto logout on inactivity
    useEffect(() => {
        if (!user) return

        const checkInactivity = setInterval(() => {
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                signOut()
            }
        }, 60000) // Check every minute

        return () => clearInterval(checkInactivity)
    }, [user, lastActivity])

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (session) {
                setSession(session)
                setUser(session.user)
                await fetchDbUser(session.user.id)
            }

            setIsLoading(false)
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
