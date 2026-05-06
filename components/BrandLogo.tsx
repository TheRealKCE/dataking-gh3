import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
    className?: string
    collapsed?: boolean
    hideText?: boolean
}

export function BrandLogo({ className, collapsed = false, hideText = false }: BrandLogoProps) {
    const showText = !collapsed && !hideText
    return (
        <div className={cn("flex items-center gap-3 group transition-all duration-300", className)}>
            {/* Logo Icon Container */}
            <div className="relative w-10 h-10 flex-shrink-0 rounded-2xl overflow-hidden shadow-xl shadow-indigo-500/20 ring-1 ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <Image
                    src="/logo.png"
                    alt="ARHMS Logo"
                    fill
                    className="object-contain"
                    priority
                />
                {/* Dynamic Shine Effect */}
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
            </div>

            {/* Logo Text - Hidden when collapsed or explicitly hidden */}
            {showText && (
                <div className="flex flex-col">
                    <span className="font-heading font-black text-xl tracking-tighter text-foreground group-hover:text-primary transition-colors duration-300 leading-none">
                        ARHMS
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mt-1 ml-0.5">
                        Data Limited
                    </span>
                </div>
            )}
        </div>
    )
}
