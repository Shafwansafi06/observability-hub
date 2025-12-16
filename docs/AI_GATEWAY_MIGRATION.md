# Secure AI Gateway - Migration Guide

## 🔒 Security Improvement

We've migrated from client-side AI calls to a secure backend gateway architecture.

### ⚠️ WHY THIS CHANGE IS CRITICAL

**Before (INSECURE):**
```typescript
// ❌ DANGEROUS: API key exposed in frontend bundle
const API_KEY = import.meta.env.VITE_VERTEX_AI_API_KEY;
fetch(`https://api.google.com/...?key=${API_KEY}`);
```

**Problems:**
- `VITE_*` variables are bundled into JavaScript → anyone can extract your API key
- No rate limiting → attackers can abuse your quota
- No input validation → prompt injection attacks possible
- No audit trail → can't track who used your API
- Key rotation impossible without redeploying

**After (SECURE):**
```typescript
// ✅ SECURE: API key only on server
const response = await fetch('/api/ai/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt: '...' })
});
```

**Benefits:**
- API key never leaves the server
- Rate limiting per IP address
- Input validation prevents injection
- Full audit logging
- Easy key rotation (just update env var)

---

## 📁 File Structure

```
observability-hub/
├── api/
│   └── ai/
│       └── generate.ts          # Secure backend gateway (Vercel serverless)
├── src/
│   └── lib/
│       ├── ai-client.ts         # New secure frontend client
│       └── vertex-ai/
│           └── client.ts        # Updated to use backend (backward compatible)
└── .env (NOT COMMITTED)
```

---

## 🔧 Environment Variables

### Server-Side (Vercel Dashboard)
Add these in **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

```bash
# Google Vertex AI API Key (Server-side ONLY - no VITE_ prefix!)
VERTEX_AI_API_KEY=AIzaSy...your_key_here

# Optional: Supabase (already configured)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### ⚠️ CRITICAL RULES

1. **NEVER use `VITE_` prefix for secrets**
   - `VITE_*` variables → bundled into client JavaScript
   - Anyone can view your bundled code and steal keys
   
2. **Server-only variables** (safe):
   - `VERTEX_AI_API_KEY` ✅
   - `DATABASE_URL` ✅
   - `DD_API_KEY` ✅
   
3. **Client-safe variables** (can use `VITE_`):
   - `VITE_SUPABASE_URL` ✅ (public URL, not sensitive)
   - `VITE_SUPABASE_ANON_KEY` ✅ (public, row-level security protects data)
   - `VITE_DD_CLIENT_TOKEN` ✅ (client token, not API key)

---

## 🚀 Deployment Steps

### 1. Add Environment Variables to Vercel

```bash
# In Vercel Dashboard:
# Project → Settings → Environment Variables

Name: VERTEX_AI_API_KEY
Value: AIzaSy...your_actual_key
Environment: Production, Preview, Development
```

### 2. Remove Old Variable (if it exists)
Delete `VITE_VERTEX_AI_API_KEY` from Vercel if you added it before.

### 3. Deploy
```bash
git add .
git commit -m "feat: migrate to secure AI gateway"
git push origin main
```

Vercel will automatically deploy.

### 4. Verify

Test the endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!", "model": "gemini-2.5-flash"}'
```

Expected response:
```json
{
  "text": "Hello! How can I help you today?",
  "tokens": 12,
  "latency": 456,
  "model": "gemini-2.5-flash"
}
```

---

## 💻 Code Migration

### Old Code (Insecure)
```typescript
// ❌ This exposed API keys
import { vertexAI } from '@/lib/vertex-ai/client';

const response = await vertexAI.predict({
  prompt: 'Analyze this...',
  model: ModelType.TEXT_FAST
});
```

### New Code (Secure)
```typescript
// ✅ Option 1: Use new ai-client (recommended)
import { generateAIResponse } from '@/lib/ai-client';

const response = await generateAIResponse('Analyze this...', {
  model: 'gemini-2.5-flash'
});

