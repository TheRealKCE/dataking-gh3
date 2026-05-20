import { RCVoucher } from '@/lib/vouchers/checkout'
import { sendEmail } from '@/lib/email-service'
import { sendSMS } from '@/lib/sms-service'

function generatePremiumTemplate(title: string, content: string, themeColor: string) {
    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${themeColor}; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">${title}</h2>
        </div>
        <div style="padding: 20px;">
            ${content}
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            &copy; 2026 ARHMSGh. All rights reserved.
        </div>
    </div>
    `
}

export async function deliverVouchers(order: Record<string, any>, vouchers: RCVoucher[]): Promise<void> {
    const promises: Promise<any>[] = []

    if (order.customer_email) {
        promises.push(sendVoucherEmail(order.customer_email, order, vouchers))
    }

    if (order.customer_phone) {
        promises.push(sendVoucherSMS(order.customer_phone, order, vouchers))
    }

    await Promise.allSettled(promises)
}

async function sendVoucherEmail(email: string, order: Record<string, any>, vouchers: RCVoucher[]): Promise<void> {
    const typeName = order.type_name || 'Vouchers'
    const customerName = order.customer_name || 'Customer'

    let rowsHtml = ''
    vouchers.forEach((v, idx) => {
        rowsHtml += `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; letter-spacing: 1px;">${v.pin}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${v.serial_number}</td>
        </tr>`
    })

    const htmlContent = `
    <h1 style="color: #1a1a2e; margin-bottom: 10px;">Your Vouchers Are Ready!</h1>
    <p style="color: #4b5563;">Hi ${customerName}, your ${typeName} vouchers are attached below. Keep this email safe.</p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="padding: 10px; text-align: left; color: #64748b;">#</th>
                <th style="padding: 10px; text-align: left; color: #64748b;">PIN</th>
                <th style="padding: 10px; text-align: left; color: #64748b;">Serial Number</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <p style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px; color: #065f46;">
        <strong>Instructions:</strong> Please visit the official portal for ${typeName} to use your PIN and print your results.
    </p>
    `

    const wrappedHtml = generatePremiumTemplate(`Your ${typeName} Vouchers`, htmlContent, '#10b981')
    
    await sendEmail({
        to: email,
        toName: customerName,
        subject: `Your ${typeName} Vouchers`,
        htmlContent: wrappedHtml
    })
}

async function sendVoucherSMS(phone: string, order: Record<string, any>, vouchers: RCVoucher[]): Promise<void> {
    const typeName = order.type_name || 'Voucher'
    let message = ''

    if (vouchers.length === 1) {
        message = `Your ${typeName} PIN is ready!
PIN: ${vouchers[0].pin}
Serial: ${vouchers[0].serial_number}

Thank you for using ARHMSGh.`
    } else {
        message = `Your ${vouchers.length}x ${typeName} vouchers:\n\n`
        vouchers.forEach(v => {
            message += `PIN: ${v.pin}\nSerial: ${v.serial_number}\n\n`
        })
        message += `Thank you for using ARHMSGh.`
    }

    await sendSMS({
        recipient: phone,
        message
    })
}
