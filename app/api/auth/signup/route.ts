import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nameSchema, phoneSchema, emailSchema } from '@/lib/validation'
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email-service'
import { sendWelcomeSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const signupSchema = z.object({
      email: emailSchema,
      password: z.string().min(8, 'Password must be at least 8 characters'),
      firstName: nameSchema,
      lastName: nameSchema,
      phoneNumber: phoneSchema
    })

    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      const errorDetails = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      return NextResponse.json({ error: 'Invalid input', details: errorDetails }, { status: 400 })
    }

    const { email, password, firstName, lastName, phoneNumber } = validation.data

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
      cookies: () => cookieStore
    })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    sendWelcomeEmail(email, firstName)
      .catch(err => console.error('[Signup] Welcome email failed:', err))

    sendWelcomeSMS(phoneNumber, firstName)
      .catch(err => console.error('[Signup] Welcome SMS failed:', err))

    sendAdminNewUserAlert({
      firstName,
      lastName,
      email,
      phoneNumber
    }).catch(err => console.error('[Signup] Admin new user alert failed:', err))

    return NextResponse.json({ user: data.user, session: data.session })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
