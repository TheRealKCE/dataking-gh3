-- Utilities go live in production before they open to customers.
--
-- A direct-MoMo bill payment is confirmed by a Hubtel callback to
-- NEXT_PUBLIC_APP_URL, which resolves to the production domain no matter which
-- deployment started the payment. A build that exists only on preview therefore
-- watches its own callback land on production, where an unrecognised UTIL-
-- reference falls through to the wallet top-up path and credits the customer
-- instead of paying their bill. That is not something the preview build can fix —
-- it never runs. So the code has to ship live to work at all, and this flag, not
-- the deploy, decides who may use it.
--
-- 'false' means customers who tap Pay Bills get "Coming soon" and every utility
-- route refuses them, while admins get the working page. Flipped in
-- /admin/utilities once the live GHS 1 tests pass — no deploy required.
--
-- The application already treats a missing row as closed, so this is belt and
-- braces for a fresh environment rather than the thing keeping the door shut.
INSERT INTO public.admin_settings (key, value) VALUES
    ('utility_public_launch', 'false')
ON CONFLICT (key) DO NOTHING;
