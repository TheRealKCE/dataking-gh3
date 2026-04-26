import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Create admin client with service role key to bypass RLS for public read
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Fetch public general settings
        const { data, error } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'guest_storefront_url',
                'whatsapp_group_link', 
                'whatsapp_channel_link', 
                'whatsapp_admin_number', 
                'whatsapp_community_link',
                'support_email',
                'footer_copyright_text',
                'footer_branding_text'
            ])

        if (error) {
            console.error('Error fetching public config:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const guestStorefrontUrl = data?.find(s => s.key === 'guest_storefront_url')?.value || `${process.env.NEXT_PUBLIC_APP_URL || ''}/shop/demo`
        const whatsappGroupLink = data?.find(s => s.key === 'whatsapp_group_link')?.value || ''
        const whatsappChannelLink = data?.find(s => s.key === 'whatsapp_channel_link')?.value || ''
        const whatsappAdminNumber = data?.find(s => s.key === 'whatsapp_admin_number')?.value || ''
        const whatsappCommunityLink = data?.find(s => s.key === 'whatsapp_community_link')?.value || ''
        const supportEmail = data?.find(s => s.key === 'support_email')?.value || ''
        const footerCopyrightText = data?.find(s => s.key === 'footer_copyright_text')?.value || '2025 ARHMS DATA LIMITED'
        const footerBrandingText = data?.find(s => s.key === 'footer_branding_text')?.value || 'ARHMS'

        return NextResponse.json({ 
            guestStorefrontUrl,
            whatsappGroupLink,
            whatsappChannelLink,
            whatsappAdminNumber,
            whatsappCommunityLink,
            supportEmail,
            footerCopyrightText,
            footerBrandingText
        })

    } catch (error: any) {
        console.error('Error in public config API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
