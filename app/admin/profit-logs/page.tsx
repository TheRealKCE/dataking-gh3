import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProfitLogsClient from './ProfitLogsClient'

export const dynamic = 'force-dynamic'

export default async function AdminProfitLogsPage() {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) redirect('/admin/login')

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    // STRICTLY BLOCK SUB-ADMINS
    if (userData?.role !== 'admin') {
        redirect('/admin')
    }

    return <ProfitLogsClient />
}
