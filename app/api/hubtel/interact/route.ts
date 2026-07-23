import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { initiatePayment, HUBTEL_CHANNEL_MAP } from '@/lib/hubtel-payment-service';

// Use a service role client to bypass RLS for USSD interactions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { Mobile, SessionId, Type: RequestType, Message, Operator } = body;

        if (!SessionId || !Mobile) {
            return NextResponse.json({
                Type: 'Release',
                Message: 'Invalid USSD request. Missing session data.'
            });
        }

        // 1. Fetch or create session
        let { data: session, error: sessionError } = await supabaseAdmin
            .from('hubtel_sessions')
            .select('*')
            .eq('session_id', SessionId)
            .single();

        if (sessionError && sessionError.code !== 'PGRST116') {
            console.error('[Hubtel Interact] Session fetch error:', sessionError);
            return NextResponse.json({ Type: 'Release', Message: 'System error. Please try again.' });
        }

        if (!session || RequestType === 'initiation') {
            // New session
            const newSession = {
                session_id: SessionId,
                mobile: Mobile,
                current_step: 'initiation',
                data: { operator: Operator || 'mtn' }
            };
            
            const { error: insertError } = await supabaseAdmin
                .from('hubtel_sessions')
                .upsert(newSession);

            if (insertError) {
                console.error('[Hubtel Interact] Session create error:', insertError);
                return NextResponse.json({ Type: 'Release', Message: 'System error. Please try again later.' });
            }
            
            session = newSession;
        }

        // 2. State Machine processing
        let currentStep = session.current_step;
        let sessionData = session.data || {};
        let responseMessage = '';
        let responseType = 'Response';
        let nextStep = currentStep;

        const userInput = Message?.trim();

        // If user typed 0 at any point (except initiation), we can treat it as 'Back' or 'Exit'
        if (RequestType !== 'initiation' && userInput === '0') {
             if (currentStep === 'choose_action') {
                 responseType = 'Release';
                 responseMessage = 'Thank you for using ARHMS. Goodbye.';
                 return updateAndRespond(SessionId, nextStep, sessionData, responseType, responseMessage);
             } else {
                 // Simple global "Back to Main Menu" behavior for '0'
                 currentStep = 'initiation';
             }
        }

        switch (currentStep) {
            case 'initiation':
                responseMessage = "Welcome to ARHMS TECHNOLOGIES\n1. Buy Result Checker\n0. Exit";
                nextStep = 'choose_action';
                break;

            case 'choose_action':
                if (userInput === '1') {
                    // Fetch active result checkers
                    const { data: activeTypes, error: typesError } = await supabaseAdmin
                        .from('results_checker_types')
                        .select('id, name, customer_price')
                        .eq('is_active', true)
                        .order('display_order', { ascending: true });

                    if (typesError || !activeTypes || activeTypes.length === 0) {
                        responseMessage = "Result checkers are currently unavailable. Please try again later.";
                        responseType = 'Release';
                        break;
                    }

                    // Store types in session to map selection later
                    sessionData.availableCheckers = activeTypes;
                    
                    responseMessage = "Select Checker Type:\n";
                    activeTypes.forEach((type, index) => {
                        responseMessage += `${index + 1}. ${type.name}\n`;
                    });
                    responseMessage += "0. Back";
                    
                    nextStep = 'select_checker_type';
                } else {
                    responseMessage = "Invalid input.\n1. Buy Result Checker\n0. Exit";
                    nextStep = 'choose_action';
                }
                break;

            case 'select_checker_type': {
                const selectionIndex = parseInt(userInput) - 1;
                const availableCheckers = sessionData.availableCheckers || [];

                if (!isNaN(selectionIndex) && selectionIndex >= 0 && selectionIndex < availableCheckers.length) {
                    const selectedChecker = availableCheckers[selectionIndex];
                    sessionData.selectedCheckerId = selectedChecker.id;
                    sessionData.selectedCheckerName = selectedChecker.name;
                    sessionData.selectedCheckerPrice = selectedChecker.customer_price;

                    responseMessage = "Enter recipient number (for SMS delivery):\n(leave blank/send 1 to use your current number)";
                    nextStep = 'enter_phone';
                } else {
                    responseMessage = "Invalid selection.\nSelect Checker Type:\n";
                    availableCheckers.forEach((type: any, index: number) => {
                        responseMessage += `${index + 1}. ${type.name}\n`;
                    });
                    responseMessage += "0. Back";
                    nextStep = 'select_checker_type';
                }
                break;
            }

            case 'enter_phone':
                // Clean phone number input
                let recipientMobile = userInput;
                if (!recipientMobile || recipientMobile === '1' || recipientMobile.trim() === '') {
                    recipientMobile = Mobile;
                }
                sessionData.recipientMobile = recipientMobile;

                responseMessage = `Confirm Order:\n${sessionData.selectedCheckerName} x1\nCost: GHS ${sessionData.selectedCheckerPrice}\nTo: ${sessionData.recipientMobile}\n\n1. Confirm & Pay\n0. Cancel`;
                nextStep = 'confirm';
                break;

            case 'confirm': {
                if (userInput === '1') {
                    // Map USSD operator to Hubtel channel name
                    const ussdOperatorMap: Record<string, string> = {
                        'mtn': 'mtn-gh',
                        'vodafone': 'vodafone-gh',
                        'telecel': 'vodafone-gh',
                        'tigo': 'tigo-gh',
                        'airteltigo': 'tigo-gh',
                        'airtel': 'tigo-gh',
                    }
                    const operator = (sessionData.operator || 'mtn').toLowerCase()
                    const channel = ussdOperatorMap[operator] || HUBTEL_CHANNEL_MAP['MTN']
                    const clientReference = `USSD-RC-${SessionId}`
                    // UAT: charge a tiny test amount (default 0.01) while keeping the
                    // real menu and prices on screen. Production leaves this flag off.
                    const uatMode = process.env.USSD_UAT_MODE === 'true'
                    const amount = uatMode
                        ? parseFloat(process.env.USSD_UAT_AMOUNT || '0.01')
                        : parseFloat(sessionData.selectedCheckerPrice || '0')

                    const paymentResult = await initiatePayment({
                        amount,
                        payerPhone: Mobile,
                        channel,
                        clientReference,
                        description: `ARHMS ${sessionData.selectedCheckerName} Result Checker`,
                    })

                    if (paymentResult.success) {
                        // Store the clientReference so the webhook can find the session
                        sessionData.clientReference = clientReference
                        responseMessage = 'Please approve the MoMo prompt on your phone to complete your purchase. Thank you!';
                    } else {
                        console.error('[Hubtel Interact] initiatePayment failed:', paymentResult.error)
                        responseMessage = 'Payment initiation failed. Please try again later.';
                    }
                    responseType = 'Release';
                    nextStep = 'completed';
                } else {
                    responseMessage = "Order cancelled. Thank you for using ARHMS.";
                    responseType = 'Release';
                    nextStep = 'completed';
                }
                break;
            }

            default:
                responseMessage = "Session expired or invalid state.";
                responseType = 'Release';
                break;
        }

        return await updateAndRespond(SessionId, nextStep, sessionData, responseType, responseMessage);

    } catch (error) {
        console.error('[Hubtel Interact] Unhandled error:', error);
        return NextResponse.json({ Type: 'Release', Message: 'An unexpected error occurred.' });
    }
}

async function updateAndRespond(sessionId: string, nextStep: string, data: any, responseType: string, message: string) {
    const { error } = await supabaseAdmin
        .from('hubtel_sessions')
        .update({
            current_step: nextStep,
            data: data,
            updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

    if (error) {
        console.error('[Hubtel Interact] Session update error:', error);
    }

    return NextResponse.json({
        Type: responseType,
        Message: message
    });
}
