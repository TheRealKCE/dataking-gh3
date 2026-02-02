# Supabase Session Configuration

## Current Setup

✅ **Inactivity Timeout**: Changed from 40 minutes to **1 hour (60 minutes)**
✅ **Redirect on Inactivity**: Users will be redirected to **home page (/)** instead of login page
✅ **Session Persistence**: Sessions remain active until user closes browser or becomes inactive

## Supabase Dashboard Configuration Required

To disable automatic session expiration and rely only on inactivity timeout, you need to configure Supabase:

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com/project/YOUR_PROJECT_ID

2. **Access Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Go to "Settings"

3. **Configure Session Settings**
   
   Update these settings:
   
   - **JWT Expiry**: Set to maximum value (e.g., `31536000` seconds = 1 year)
     - This prevents JWT token expiration
   
   - **Refresh Token Lifetime**: Set to maximum (e.g., `31536000` seconds = 1 year)
     - This prevents refresh token from expiring
   
   - **Auto Refresh Token**: Enable (should be ON by default)
     - Automatically refreshes tokens before they expire

### Alternative: Update via SQL (Advanced)

If you have access to SQL editor, you can also update auth configuration via SQL:

```sql
-- Note: This requires admin access to Supabase auth schema
-- These are example values - adjust based on your Supabase version

-- Set JWT expiry to 1 year (in seconds)
ALTER DATABASE postgres SET app.settings.jwt_exp TO '31536000';

-- Set refresh token reuse interval
ALTER DATABASE postgres SET app.settings.refresh_token_reuse_interval TO '0';
```

## How It Works Now

1. **Login**: User logs in → session starts
2. **Activity Tracking**: System tracks mouse, keyboard, scroll, touch, and click events
3. **Inactivity Check**: Every minute, the system checks if 1 hour has passed since last activity
4. **Auto Logout**: After 1 hour of inactivity:
   - Session is cleared
   - User is signed out
   - User is redirected to home page (`/`)
5. **Browser Close**: When browser closes, session flag is cleared (logout on browser reopen)

## Testing

To test the inactivity timeout:

1. Log in to the application
2. Leave the tab open without any mouse/keyboard activity
3. After 1 hour, you should be automatically logged out and redirected to home page

## Quick Test (Development Only)

If you want to test with a shorter timeout during development, temporarily change line 32 in `contexts/auth-context.tsx`:

```tsx
// For testing: 2 minutes
const INACTIVITY_TIMEOUT = 2 * 60 * 1000

// Production: 1 hour
const INACTIVITY_TIMEOUT = 60 * 60 * 1000
```

**Remember to change it back to 1 hour for production!**

## Summary

✨ **Sessions never expire on their own** (when properly configured in Supabase)  
⏰ **1-hour inactivity timeout** triggers auto-logout  
🏠 **Redirects to home page** instead of login  
🔒 **Session cleared on browser close** for security  
📱 **Activity tracking** keeps session alive during use
