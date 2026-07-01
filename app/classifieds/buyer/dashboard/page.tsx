export default function BuyerDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                        My Purchases
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Track your saved items and contact history
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
                        <span className="text-3xl">🛍️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Coming Soon
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                        The Buyer Dashboard is coming in Phase 2. You'll see your saved listings, purchase history, and active chats here.
                    </p>
                </div>
            </div>
        </div>
    )
}
