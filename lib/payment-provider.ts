/**
 * The set of payment gateways ARHMS can collect through, and how an
 * `admin_settings.active_payment_provider_*` value resolves to one.
 *
 * This exists because provider selection used to be a copy-pasted ternary
 *
 *     adminDefault === 'paystack' ? 'paystack' : adminDefault === 'hubtel' ? 'hubtel' : 'moolre'
 *
 * repeated in seven API routes and six client components. Adding a gateway meant
 * editing thirteen places, and any one that was missed silently fell through to
 * Moolre — i.e. the admin toggle would appear to do nothing for that flow.
 * Everything that needs to know the active provider now goes through here.
 *
 * Safe to import from client components: no server-only imports, no env reads.
 */

export const PAYMENT_PROVIDERS = ['moolre', 'hubtel', 'paystack', 'payswitch'] as const

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

/** The three independently-configurable areas of the app. */
export type PaymentScope = 'web' | 'shop' | 'classifieds'

/** admin_settings key backing each scope. */
export const SCOPE_SETTING_KEY: Record<PaymentScope, string> = {
    web: 'active_payment_provider_web',
    shop: 'active_payment_provider_shop',
    classifieds: 'active_payment_provider_classifieds',
}

/**
 * Providers each scope actually supports.
 *
 * Classifieds excludes Hubtel — the boost flow never had a Hubtel branch and
 * adding one is out of scope here. Listing it would let an admin select a
 * gateway that then falls back to Moolre at runtime.
 */
export const SCOPE_PROVIDERS: Record<PaymentScope, readonly PaymentProvider[]> = {
    web: ['moolre', 'hubtel', 'paystack', 'payswitch'],
    shop: ['moolre', 'hubtel', 'paystack', 'payswitch'],
    classifieds: ['moolre', 'paystack', 'payswitch'],
}

export const DEFAULT_PAYMENT_PROVIDER: PaymentProvider = 'moolre'

/** Human label for admin UI / customer-facing copy. */
export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
    moolre: 'Moolre',
    hubtel: 'Hubtel',
    paystack: 'Paystack',
    payswitch: 'PaySwitch',
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
    return typeof value === 'string' && (PAYMENT_PROVIDERS as readonly string[]).includes(value)
}

/**
 * Resolves a raw admin_settings value to a known provider.
 *
 * Anything unrecognised (unset, typo, a provider removed from the build) falls
 * back rather than throwing — a bad setting must not take payments down.
 */
export function resolveProvider(
    raw: unknown,
    fallback: PaymentProvider = DEFAULT_PAYMENT_PROVIDER
): PaymentProvider {
    // admin_settings.value is a text column that has been written both ways: the
    // seed migration inserts JSON-quoted ('"moolre"') while the admin UI POSTs a
    // bare string ('moolre'). Strip the quotes so a freshly-seeded row resolves to
    // the provider it names instead of silently falling back.
    const value = String(raw ?? '').trim().replace(/^"+|"+$/g, '').trim().toLowerCase()
    return isPaymentProvider(value) ? value : fallback
}

/**
 * Resolves for a specific scope, additionally rejecting providers that scope
 * does not implement.
 */
export function resolveProviderForScope(
    raw: unknown,
    scope: PaymentScope,
    fallback: PaymentProvider = DEFAULT_PAYMENT_PROVIDER
): PaymentProvider {
    const provider = resolveProvider(raw, fallback)
    return SCOPE_PROVIDERS[scope].includes(provider) ? provider : fallback
}

/**
 * True for gateways that debit by pushing an approval prompt to the customer's
 * handset — the UI must collect a phone number and network for these. Paystack
 * is the odd one out: it redirects to a hosted checkout page instead.
 */
export function isMomoPromptProvider(provider: PaymentProvider): boolean {
    return provider !== 'paystack'
}
