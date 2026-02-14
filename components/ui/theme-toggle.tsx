"use client"

import * as React from "react"
import { Moon, Sun, Laptop, Check } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [open, setOpen] = React.useState(false)

    const themes = [
        { id: "light", label: "Light", icon: Sun, color: "text-amber-500", bg: "bg-amber-50" },
        { id: "dark", label: "Dark", icon: Moon, color: "text-blue-500", bg: "bg-blue-50" },
        { id: "system", label: "System", icon: Laptop, color: "text-slate-500", bg: "bg-slate-50" },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-2 transition-all hover:scale-105 active:scale-95 shadow-sm">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-black tracking-tight">Select Theme</DialogTitle>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Choose your preferred appearance</p>
                </DialogHeader>
                <div className="p-4 grid gap-3">
                    {themes.map((t) => {
                        const Icon = t.icon
                        const isActive = theme === t.id
                        return (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setTheme(t.id)
                                    setOpen(false)
                                }}
                                className={cn(
                                    "relative flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 group overflow-hidden",
                                    isActive
                                        ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                                        : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/20 hover:scale-[1.01]"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2.5 rounded-lg transition-colors",
                                        isActive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground group-hover:text-primary"
                                    )}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <span className={cn(
                                        "font-bold text-sm tracking-tight transition-colors",
                                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                    )}>
                                        {t.label}
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in duration-300">
                                        <Check className="h-3.5 w-3.5 stroke-[3px]" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
                <div className="bg-muted/30 p-4 text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest border-t">
                    KING FLEXY DATA LTD • UI PRESET
                </div>
            </DialogContent>
        </Dialog>
    )
}
