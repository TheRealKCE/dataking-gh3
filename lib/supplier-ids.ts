/**
 * The data suppliers, as plain data — safe to import from client components.
 *
 * lib/supplier-router.ts adds the server side (service loaders, DB columns). The
 * admin page imports this file instead, so the browser bundle never pulls in eight
 * supplier services.
 */
export const SUPPLIER_IDS = [
    'datakazina', 'codecraft', 'kingflexy', 'eazydata',
    'agentportal', 'netpulse', 'hendylinks', 'bundleportal',
    'kuntanii',
] as const

export type SupplierId = typeof SUPPLIER_IDS[number]

/** Supplier id → the fulfillment_settings key holding its per-network PRIMARY toggle. */
export const SUPPLIER_FLAGS: Record<SupplierId, string> = {
    datakazina: 'networks',
    codecraft: 'codecraft_networks',
    kingflexy: 'kingflexy_networks',
    eazydata: 'eazydata_networks',
    agentportal: 'agentportal_networks',
    netpulse: 'netpulse_networks',
    hendylinks: 'hendylinks_networks',
    bundleportal: 'bundleportal_networks',
    kuntanii: 'kuntanii_networks',
}

export const SUPPLIER_NAMES: Record<SupplierId, string> = {
    datakazina: 'Dakazina',
    codecraft: 'CodeCraft',
    kingflexy: 'KingFlexy',
    eazydata: 'Eazy Data',
    agentportal: 'Agent Portal',
    netpulse: 'NetPulse',
    hendylinks: 'HendyLinks',
    bundleportal: 'BundlePortal',
    kuntanii: 'Kuntanii',
}

/** Suppliers that only sell some networks; anything missing here sells all four. */
export const SUPPLIER_ONLY_NETWORKS: Partial<Record<SupplierId, readonly string[]>> = {
    kuntanii: ['MTN'],
}

export function supplierSellsNetwork(id: SupplierId, network: string): boolean {
    const only = SUPPLIER_ONLY_NETWORKS[id]
    return !only || only.includes(network)
}

export function isSupplierId(value: unknown): value is SupplierId {
    return typeof value === 'string' && (SUPPLIER_IDS as readonly string[]).includes(value)
}
