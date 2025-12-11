# Datadog Setup Guide - ObservAI Hub

This guide walks you through importing and configuring all Datadog artifacts for ObservAI Hub.

---

## 🎯 Prerequisites

Before you begin, ensure you have:

✅ **Datadog Account** - Free trial or paid account  
✅ **API Key** - For Datadog RUM and Logs  
✅ **Application ID** - For Datadog RUM  
✅ **Client Token** - For browser-side data collection  
✅ **Vertex AI API Key** - For Google Gemini API  

---

## 📦 Step 1: Environment Configuration

### 1.1 Create `.env` File

```bash
# Copy the example environment file
cp .env.example .env
```

### 1.2 Add Your API Keys

Edit `.env` and add:

```env
# Datadog Configuration
VITE_DATADOG_APPLICATION_ID=your_application_id_here
VITE_DATADOG_CLIENT_TOKEN=your_client_token_here
VITE_DATADOG_SITE=datadoghq.com
VITE_DATADOG_SERVICE=observai-hub
VITE_DATADOG_ENV=production

# Vertex AI Configuration
VITE_VERTEX_API_KEY=your_vertex_ai_api_key_here
VITE_VERTEX_MODEL=gemini-2.0-flash

# Supabase Configuration (if using)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 1.3 Get Datadog Credentials

**Navigate to Datadog**:
1. Go to [app.datadoghq.com](https://app.datadoghq.com)
2. **Organization Settings** → **Client Tokens** → Create new token
3. **RUM Applications** → Create new application → Get Application ID
4. Save credentials to `.env`

---

## 📊 Step 2: Import Dashboard

### 2.1 Navigate to Dashboards

1. Open Datadog: [app.datadoghq.com/dashboard/lists](https://app.datadoghq.com/dashboard/lists)
2. Click **"New Dashboard"**
3. Select **"Import Dashboard JSON"**

### 2.2 Import Configuration

**File Location**: `datadog/dashboards/llm-observability-dashboard.json`

**Steps**:
```bash
# Copy the JSON content
cat datadog/dashboards/llm-observability-dashboard.json

# Or use the UI:
# 1. Click "Import Dashboard JSON"
# 2. Paste the entire JSON content
# 3. Click "Import"
# 4. Dashboard will be created automatically
```

### 2.3 Verify Dashboard

**Check for**:
- ✅ 14 widgets visible
- ✅ Template variables ($model, $env) at top
- ✅ All queries valid (no errors)
- ✅ Dashboard titled "LLM Observability - ObservAI Hub"

**Note**: Widgets will show "No data" until you start sending telemetry.

---

## 🚨 Step 3: Import Monitors

### 3.1 Navigate to Monitors

1. Open Datadog: [app.datadoghq.com/monitors/manage](https://app.datadoghq.com/monitors/manage)
2. Click **"New Monitor"**
3. Select **"Import Monitor"** (or use API)

### 3.2 Import All 8 Monitors

**File Location**: `datadog/monitors/llm-alerts.json`

**Option A: Manual Import** (Recommended for first-time)

```bash
# The file contains 8 monitor definitions
# Import each one individually through the UI:

# 1. Open datadog/monitors/llm-alerts.json
# 2. Copy each monitor object
# 3. In Datadog UI: Monitors → New Monitor → Import
# 4. Paste JSON and save
```

**Option B: API Import** (Faster)

```bash
# Install Datadog CLI
pip install datadog-api-client

# Set environment variables
export DD_SITE="datadoghq.com"
export DD_API_KEY="your_api_key"
export DD_APP_KEY="your_app_key"

