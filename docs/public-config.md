# Public Configuration Contract

`/api/public/config` is intentionally public and may be cached by browsers and CDN edges. It must only expose values from the `public.public_admin_settings` allowlist plus active system announcements intended for customers.

The `whatsapp_admin_number` field is a documented intentional business decision. It is exposed publicly so customers and storefront visitors can escalate support issues through WhatsApp.

Do not add API keys, provider credentials, service-role identifiers, wallet balances, private user identifiers, internal routing toggles, or operational-only settings to this contract.
