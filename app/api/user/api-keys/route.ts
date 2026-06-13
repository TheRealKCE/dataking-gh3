import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

// GET  — return key metadata (prefix, status, last_used_at). Never the full key.
// POST — generate a new key. Returns the full key ONCE. Old key deleted first.
// DELETE — revoke the current key.

export async function GET() {
    try {
        const cookieStore = await cookies()
        const supabaseUser = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
        })
        const { data: { user }, error } = await supabaseUser.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { data: key } = await (supabase.from('api_keys') as any)
            .select('key_prefix, name, status, last_used_at, created_at, updated_at')
            .eq('user_id', user.id)
            .maybeSingle()

        return NextResponse.json({ success: true, key: key || null })
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUser = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
        })
        const { data: { user }, error } = await supabaseUser.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let name = 'My API Key'
        try {
            const body = await request.json()
            if (body?.name && typeof body.name === 'string') name = body.name.slice(0, 80)
        } catch { /* optional body */ }

        // Key format: kf_live_ + 32 hex chars = 40 chars total
        const randomPart = randomBytes(16).toString('hex')
        const fullKey = `kf_live_${randomPart}`
        const keyPrefix = fullKey.substring(0, 16)
        const keyHash = await bcrypt.hash(fullKey, 10)

        const supabase = createServerClient()

        // Admins and sub-admins get auto-approved — they don't need approval from themselves
        const { data: userData } = await (supabase.from('users') as any)
            .select('role')
            .eq('id', user.id)
            .single()
        const userRole = (userData as any)?.role ?? 'customer'
        const isAdmin = userRole === 'admin' || userRole === 'sub-admin'
        const keyStatus = isAdmin ? 'active' : 'pending'

        // Delete old key if exists (one key per user)
        await (supabase.from('api_keys') as any).delete().eq('user_id', user.id)

        const { error: insertError } = await (supabase.from('api_keys') as any).insert({
            user_id:    user.id,
            key_hash:   keyHash,
            key_prefix: keyPrefix,
            name,
            status:     keyStatus,
        })

        if (insertError) {
            console.error('[API Keys] Insert error:', insertError)
            return NextResponse.json({ error: 'Failed to generate key' }, { status: 500 })
        }

        const message = isAdmin
            ? 'API key generated. Copy the key now — it will not be shown again.'
            : 'API key generated. Copy the key now — it will not be shown again. Awaiting admin approval.'

        // Full key returned ONCE — never stored in plaintext
        return NextResponse.json({
            success: true,
            message,
            key: fullKey,
            prefix: keyPrefix,
            status: keyStatus,
        })
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies()
        const supabaseUser = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore,
        })
        const { data: { user }, error } = await supabaseUser.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        await (supabase.from('api_keys') as any).delete().eq('user_id', user.id)

        return NextResponse.json({ success: true, message: 'API key revoked' })
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
