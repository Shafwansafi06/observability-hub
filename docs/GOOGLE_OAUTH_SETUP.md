# Google OAuth Configuration Guide

## Issue Fixed
- ✅ Inconsistent redirect URLs (now all use `/auth/callback`)
- ✅ Wrong import in AuthCallback.tsx
- ✅ Proper OAuth flow implementation

---

## Supabase Dashboard Configuration

### 1. Enable Google Provider

Go to: **Supabase Dashboard** → **Authentication** → **Providers** → **Google**

1. **Enable Google provider** (toggle on)

2. **Get Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project or create new one
   - Navigate to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**

3. **Configure OAuth consent screen** (if not done):
   - Go to **APIs & Services** → **OAuth consent screen**
   - User Type: External (for public apps)
   - Add app name, user support email, developer contact
   - Save and continue

4. **Add Authorized JavaScript origins:**
   ```
   http://localhost:5173
   http://localhost:4173
   https://your-app.vercel.app
   https://your-custom-domain.com
   ```

5. **Add Authorized redirect URIs:**
   ```
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```
   
   **CRITICAL:** Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference (e.g., `nztdwsnmttwwjticuphi`)

6. **Copy the credentials:**
   - Client ID: `xxxxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxx`

7. **Paste into Supabase:**
   - Back in Supabase → Authentication → Providers → Google
   - Paste **Client ID** and **Client Secret**
   - Click **Save**

---

## Site URL Configuration

### 2. Configure Site URL in Supabase

Go to: **Supabase Dashboard** → **Authentication** → **URL Configuration**

1. **Site URL:**
   ```
   Production: https://your-app.vercel.app
   Development: http://localhost:5173
   ```

2. **Redirect URLs** (Add all of these):
   ```
   http://localhost:5173/auth/callback
   http://localhost:4173/auth/callback
   https://your-app.vercel.app/auth/callback
   https://your-custom-domain.com/auth/callback
   ```

3. Click **Save**

---

## Vercel Configuration (If deployed)

### 3. Set Environment Variables

In **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important:** Make sure these match your Supabase project!

---

## Local Development Configuration

### 4. Update Local .env File

```bash
# .env (DO NOT COMMIT)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Testing the OAuth Flow

### 5. Test Locally

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:** http://localhost:5173/login

3. **Click "Sign in with Google"**

4. **Expected flow:**
   - Redirects to Google sign-in page
   - You sign in with Google account
   - Redirects back to: `http://localhost:5173/auth/callback`
   - AuthCallback page processes the session
   - Redirects to: `http://localhost:5173/dashboard`

5. **Check browser console for errors**

### 6. Test in Production

1. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "fix: Google OAuth configuration"
   git push origin main
   ```

2. **Open:** https://your-app.vercel.app/login

3. **Click "Sign in with Google"**

4. **Expected flow:**
   - Redirects to Google sign-in
   - Sign in
   - Redirects to: `https://your-app.vercel.app/auth/callback`
   - Redirects to: `https://your-app.vercel.app/dashboard`

---

## Common Issues & Solutions

### Issue 1: "redirect_uri_mismatch"

**Cause:** The redirect URI in your request doesn't match what's configured in Google Cloud Console.

**Fix:**
1. Check the error message for the actual redirect URI being used
2. Add that exact URI to **Authorized redirect URIs** in Google Cloud Console
3. Format should be: `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback`

### Issue 2: Stuck on "Completing sign in..." page

**Cause:** Session not being retrieved properly.

**Fix:**
1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
4. Clear browser cookies and try again

### Issue 3: "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured or app not published.

**Fix:**
1. Go to Google Cloud Console → **OAuth consent screen**
2. Make sure all required fields are filled
3. For testing: Add your email to **Test users**
4. For production: Click **Publish App** (requires verification)

### Issue 4: Redirects to wrong URL after sign-in

**Cause:** Redirect URLs not configured properly in Supabase.

**Fix:**
1. Supabase Dashboard → Authentication → URL Configuration
2. Add all your app URLs to **Redirect URLs**
3. Make sure they end with `/auth/callback`

### Issue 5: CORS errors

**Cause:** JavaScript origins not configured in Google Cloud Console.

**Fix:**
1. Google Cloud Console → Credentials → Your OAuth Client
2. **Authorized JavaScript origins** must include:
   - Your Vercel domain
   - localhost (for development)
3. Do NOT include paths, just the origin (e.g., `https://app.com` not `https://app.com/login`)

---

## Quick Checklist

Before testing, verify:

- [ ] Google OAuth enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] Site URL configured in Supabase
- [ ] Redirect URLs added to Supabase (including `/auth/callback`)
- [ ] Authorized JavaScript origins in Google Cloud Console
- [ ] Authorized redirect URIs in Google Cloud Console
- [ ] Supabase URL format: `https://xxx.supabase.co/auth/v1/callback`
- [ ] Environment variables set (locally and in Vercel)
- [ ] OAuth consent screen configured
- [ ] Test user added (if app not published)

---

## Architecture Notes

### OAuth Flow Diagram

```
User clicks "Sign in with Google"
    ↓
signInWithGoogle() called
    ↓
Supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
    ↓
Redirects to Google sign-in page
    ↓
User signs in with Google
    ↓
Google redirects to: https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback
    ↓
Supabase processes OAuth tokens
    ↓
Supabase redirects to: https://your-app.com/auth/callback
    ↓
AuthCallback component loads
    ↓
getSession() retrieves user session
    ↓
Navigate to /dashboard (if session exists) or /login (if not)
```

### Key Files

1. **AuthContext.tsx** - Handles `signInWithGoogle()` call
2. **AuthCallback.tsx** - Processes OAuth callback and redirects
3. **supabaseClient.ts** - Supabase client configuration
4. **App.tsx** - Routes including `/auth/callback`

### Critical URLs

Make sure these match across all configurations:

1. **Redirect URI in code:**
   ```typescript
   redirectTo: `${window.location.origin}/auth/callback`
   ```

2. **Route in App.tsx:**
   ```typescript
   <Route path="/auth/callback" element={<AuthCallback />} />
   ```

3. **Supabase Redirect URLs:**
   ```
   https://your-app.com/auth/callback
   ```

4. **Google OAuth redirect URIs:**
   ```
   https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback
   ```

---

## Testing Commands

```bash
# 1. Rebuild the app
npm run build

# 2. Preview locally
npm run preview

# 3. Test at http://localhost:4173/login

# 4. Check for errors in browser console

# 5. Deploy to production
git push origin main
```

---

## Support

If you still encounter issues:

1. Check Supabase logs: Dashboard → Logs → Auth Logs
2. Check browser Network tab for failed requests
3. Verify all URLs are using HTTPS in production
4. Make sure cookies are enabled in browser
5. Try in incognito mode to rule out cached data

---

## Security Notes

- Never commit `.env` files
- Keep Client Secret secure (only in Supabase, never in frontend)
- Use HTTPS in production
- Regularly rotate OAuth credentials
- Enable MFA for Google account managing OAuth
