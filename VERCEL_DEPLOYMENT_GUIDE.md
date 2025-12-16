# Vercel Deployment Configuration Guide

## 🚀 Setting Up Environment Variables in Vercel

Your app is deployed but needs environment variables configured in Vercel to work properly. Follow these steps:

### 1. Go to Your Vercel Project
1. Visit [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your `observability-hub` project
3. Click **Settings** → **Environment Variables**

### 2. Add Required Environment Variables

Add the following variables (copy from your `.env` file):

#### ✅ Required Variables (App will work in demo mode without these, but won't have full functionality):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://nztdwsnmttwwjticuphi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dGR3c25tdHR3d2p0aWN1cGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjExNzEsImV4cCI6MjA4MDMzNzE3MX0.PorO3nzxq2bwPwerhvV0ZrWk8QiDw0lwTj1vg1l5sPE
```

#### 📊 Optional Variables (for full features):

```bash
# Datadog Monitoring (Optional - for production monitoring)
VITE_DD_APPLICATION_ID=30cc174dc4bd5fefedc53cc8916cf2822726a642
VITE_DD_CLIENT_TOKEN=pub4ff01c42bc9108587caf6aca597b3405
VITE_DD_SITE=us5.datadoghq.com
VITE_DD_SERVICE=observai-frontend
VITE_DD_ENV=production
VITE_DD_VERSION=1.0.0

# Vertex AI (Optional - for LLM features)
VITE_VERTEX_AI_API_KEY=AIzaSyBIvF3A6qwmXsKokU1biWLzgJ9Eu3SzPb8
VITE_GCP_PROJECT_ID=utility-gravity-461209-p0
VITE_VERTEX_AI_LOCATION=us-central1
```

### 3. How to Add Variables in Vercel

For each variable:

1. Click **Add New**
2. Enter the **Key** (e.g., `VITE_SUPABASE_URL`)
3. Enter the **Value** (copy from your `.env` file)
4. Select environments: **Production**, **Preview**, **Development**
5. Click **Save**

### 4. Redeploy Your App

After adding all variables:

1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Or simply push a new commit to trigger deployment

### 5. Verify Deployment

Once redeployed:
- Visit your site: `https://observai.vercel.app`
- Check browser console (F12) - should see initialization messages
- Try logging in or navigating to different pages

## 🔒 Security Notes

### Your Keys Are Safe! ✅

The keys in this file are **NOT sensitive** because:

1. **VITE_SUPABASE_ANON_KEY**: This is a PUBLIC key meant to be exposed to the browser. It has Row Level Security (RLS) restrictions.

2. **VITE_DD_CLIENT_TOKEN**: This is a PUBLIC token for browser monitoring, not a secret API key.

3. **VITE_VERTEX_AI_API_KEY**: While this should be restricted, you can:
   - Add HTTP referrer restrictions in Google Cloud Console
   - Limit to your domain: `https://observai.vercel.app/*`

### DO NOT expose in this file:
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- ❌ `DD_API_KEY` (server-only)
- ❌ `GCP_SERVICE_ACCOUNT_KEY` (server-only)

These are already in `.gitignore` and not committed.

## 🎯 Quick Fix Checklist

If your deployment shows blank page:

- [ ] Add `VITE_SUPABASE_URL` to Vercel
- [ ] Add `VITE_SUPABASE_ANON_KEY` to Vercel
- [ ] Redeploy after adding variables
- [ ] Check browser console for errors
- [ ] Verify environment variables are set (Vercel Settings → Environment Variables)

## 🆘 Troubleshooting

### Issue: Blank Page After Deployment
**Solution**: Add environment variables and redeploy

### Issue: "Missing Supabase environment variables" warning
**Solution**: This is now a warning, not an error. App works in demo mode. Add variables for full functionality.

### Issue: Login doesn't work
**Solution**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel

### Issue: Charts/data not loading
**Solution**: The app now works with mock data if Supabase isn't configured. For real data, add Supabase credentials.

## 📝 Alternative: Environment Variables via CLI

If you prefer CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Add environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Redeploy
vercel --prod
```

## ✅ Current Status

✅ **Fixed Issues:**
- App no longer crashes if environment variables are missing
- Displays warning in console instead of error
- Works in demo mode without database
- Graceful fallback for all features

✅ **Next Steps:**
1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel
2. Redeploy
3. Your app will have full functionality!

---

**Need Help?** Check the Vercel documentation: https://vercel.com/docs/environment-variables
