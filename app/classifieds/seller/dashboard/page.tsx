export default function SellerDashboardPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                        Seller Dashboard
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Manage your listings and view analytics
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
                        <span className="text-3xl">🏪</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Coming Soon
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                        The Seller Dashboard is coming in Phase 2. You'll be able to post listings, manage inventory, and view analytics here.
                    </p>
                </div>
            </div>
        </div>
    )
}
