import Link from 'next/link'
import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ShopGuidanceCardProps {
    icon: LucideIcon
    iconColor: string
    iconBg: string
    title: string
    message: string
    ctaText?: string
    ctaLink?: string
}

export function ShopGuidanceCard({
    icon: Icon,
    iconColor,
    iconBg,
    title,
    message,
    ctaText,
    ctaLink,
}: ShopGuidanceCardProps) {
    return (
        <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${iconBg}`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                </div>
                <div className="space-y-1.5 max-w-sm">
                    <p className="font-semibold text-base">{title}</p>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
                {ctaText && ctaLink && (
                    <Link href={ctaLink}>
                        <Button size="sm" className="mt-1">
                            {ctaText}
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
    )
}
