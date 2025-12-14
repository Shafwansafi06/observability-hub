# ObservAI SDK - Setup & Deployment Guide

This guide walks you through setting up the complete ObservAI tracking pipeline.

## 📋 Prerequisites

- Supabase project (database already migrated with `001_initial_schema.sql`)
- Google Cloud Platform account with Vertex AI API enabled
- Node.js 18+ or Deno 1.30+
- npm/yarn/pnpm

## 🚀 Quick Setup (5 minutes)

### Step 1: Deploy Edge Function

```bash
cd /home/shafwan-safi/Desktop/observability-hub

# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref nztdwsnmttwwjticuphi

# Deploy the edge function
supabase functions deploy track-llm --no-verify-jwt

# Set environment variables for the function
supabase secrets set SUPABASE_URL=https://nztdwsnmttwwjticuphi.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 2: Build the SDK

```bash
cd sdk

# Install dependencies
npm install

# Build the SDK
npm run build

# The dist/ folder now contains the compiled SDK
```

### Step 3: Test Locally

Create a test file:

```typescript
// test.ts
import { ObservAIClient } from './sdk/dist/index.js';

const client = new ObservAIClient({
  apiKey: 'YOUR_VERTEX_AI_KEY',
  endpoint: 'https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm',
  userId: 'test-user',
  projectName: 'sdk-test',
  debug: true
});

const result = await client.generateContent(
  'gemini-2.5-flash',
  'What is the meaning of life?'
);

console.log('Response:', result.response.text());
console.log('Tracking:', result.tracking);

await client.dispose();
```

Run it:
```bash
tsx test.ts
```

Check your ObservAI dashboard - you should see the request!

## 📦 Publishing to NPM (Optional)

### Prepare for Publishing

1. **Update package.json**:
```json
{
  "name": "@your-org/observai-sdk",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/Shafwansafi06/observability-hub"
  }
}
```

2. **Create `.npmignore`**:
```
src/
tsconfig.json
*.ts
!*.d.ts
node_modules/
.git/
```

3. **Publish**:
```bash
cd sdk
npm login
npm publish --access public
```

### Using Your Published Package

```bash
npm install @your-org/observai-sdk
```

## 🔧 Local Development Setup

### Option 1: Use npm link (Recommended for development)

```bash
# In SDK directory
cd sdk
npm link

# In your project
cd /path/to/your/project
npm link @observai/sdk
```

Now you can use it like:
```typescript
import { ObservAIClient } from '@observai/sdk';
```

### Option 2: Use Relative Path

```typescript
import { ObservAIClient } from '../observability-hub/sdk/dist/index.js';
```

### Option 3: Copy to node_modules

```bash
cp -r sdk/dist /your-project/node_modules/@observai/sdk
```

## 🌐 Deploying in Different Environments

### 1. Vercel/Netlify Frontend

**.env.local**:
```bash
VITE_VERTEX_AI_API_KEY=your_key
VITE_OBSERVAI_ENDPOINT=https://your-supabase.supabase.co/functions/v1/track-llm
VITE_OBSERVAI_USER_ID=user-123
```

**Usage**:
```typescript
const client = new ObservAIClient({
  apiKey: import.meta.env.VITE_VERTEX_AI_API_KEY,
  endpoint: import.meta.env.VITE_OBSERVAI_ENDPOINT,
  userId: import.meta.env.VITE_OBSERVAI_USER_ID,
  projectName: 'production'
});
```

### 2. Node.js Backend (Express/NestJS)

**.env**:
```bash
VERTEX_AI_API_KEY=your_key
OBSERVAI_ENDPOINT=https://your-supabase.supabase.co/functions/v1/track-llm
NODE_ENV=production
```

**server.ts**:
```typescript
import { ObservAIClient } from '@observai/sdk';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  endpoint: process.env.OBSERVAI_ENDPOINT!,
  userId: 'backend-server',
  projectName: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
  batchMode: {
    enabled: true,
    maxBatchSize: 20,
    maxWaitMs: 5000
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await client.dispose();
  process.exit(0);
});
```

### 3. AWS Lambda

```typescript
import { ObservAIClient } from '@observai/sdk';

// Initialize outside handler for reuse
const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  endpoint: process.env.OBSERVAI_ENDPOINT!,
  userId: 'lambda-function',
  batchMode: { enabled: false } // Disable batching in serverless
});

export const handler = async (event) => {
  const result = await client.generateContent(
    'gemini-2.5-flash',
    event.prompt
  );

  // Flush before returning (important in serverless!)
  await client.flushBatch();

  return {
    statusCode: 200,
    body: JSON.stringify({
      response: result.response.text(),
      tracking: result.tracking
    })
  };
};
```

### 4. Docker Container

**Dockerfile**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "server.js"]
```

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - VERTEX_AI_API_KEY=${VERTEX_AI_API_KEY}
      - OBSERVAI_ENDPOINT=${OBSERVAI_ENDPOINT}
      - OBSERVAI_USER_ID=docker-app
    ports:
      - "3000:3000"