# Import monitors via script
node scripts/import-monitors.js
```

### 3.3 Configure Notification Channels

**Edit each monitor** to update notification channels:

```yaml
# Replace these placeholders:
@slack-alerts → @slack-your-channel
@pagerduty-critical → @pagerduty-your-service
@sre-team → @your-team-email
@security-team → @security@yourcompany.com
```

### 3.4 Verify Monitors

**Check for**:
- ✅ 8 monitors created
- ✅ All queries valid
- ✅ Notification channels configured
- ✅ Tags added: `service:observai-hub`, `team:observai`

---

## 🧪 Step 4: Create Synthetic Test

### 4.1 Navigate to Synthetic Monitoring

1. Open Datadog: [app.datadoghq.com/synthetics/list](https://app.datadoghq.com/synthetics/list)
2. Click **"New Test"**
3. Select **"API Test"**

### 4.2 Configure Test

**File Location**: `datadog/synthetics/vertex-ai-health-check.json`

**Manual Configuration**:

1. **Test Type**: HTTP API Test
2. **Name**: "Vertex AI Health Check"
3. **Request Type**: POST
4. **URL**: `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`
5. **Headers**:
   ```
   Content-Type: application/json
   x-goog-api-key: {{ API_KEY }}
   ```
6. **Body**:
   ```json
   {
     "contents": [{
       "parts": [{
         "text": "Hello, this is a synthetic monitoring test. Please respond with: OK"
       }]
     }]
   }
   ```
7. **Locations**: Select 4 regions (us-east-1, us-west-2, eu-west-1, ap-southeast-1)
8. **Frequency**: Every 5 minutes
9. **Assertions**:
   - Status code is 200
   - Response time is less than 3000ms
   - Body contains "candidates"
   - Body does not contain "error"
10. **Notifications**: Alert if test fails 2 times consecutively

### 4.3 Add API Key Variable

1. Go to **Synthetic Monitoring Settings** → **Global Variables**
2. Create new variable:
   - **Name**: `API_KEY`
   - **Value**: Your Vertex AI API key
   - **Secure**: ✅ Check this box
3. Save variable

### 4.4 Verify Synthetic Test

**Check for**:
- ✅ Test created and running
- ✅ First results show success
- ✅ All 4 locations reporting
- ✅ Response time < 3000ms

---

## 🚀 Step 5: Deploy Application

### 5.1 Install Dependencies

```bash
# Install npm packages
npm install

# Verify Datadog packages installed
npm list @datadog/browser-rum
npm list @datadog/browser-logs
npm list dd-trace
```

### 5.2 Build Application

```bash
# Development build
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### 5.3 Deploy to Production

**Option A: Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Settings → Environment Variables → Add all from .env
```

**Option B: Netlify**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Add environment variables in Netlify dashboard
# Site settings → Environment → Add all from .env
```

**Option C: Docker**

```bash
# Build Docker image
docker build -t observai-hub .

# Run container
docker run -p 80:80 --env-file .env observai-hub
```

---

## ✅ Step 6: Verify Integration

### 6.1 Test RUM Data Flow

1. Open your deployed application
2. Navigate to "Live AI Tester"
3. Make a test request
4. Open browser console and verify:
   ```
   ✅ Datadog RUM initialized
   ✅ RUM action "llm_inference" created
   ✅ Session ID present
   ```

### 6.2 Check Datadog RUM

