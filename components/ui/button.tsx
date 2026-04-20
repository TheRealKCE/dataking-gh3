import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] hover:scale-105",
    {
        variants: {
            variant: {
                default: "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:shadow-gold shadow-lg",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25",
                outline: "border-2 border-primary/30 bg-background text-foreground hover:border-primary/60 hover:bg-primary/5 transition-all",
                secondary: "bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-lg shadow-lg",
                ghost: "hover:bg-primary/10 hover:text-primary transition-colors",
                link: "text-primary underline-offset-4 hover:underline font-semibold",
                success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25",
                warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25",
                mtn: "bg-yellow-500 text-black hover:bg-yellow-600 shadow-lg shadow-yellow-500/25",
                telecel: "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25",
                gradient: "bg-gradient-to-r from-primary via-secondary to-accent text-white hover:shadow-gold-lg shadow-lg",
                luxury: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-gold-lg shadow-gold hover:scale-110 font-bold",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3 text-xs",
                lg: "h-12 rounded-lg px-8 text-base",
                xl: "h-14 rounded-xl px-10 text-lg",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