// ✅ Option 2: Keep using vertexAI (backward compatible)
import { vertexAI } from '@/lib/vertex-ai/client';

// Still works! Internally routes through secure backend
const response = await vertexAI.predict({
  prompt: 'Analyze this...',
  model: ModelType.TEXT_FAST
});
```

**No breaking changes** - existing code continues to work!

---

## 🛡️ Security Features

### 1. Rate Limiting
- **20 requests per minute per IP**
- Prevents abuse and quota exhaustion
- Returns `429` with `Retry-After` header

### 2. Input Validation
- Prompt length limits (1-32,000 chars)
- Blocks obvious injection attempts (`<script>`, `javascript:`, etc.)
- Temperature bounds (0-2)
- Token limits (1-8,192)

### 3. Error Sanitization
- API keys redacted from error messages
- Prevents accidental secret leakage in logs
- Generic errors returned to client

### 4. Demo Mode
- Works without backend when developing locally
- Returns mock responses if `VERTEX_AI_API_KEY` not set
- Allows UI testing without configuration

---

## 🔍 Monitoring & Debugging

### Check Backend Logs
```bash
# In Vercel Dashboard:
# Deployments → [your deployment] → Functions → /api/ai/generate

# Look for:
[AI Gateway] Request: { model: 'gemini-2.5-flash', ... }
[AI Gateway] Success: { tokens: 123, latency: '456ms' }
```

### Check Frontend Console
```javascript
// Get metrics
import { getAIMetrics } from '@/lib/ai-client';
console.log(getAIMetrics());
// {
//   totalRequests: 10,
//   successfulRequests: 9,
//   failedRequests: 1,
//   averageLatency: 523,
//   tokensUsed: 1234
// }
```

---

## 🐛 Troubleshooting

### Error: "AI service temporarily unavailable"
**Cause:** `VERTEX_AI_API_KEY` not set in Vercel
**Fix:** Add the environment variable (see deployment steps)

### Error: "Rate limit exceeded"
**Cause:** More than 20 requests/minute from your IP
**Fix:** Wait 60 seconds, or increase limit in `api/ai/generate.ts`

### Error: "Invalid prompt content"
**Cause:** Prompt contains blocked patterns (`<script>`, etc.)
**Fix:** Remove HTML/JavaScript from your prompt

### Demo Mode Activating Unexpectedly
**Cause:** Backend can't be reached
**Fix:** 
1. Check Vercel deployment status
2. Verify `VERTEX_AI_API_KEY` is set
3. Check network tab for 503 errors

---

## 📊 Production Checklist

- [ ] `VERTEX_AI_API_KEY` added to Vercel (no `VITE_` prefix)
- [ ] Old `VITE_VERTEX_AI_API_KEY` removed from Vercel
- [ ] Deployment successful
- [ ] Test `/api/ai/generate` endpoint returns 200
- [ ] Frontend console shows no "VITE_VERTEX_AI_API_KEY not configured" warnings
- [ ] Rate limiting works (test with 21 requests in 1 minute)
- [ ] Error handling works (test with invalid prompt)
- [ ] Metrics tracking works (`getAIMetrics()` returns data)
- [ ] Demo mode disabled in production (or works as fallback)

---

## 🎯 Key Takeaways

1. **Never use `VITE_` for secrets** → they get bundled into client code
2. **Always use backend for AI calls** → protects API keys
3. **Rate limit everything** → prevents abuse
4. **Validate all inputs** → prevents injection attacks
5. **Sanitize all errors** → prevents secret leakage
6. **Support demo mode** → enables development without full setup

---

## 📞 Support

If you see errors after migration:
1. Check Vercel function logs
2. Verify environment variables
3. Test backend endpoint directly
4. Check browser console for client-side errors

**Common mistake:** Adding `VITE_VERTEX_AI_API_KEY` instead of `VERTEX_AI_API_KEY`
- `VITE_` → exposed in bundle ❌
- No prefix → server-side only ✅
