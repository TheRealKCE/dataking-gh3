import { createServerComponentClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProfitLogsClient from './ProfitLogsClient'

export const dynamic = 'force-dynamic'

export default async function AdminProfitLogsPage() {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) redirect('/admin/login')

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

    // STRICTLY BLOCK SUB-ADMINS
    if (userData?.role !== 'admin') {
        redirect('/admin')
    }

    return <ProfitLogsClient />
}
