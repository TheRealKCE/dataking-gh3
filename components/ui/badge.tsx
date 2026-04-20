import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-primary/30 bg-gradient-to-r from-primary/20 to-primary/10 text-primary hover:border-primary/50 hover:from-primary/30",
                secondary:
                    "border-secondary/30 bg-gradient-to-r from-secondary/20 to-secondary/10 text-secondary hover:border-secondary/50",
                destructive:
                    "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
                outline: "border-border text-foreground hover:border-primary/50",
                success:
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/20",
                warning:
                    "border-amber-500/30 bg-amber-500/10 text-amber-400 dark:text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/20",
                pending:
                    "border-amber-500/30 bg-amber-500/10 text-amber-400 dark:text-amber-300 hover:border-amber-500/50",
                processing:
                    "border-blue-500/30 bg-blue-500/10 text-blue-400 dark:text-blue-300 animate-pulse",
                completed:
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300",
                failed:
                    "border-red-500/30 bg-red-500/10 text-red-400 dark:text-red-300",
                mtn:
                    "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 dark:text-yellow-300",
                telecel:
                    "border-red-500/30 bg-red-500/10 text-red-400 dark:text-red-300",
                airteltigo:
                    "border-orange-500/30 bg-orange-500/10 text-orange-400 dark:text-orange-300",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
