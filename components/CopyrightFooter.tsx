'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface CopyrightFooterProps {
    variant?: 'platform' | 'shop'
    shopName?: string
    adminSettings?: Record<string, any>
    className?: string
}

export function CopyrightFooter({
    variant = 'platform',
    shopName,
    adminSettings: initialSettings,
    className
}: CopyrightFooterProps) {
    const [settings, setSettings] = useState<Record<string, any>>(initialSettings || {})
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        if (!initialSettings) {
            const fetchSettings = async () => {
                const { data } = await supabase
                    .from('admin_settings')
                    .select('key, value')
                    .or('key.eq.footer_copyright_text,key.eq.footer_branding_text')

                if (data) {
                    const mapped = data.reduce((acc: any, curr: any) => {
                        acc[curr.key] = curr.value
                        return acc
                    }, {})
                    setSettings(mapped)
                }
            }
            fetchSettings()
        }
    }, [initialSettings])
    
    // Fallbacks for settings
    const footerText = settings?.footer_copyright_text || `2025 ARHMS DATA LIMITED`
    const brandingText = settings?.footer_branding_text || 'ARHMS'

    return (
        <footer className={cn(
            "w-full py-8 mt-auto flex flex-col items-center justify-center gap-2 px-4",
            "border-t border-gray-200/50 dark:border-gray-800/50",
            className
        )}>
            <div className="flex flex-col items-center text-center gap-1">
                <p className="text-sm font-medium text-muted-foreground tracking-tight">
                    {variant === 'platform' ? (
                        <>© {footerText}. All rights reserved.</>
                    ) : (
                        <>© {currentYear} {shopName}. All rights reserved.</>
                    )}
                </p>
                {variant === 'shop' && (
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                        Powered by {brandingText}
                    </p>
                )}
            </div>
            
            {/* Subtle premium glass effect indicator or decorative element */}
            <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent rounded-full mt-2" />
        </footer>
    )
}