1. Go to [app.datadoghq.com/rum/explorer](https://app.datadoghq.com/rum/explorer)
2. Filter by: `service:observai-hub`
3. Look for custom actions: `action.target.name:llm_inference`
4. Verify custom attributes are present:
   - `llm.model`
   - `llm.latency_ms`
   - `llm.tokens.total`
   - `llm.cost_usd`

### 6.3 Check Datadog Logs

1. Go to [app.datadoghq.com/logs](https://app.datadoghq.com/logs)
2. Filter by: `service:vertex-ai-client`
3. Look for log message: "LLM Inference Complete"
4. Verify attributes:
   - `llm.model`
   - `llm.success`
   - `trace.span_id`
   - `rum.session_id`

### 6.4 Check Dashboard

1. Open your imported dashboard
2. Verify widgets are populating with data:
   - Total requests counter
   - Average latency
   - Token consumption
   - Cost tracking
   - Log streams

### 6.5 Test Monitor

**Trigger High Latency Alert**:

```javascript
// In browser console, simulate slow request
// This will be tracked but won't actually call API
trackLLMRequestAPM({
  model: 'gemini-2.0-flash',
  latency: 6000, // Above 5000ms threshold
  inputTokens: 100,
  outputTokens: 100,
  temperature: 0.7,
  maxTokens: 1000,
  success: true,
  promptLength: 50,
  responseLength: 100,
  promptCategory: 'testing',
  toxicityScore: 0.01,
  coherenceScore: 0.95,
  hallucinationRisk: 0.1
});
```

**Check Monitor**:
1. Go to [app.datadoghq.com/monitors/manage](https://app.datadoghq.com/monitors/manage)
2. Find "High LLM Latency Spike" monitor
3. Wait 5 minutes for evaluation
4. Verify alert triggers (if enough data points)

---

## 🔧 Step 7: Advanced Configuration

### 7.1 Enable Session Replay

**Already enabled** in `src/lib/datadog-apm.ts`:

```typescript
sessionReplayEnabled: true,
sessionReplaySampleRate: 100, // Record 100% of sessions
```

**To adjust**:
- Lower `sessionReplaySampleRate` to save costs (e.g., 20 for 20%)
- Set `trackUserInteractions: true` (already enabled)
- Configure privacy: `privacy: "mask-user-input"` (already set)

### 7.2 Add Custom Tags

Edit `src/lib/datadog-apm.ts`:

```typescript
globalContexts: {
  env: import.meta.env.VITE_DATADOG_ENV || 'production',
  version: '1.0.0', // Your app version
  team: 'observai-engineering',
  product: 'llm-observability',
  // Add custom tags here
}
```

### 7.3 Configure APM (Server-Side)

**If you have a backend** (Node.js/Express):

```bash
# Install dd-trace
npm install dd-trace --save

# Add to your server entry point (before any imports)
# server.js
import tracer from 'dd-trace';
tracer.init({
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || 8126,
  service: 'observai-hub-api',
  env: process.env.DD_ENV || 'production',
  version: '1.0.0',
  logInjection: true
});

// Rest of your imports and code
import express from 'express';
```

### 7.4 Set Up Distributed Tracing

**Connect frontend RUM to backend APM**:

1. Frontend already configured with `allowedTracingUrls`
2. Backend needs to return trace context headers:

```javascript
// Express middleware
app.use((req, res, next) => {
  const span = tracer.scope().active();
  if (span) {
    res.set('x-datadog-trace-id', span.context().toTraceId());
    res.set('x-datadog-parent-id', span.context().toSpanId());
  }
  next();
});
```

---

## 🎓 Step 8: Best Practices

### 8.1 Cost Optimization

**RUM Costs**:
- Session replay: Most expensive (reduce sample rate if needed)
- Custom actions: Moderate cost (you're within limits)
- Page views: Low cost

**Recommendations**:
```typescript
// For production, consider:
sessionReplaySampleRate: 20, // 20% of sessions
trackUserInteractions: true, // Keep enabled
trackFrustrations: true, // Keep enabled
trackResources: false, // Disable if not needed
```

### 8.2 Security Best Practices

✅ **Never log sensitive data**:
```typescript
// Already implemented in datadog-apm.ts
// We log prompt length, not full prompt content
'llm.prompt.length': params.promptLength,
// NOT: 'llm.prompt.content': params.prompt (sensitive!)
```

✅ **Use secure variables**:
- API keys in Synthetic tests: Use global secure variables
- Environment variables: Never commit `.env` to git
- Client tokens: Use `VITE_` prefix for Vite apps

✅ **Enable privacy controls**:
```typescript
// Already enabled
privacy: "mask-user-input", // Mask form inputs in session replay
```

### 8.3 Alerting Best Practices

**Monitor Configuration**:
- ✅ Set appropriate thresholds (not too sensitive)
- ✅ Add recovery notifications
- ✅ Include runbook links
- ✅ Tag by team/service
- ✅ Set priority levels

**Notification Channels**:
- Critical alerts → PagerDuty
- Warning alerts → Slack
- Info alerts → Email
- Security alerts → Dedicated security channel

### 8.4 Dashboard Best Practices

✅ **Use template variables**:
```json
"template_variables": [
  {
    "name": "model",
    "prefix": "llm.model",
    "available_values": ["gemini-2.0-flash", "gemini-pro"],
    "default": "*"
  }
]
```

✅ **Add links to related views**:
- Dashboard → Monitors
- Dashboard → Logs
- Dashboard → RUM Sessions
- Dashboard → APM Traces

✅ **Use conditional formatting**:
```json
"conditional_formats": [
  {"comparator": ">", "value": 5, "palette": "white_on_red"},
  {"comparator": ">", "value": 2, "palette": "white_on_yellow"},
  {"comparator": "<=", "value": 2, "palette": "white_on_green"}
]
```

---

## 🐛 Troubleshooting

### Issue: No data in dashboard

**Check**:
1. ✅ Application is deployed and running
2. ✅ Users are making requests
3. ✅ Browser console shows RUM initialized
4. ✅ Datadog credentials are correct in `.env`
5. ✅ Service name matches: `observai-hub`

**Debug**:
```javascript
// In browser console
datadogRum.getInternalContext()
// Should show applicationId, sessionId, etc.
```

### Issue: Monitors not triggering

**Check**:
1. ✅ Enough data points (need 5+ minutes of data)
2. ✅ Query syntax is correct
3. ✅ Threshold is set appropriately
4. ✅ Monitor is not muted

**Debug**:
```bash
# Test monitor query manually
# Go to Metrics Explorer in Datadog
# Run query: avg:rum.action.llm_inference.latency{*}
```

### Issue: Synthetic test failing

**Check**:
1. ✅ API key is correct and active
2. ✅ Global variable `API_KEY` is set
3. ✅ Vertex AI API is accessible
4. ✅ Request format matches Gemini API spec

**Debug**:
```bash
# Test API manually
curl -X POST \
  https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello"}]
    }]
  }'
```

### Issue: Missing attributes in logs

**Check**:
1. ✅ `trackLLMRequestAPM()` is being called
2. ✅ All parameters are passed correctly
3. ✅ Datadog Logs initialized: `datadogLogs.logger`

**Debug**:
```typescript
// Add console.log in datadog-apm.ts
export function trackLLMRequestAPM(params) {
  console.log('Tracking LLM request:', params);
  // ... rest of function
}
```

---

## 📚 Additional Resources

### Datadog Documentation
- [RUM Setup Guide](https://docs.datadoghq.com/real_user_monitoring/browser/)
- [Log Management](https://docs.datadoghq.com/logs/)
- [APM & Distributed Tracing](https://docs.datadoghq.com/tracing/)
- [Synthetic Monitoring](https://docs.datadoghq.com/synthetics/)
- [Monitors](https://docs.datadoghq.com/monitors/)

### ObservAI Documentation
- [README.md](../README.md) - Project overview
- [DATADOG_NOTEBOOK.md](./DATADOG_NOTEBOOK.md) - Complete story
- [JUDGE_EVALUATION_GUIDE.md](./JUDGE_EVALUATION_GUIDE.md) - Judge guide

### Support
- **GitHub Issues**: [Repository Issues](https://github.com/your-repo/observability-hub/issues)
- **Email**: support@yourcompany.com
- **Discord**: [Join our community](#)

---

## ✅ Checklist

Before submitting for competition, ensure:

- [ ] `.env` file configured with all API keys
- [ ] Dashboard imported to Datadog account
- [ ] All 8 monitors imported and configured
- [ ] Synthetic test created and running
- [ ] Application deployed to production
- [ ] Test requests made and data flowing
- [ ] Dashboard widgets showing data
- [ ] Monitors able to trigger
- [ ] Session replay enabled and working
- [ ] Documentation reviewed and complete

---

## 🎉 You're Done!

Your ObservAI Hub is now fully integrated with Datadog!

**Next Steps**:
1. Make test requests through the UI
2. Watch metrics flow into Datadog
3. Review dashboard for insights
4. Test alert triggering
5. Share with judges!

---

<p align="center">
  <strong>Happy Monitoring! 📊</strong>
</p>
