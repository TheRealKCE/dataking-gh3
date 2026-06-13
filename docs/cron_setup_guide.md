# Cron Job Setup Guide for DATAKING

This guide provides the exact configuration for setting up all necessary cron jobs for your platform on [cron-job.org](https://cron-job.org/).

## Prerequisites

Ensure these environment variables are set on your hosting platform (e.g., Vercel):
1.  **`CRON_JOBS_ENABLED`**: `true`
2.  **`CRON_SECRET`**: A strong, random string (at least 32 characters).

---

## 🛠️ Individual Cron Job Configurations

For **EVERY** job below, you MUST add this HTTP Header in the **"Advanced"** settings:
- **Key:** `Authorization`
- **Value:** `Bearer YOUR_CRON_SECRET` (Replace `YOUR_CRON_SECRET` with your actual secret)

---

### 1. Sync Moolre Payments
- **Title:** `DATAKING: Sync Moolre Payments`
- **URL:** `https://dataking.qzz.io/api/cron/verify-moolre-payments`
- **Schedule:** Every 2 minutes
- **Crontab expression:** `*/2 * * * *`
- **Purpose:** Credits wallets and processes orders after successful payment.

### 2. Sync CodeCraft Status
- **Title:** `DATAKING: Sync CodeCraft Status`
- **URL:** `https://dataking.qzz.io/api/cron/sync-codecraft-status`
- **Schedule:** Every 5 minutes
- **Crontab expression:** `*/5 * * * *`
- **Purpose:** Updates status for Telecel/AT orders.

### 3. Sync KingFlexy Status
- **Title:** `DATAKING: Sync KingFlexy Status`
- **URL:** `https://dataking.qzz.io/api/cron/sync-kingflexy-status`
- **Schedule:** Every 5 minutes
- **Crontab expression:** `*/5 * * * *`
- **Purpose:** Updates status for KingFlexy orders.

### 4. Auto-Refulfill Orders
- **Title:** `DATAKING: Auto-Refulfill`
- **URL:** `https://dataking.qzz.io/api/cron/auto-refulfill`
- **Schedule:** Every 5 minutes
- **Crontab expression:** `*/5 * * * *`
- **Purpose:** Automatically retries failed/pending orders with alternative suppliers.

### 5. Sync Moolre Withdrawals
- **Title:** `DATAKING: Sync Moolre Withdrawals`
- **URL:** `https://dataking.qzz.io/api/cron/sync-moolre-withdrawals`
- **Schedule:** Every 10 minutes
- **Crontab expression:** `*/10 * * * *`
- **Purpose:** Confirms shop wallet withdrawals.

### 6. Release RC Reservations
- **Title:** `DATAKING: Release RC Reservations`
- **URL:** `https://dataking.qzz.io/api/cron/release-rc-reservations`
- **Schedule:** Every 15 minutes
- **Crontab expression:** `*/15 * * * *`
- **Purpose:** Frees up expired Result Checker voucher pins.

### 7. Auto-Complete Orders
- **Title:** `DATAKING: Auto-Complete`
- **URL:** `https://dataking.qzz.io/api/cron/auto-complete`
- **Schedule:** Every 30 minutes
- **Crontab expression:** `0,30 * * * *`
- **Purpose:** Marks old processing orders as completed.

### 8. Agent Renewal Reminders
- **Title:** `DATAKING: Agent Renewal Reminder`
- **URL:** `https://dataking.qzz.io/api/cron/agent-renewal-reminder`
- **Schedule:** Every day at 08:00 AM
- **Crontab expression:** `0 8 * * *`
- **Purpose:** Sends SMS reminders to agents about plan expiry.

### 9. Auto-Upgrade Dealers
- **Title:** `DATAKING: Auto-Upgrade Dealers`
- **URL:** `https://dataking.qzz.io/api/cron/auto-upgrade-dealers`
- **Schedule:** Every day at 01:00 AM
- **Crontab expression:** `0 1 * * *`
- **Purpose:** Converts expired dealers back to agents.

### 10. Delete Old Complaints
- **Title:** `DATAKING: Delete Old Complaints`
- **URL:** `https://dataking.qzz.io/api/cron/delete-old-complaints`
- **Schedule:** Every Sunday at 01:00 AM
- **Crontab expression:** `0 1 * * 0`
- **Purpose:** Deletes complaints older than 30 days.

### 11. Delete Old Notifications
- **Title:** `DATAKING: Delete Old Notifications`
- **URL:** `https://dataking.qzz.io/api/cron/delete-old-notifications`
- **Schedule:** Every Sunday at 02:00 AM
- **Crontab expression:** `0 2 * * 0`
- **Purpose:** Deletes notifications older than 30 days.

### 12. Delete Old Orders
- **Title:** `DATAKING: Delete Old Orders`
- **URL:** `https://dataking.qzz.io/api/cron/delete-old-orders`
- **Schedule:** Every 1st of the month at 03:00 AM
- **Crontab expression:** `0 3 1 * *`
- **Purpose:** Deletes order history older than 90 days.

---

## 🚀 How to Create a Job on cron-job.org

1.  Click **"Create cron job"**.
2.  **Title:** Copy from the list above.
3.  **URL:** Use the full URL listed for each job (use `https://dataking.qzz.io/...`).
4.  **Execution schedule:** Select "Custom" and paste the **Crontab expression**.
5.  **Advanced settings (CRITICAL):**
    *   Go to **"HTTP Headers"**.
    *   Key: `Authorization`
    *   Value: `Bearer YOUR_CRON_SECRET`
6.  Click **"Create"**.

---

## ❓ Troubleshooting 401 Unauthorized Errors

If you receive a `401 Unauthorized` error when running a cron job, check the following:

1.  **Bearer Prefix:** Ensure the value in the `Authorization` header starts with `Bearer ` (with a space) followed by your secret.
2.  **No Whitespace:** Make sure there are no accidental spaces before or after your `CRON_SECRET` in your hosting platform (Vercel) or in the cron-job.org header value.
3.  **Domain Redirects:** Use the direct domain (`https://dataking.qzz.io`) rather than `www` if your site is configured to redirect, as redirects can sometimes strip headers.
4.  **Secret Length:** The `CRON_SECRET` must be at least 32 characters long.
5.  **Enabled Toggle:** Ensure `CRON_JOBS_ENABLED` is set to `true`.
