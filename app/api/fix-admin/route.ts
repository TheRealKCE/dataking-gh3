import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const supabase = createServerClient()

    // Get current user
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email

    try {
        // Force update the user to admin
        const { error } = await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', userId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: `User ${userEmail} is now an ADMIM. Please logout and login again for changes to take full effect in the UI.`
        })
    } catch (err) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
