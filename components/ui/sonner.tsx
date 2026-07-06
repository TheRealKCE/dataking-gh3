"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-white group-[.toaster]:dark:bg-[#151c2c] group-[.toaster]:text-gray-900 group-[.toaster]:dark:text-white group-[.toaster]:border border-gray-200 group-[.toaster]:dark:border-gray-800 group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:font-medium",
                    description: "group-[.toast]:text-gray-600 group-[.toast]:dark:text-gray-400 group-[.toast]:font-normal text-sm",
                    actionButton:
                        "group-[.toast]:bg-emerald-600 group-[.toast]:hover:bg-emerald-700 group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:font-semibold",
                    cancelButton:
                        "group-[.toast]:bg-gray-100 group-[.toast]:dark:bg-gray-800 group-[.toast]:text-gray-700 group-[.toast]:dark:text-gray-300 group-[.toast]:rounded-lg group-[.toast]:font-semibold",
                    error:
                        "group-[.toaster]:border-red-200 group-[.toaster]:dark:border-red-900/30 group-[.toaster]:bg-red-50 group-[.toaster]:dark:bg-red-900/20 group-[.toaster]:text-red-700 group-[.toaster]:dark:text-red-300",
                    success:
                        "group-[.toaster]:border-emerald-200 group-[.toaster]:dark:border-emerald-900/30 group-[.toaster]:bg-emerald-50 group-[.toaster]:dark:bg-emerald-900/20 group-[.toaster]:text-emerald-700 group-[.toaster]:dark:text-emerald-300",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
