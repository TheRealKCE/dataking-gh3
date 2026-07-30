// Instant loading boundary for every /auth/* route.
//
// Without this file an App Router navigation blocks: tapping "Login" or
// "Get Started" on the landing page leaves the old page fully rendered — with
// zero feedback — until the auth route's RSC payload and JS chunks land. On a
// slow Ghanaian mobile connection that reads as "the button did nothing".
// With a loading boundary the transition paints immediately, and Next can
// prefetch the whole route (not just the layout) from the landing page.
//
// Deliberately dependency-free — no context, no icons, no client component —
// so this skeleton ships in the shared chunk and renders with no extra fetch.
export default function AuthLoading() {
    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 bg-background">
            <div className="w-full max-w-[420px] flex flex-col items-center">
                {/* Logo + branding placeholder */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 mb-6 rounded-3xl bg-muted animate-pulse" />
                    <div className="h-7 w-56 rounded-lg bg-muted animate-pulse" />
                    <div className="h-3 w-32 rounded bg-muted animate-pulse mt-3" />
                </div>

                {/* Card placeholder */}
                <div className="w-full rounded-2xl border border-border/50 bg-card/70 p-8 shadow-sm">
                    <div className="h-14 w-full rounded-2xl bg-muted animate-pulse" />
                    <div className="h-3 w-10 rounded bg-muted animate-pulse mx-auto my-6" />
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                            <div className="h-14 w-full rounded-2xl bg-muted animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                            <div className="h-14 w-full rounded-2xl bg-muted animate-pulse" />
                        </div>
                        <div className="h-14 w-full rounded-2xl bg-primary/20 animate-pulse" />
                    </div>
                </div>
            </div>

            <span className="sr-only" role="status">Loading…</span>
        </div>
    )
}