```

## 🔐 Security Best Practices

### 1. Never Commit API Keys

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
```

### 2. Use Environment-Specific Keys

```typescript
const getApiKey = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PROD_VERTEX_AI_KEY;
  }
  return process.env.DEV_VERTEX_AI_KEY;
};

const client = new ObservAIClient({
  apiKey: getApiKey(),
  // ...
});
```

### 3. Implement Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/ai', limiter);
```

### 4. Sanitize User Input

```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizedPrompt = DOMPurify.sanitize(userInput);

const result = await client.generateContent(
  'gemini-2.5-flash',
  sanitizedPrompt
);
```

## 📊 Monitoring & Alerts

### Configure Anomaly Detection

The edge function automatically creates alerts for:
- High latency (>5000ms)
- High cost (>$0.10 per request)
- High toxicity (>0.7 score)
- Request failures

You can customize thresholds in `supabase/functions/track-llm/index.ts`.

### View Metrics

1. **Real-time Dashboard**: 
   - Navigate to `http://localhost:5173/dashboard` (dev)
   - Or your production URL

2. **Supabase Dashboard**:
   - SQL Editor: Run analytics queries
   - Table Editor: View raw data
   - Logs: Check edge function logs

3. **Datadog Integration** (Optional):
   - Already configured in your project
   - Metrics auto-forwarded

## 🧪 Testing

### Unit Tests

```bash
cd sdk
npm install --save-dev vitest
```

**sdk/src/utils.test.ts**:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCost, estimateTokens } from './utils';

describe('Utils', () => {
  it('calculates cost correctly', () => {
    const cost = calculateCost('gemini-2.5-flash', 1000, 500);
    expect(cost).toBe(0.000225);
  });

  it('estimates tokens', () => {
    const tokens = estimateTokens('Hello, world!');
    expect(tokens).toBeGreaterThan(0);
  });
});
```

Run tests:
```bash
npm test
```

### Integration Tests

```typescript
// test-integration.ts
import { ObservAIClient } from '@observai/sdk';

async function testIntegration() {
  const client = new ObservAIClient({
    apiKey: process.env.VERTEX_AI_API_KEY!,
    endpoint: process.env.OBSERVAI_ENDPOINT!,
    userId: 'integration-test',
    debug: true
  });

  try {
    // Test 1: Basic request
    const result = await client.generateContent(
      'gemini-2.5-flash',
      'Test prompt'
    );
    console.assert(result.tracking?.tracked === true, 'Tracking failed');

    // Test 2: Batch mode
    client.updateConfig({
      batchMode: { enabled: true, maxBatchSize: 2 }
    });

    await client.generateContent('gemini-2.5-flash', 'Test 1');
    await client.generateContent('gemini-2.5-flash', 'Test 2');
    await client.flushBatch();

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.dispose();
  }
}

testIntegration();
```

## 🐛 Debugging

### Enable Debug Mode

```typescript
const client = new ObservAIClient({
  apiKey: 'your_key',
  debug: true // Enables console logging
});
```

### Check Edge Function Logs

```bash
supabase functions logs track-llm --limit 100
```

### Verify Database Insertion

```sql
-- Check recent requests
SELECT * FROM llm_requests 
ORDER BY created_at DESC 
LIMIT 10;

-- Check alerts
SELECT * FROM alerts 
WHERE status = 'active' 
ORDER BY created_at DESC;
```

### Test Edge Function Directly

```bash
curl -X POST https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "requests": [{
      "request_id": "test-123",
      "user_id": "test-user",
      "model": "gemini-2.5-flash",
      "prompt": "Test",
      "response": "Test response",
      "latency_ms": 1000,
      "tokens_in": 10,
      "tokens_out": 20,
      "tokens_total": 30,
      "cost_usd": 0.00001,
      "success": true,
      "retry_count": 0,
      "timestamp": "2025-12-15T00:00:00Z"
    }],
    "batch_id": "batch-test",
    "timestamp": "2025-12-15T00:00:00Z"
  }'
```

## 🔄 Updates & Maintenance

### Update SDK

```bash
cd sdk
npm run build
npm version patch # or minor, major
npm publish
```

### Update Edge Function

```bash
# Make changes to supabase/functions/track-llm/index.ts
supabase functions deploy track-llm
```

### Database Migrations

```bash
# Create new migration
supabase migration new add_new_feature

# Apply migrations
supabase db push
```

## 📚 Additional Resources

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ObservAI Dashboard Repo](https://github.com/Shafwansafi06/observability-hub)

## 🤝 Support

Need help? Reach out:
- GitHub Issues: [Report a bug](https://github.com/Shafwansafi06/observability-hub/issues)
- Email: support@observai.dev
- Discord: [Join community](https://discord.gg/observai)

---

**Next Steps**: 
1. ✅ Deploy edge function
2. ✅ Build SDK
3. ✅ Test integration
4. ✅ Use in your projects
5. ✅ Monitor in dashboard
