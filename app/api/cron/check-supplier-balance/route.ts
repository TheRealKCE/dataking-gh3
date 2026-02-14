import { NextRequest, NextResponse } from 'next/server'
import { fetchSupplierBalance } from '@/lib/mtn-fulfillment'
import { sendEmail } from '@/lib/email-service'
import { createRouteClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[Supplier Balance Check] Starting daily balance check...')

        // Fetch supplier balance from DataKazina
        const balanceResult = await fetchSupplierBalance()

        if (!balanceResult.success) {
            console.error('[Supplier Balance Check] Failed to fetch balance:', balanceResult.error)
            return NextResponse.json({
                error: balanceResult.error
            }, { status: 500 })
        }

        const balance = balanceResult.balance || 0
        const currency = balanceResult.currency || 'GHS'

        console.log(`[Supplier Balance Check] Current balance: ${currency} ${balance}`)

        // Check if balance is low (GHS 50 or less)
        if (balance <= 50) {
            console.log('[Supplier Balance Check] ⚠️ Low balance detected! Sending alerts...')

            // Get admin users
            const supabase = createRouteClient()
            const { data: admins } = await supabase
                .from('users')
                .select('id, email, phone_number, first_name, last_name')
                .eq('role', 'admin')

            if (admins && admins.length > 0) {
                let emailCount = 0

                for (const admin of admins) {
                    // Send Email alert only (SMS disabled to save CPU)
                    if (admin.email) {
                        try {
                            await sendEmail({
                                to: admin.email,
                                subject: `⚠️ Low Supplier Balance Alert - ${currency} ${balance.toFixed(2)}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                        <div style="background: linear-gradient(135deg, #E60000, #C50000); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
                                            <h1 style="margin: 0; font-size: 24px;">⚠️ Low Supplier Balance Alert</h1>
                                        </div>
                                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                                            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                                                Hello ${admin.first_name || 'Admin'},
                                            </p>
                                            <div style="background: white; padding: 20px; border-left: 4px solid #E60000; margin: 20px 0;">
                                                <h2 style="color: #E60000; margin-top: 0;">Urgent Action Required</h2>
                                                <p style="font-size: 18px; margin: 10px 0;">
                                                    Your DataKazina supplier balance is critically low:
                                                </p>
                                                <p style="font-size: 32px; font-weight: bold; color: #E60000; margin: 20px 0;">
                                                    ${currency} ${balance.toFixed(2)}
                                                </p>
                                            </div>
                                            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                                <p style="margin: 0; color: #856404;">
                                                    <strong>⚠️ Warning:</strong> Low balance may cause order fulfillment failures. 
                                                    Please top up your DataKazina account immediately to ensure uninterrupted service.
                                                </p>
                                            </div>
                                            <h3 style="color: #333; margin-top: 30px;">What to do:</h3>
                                            <ol style="color: #666; line-height: 1.8;">
                                                <li>Login to your DataKazina reseller account</li>
                                                <li>Top up your account balance</li>
                                                <li>Verify the new balance in your dashboard</li>
                                                <li>Monitor for the next 24 hours</li>
                                            </ol>
                                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                                                <p style="color: #999; font-size: 12px; margin: 0;">
                                                    This is an automated alert from your King Flexy Data system.<br/>
                                                    Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Accra' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                `
                            })
                            emailCount++
                            console.log(`[Supplier Balance Check] Email sent to ${admin.email}`)
                        } catch (error) {
                            console.error(`[Supplier Balance Check] Failed to send email to ${admin.email}:`, error)
                        }
                    }
                }

                return NextResponse.json({
                    success: true,
                    balance,
                    currency,
                    alertSent: true,
                    emailCount,
                    message: `Low balance email sent to ${emailCount} admin(s)`
                })
            } else {
                console.log('[Supplier Balance Check] No admin users found')
                return NextResponse.json({
                    success: true,
                    balance,
                    currency,
                    alertSent: false,
                    message: 'Low balance but no admins to alert'
                })
            }
        } else {
            // Balance is okay
            console.log('[Supplier Balance Check] ✓ Balance is healthy')
            return NextResponse.json({
                success: true,
                balance,
                currency,
                alertSent: false,
                message: 'Balance is healthy'
            })
        }

    } catch (error: any) {
        console.error('[Supplier Balance Check] Error:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 })
    }
}
