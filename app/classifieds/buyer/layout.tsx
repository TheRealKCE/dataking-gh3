export default function BuyerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {children}
        </div>
    )
}
