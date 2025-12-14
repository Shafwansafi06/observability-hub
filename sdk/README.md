# ObservAI SDK

> Automatic LLM tracking and observability for Vertex AI / Gemini models

The ObservAI SDK provides seamless integration with your existing projects to automatically track all LLM usage, analyze quality metrics, calculate costs, and send data to your ObservAI dashboard.

## Features

✨ **Zero Configuration** - Drop-in replacement for `@google/generative-ai`  
📊 **Automatic Tracking** - Every request is tracked with detailed metrics  
💰 **Cost Analysis** - Real-time cost calculation per request  
🎯 **Quality Metrics** - Coherence, toxicity, hallucination risk analysis  
⚡ **Performance Monitoring** - Latency tracking and anomaly detection  
🔄 **Batch Mode** - Efficient data transmission with configurable batching  
🛡️ **Error Resilience** - Auto-retry with exponential backoff  
🔒 **Privacy First** - Sanitizes sensitive data before transmission  

## Installation

```bash
npm install @observai/sdk @google/generative-ai
# or
yarn add @observai/sdk @google/generative-ai
# or
pnpm add @observai/sdk @google/generative-ai
```

## Quick Start

### Basic Usage

```typescript
import { ObservAIClient } from '@observai/sdk';

// Initialize client
const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY,
  userId: 'user-123',
  projectName: 'my-awesome-app'
});

// Generate content (automatically tracked)
const result = await client.generateContent(
  'gemini-2.5-flash',
  'Explain quantum computing in simple terms'
);

console.log(result.response.text());
console.log('Tracking:', result.tracking);
// Output:
// {
//   request_id: 'req_1702...',
//   latency_ms: 1234,
//   tokens_used: 567,
//   cost_estimate_usd: 0.000043,
//   tracked: true
// }
```

### With Configuration

```typescript
const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY,
  endpoint: 'https://your-supabase.supabase.co/functions/v1/track-llm',
  userId: 'user-123',
  projectName: 'production-app',
  debug: true, // Enable debug logging
  autoRetry: true, // Auto-retry on failure
  batchMode: {
    enabled: true,
    maxBatchSize: 10, // Send every 10 requests
    maxWaitMs: 5000 // Or every 5 seconds
  },
  metadata: {
    environment: 'production',
    version: '1.0.0'
  }
});
```

### Advanced Usage

```typescript
// Custom generation config
const result = await client.generateContent(
  'gemini-2.5-pro',
  'Write a haiku about AI',
  {
    config: {
      temperature: 0.9,
      maxTokens: 100,
      topP: 0.95,
      category: 'content_creation', // Custom category
      sessionId: 'chat-session-123', // Track conversation
      disableTracking: false // Explicitly enable/disable
    },
    metadata: {
      feature: 'poem-generator',
      userTier: 'premium'
    }
  }
);

// Access underlying model
const model = client.getModel('gemini-2.5-flash');
const chat = model.startChat();

// Session management
const sessionId = client.getSessionId();
const newSessionId = client.newSession();

// Manual batch flush
await client.flushBatch();

// Cleanup on shutdown
await client.dispose();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | **required** | Your Vertex AI API key |
| `endpoint` | string | Production URL | ObservAI ingestion endpoint |
| `userId` | string | 'anonymous' | User identifier for tracking |
| `projectName` | string | 'default' | Project name for grouping |
| `debug` | boolean | false | Enable debug logging |
| `autoRetry` | boolean | true | Auto-retry failed requests |
| `batchMode.enabled` | boolean | false | Enable batch processing |
| `batchMode.maxBatchSize` | number | 10 | Max requests per batch |
| `batchMode.maxWaitMs` | number | 5000 | Max wait time before send |
| `metadata` | object | {} | Custom metadata for all requests |

## Tracked Metrics

Every request automatically tracks:

### Performance Metrics
- ✅ Latency (ms)
- ✅ Token usage (input/output/total)
- ✅ Cost calculation (USD)
- ✅ Success/failure status
- ✅ Error details (if any)

### Quality Metrics
- ✅ Coherence score (0.0-1.0)
- ✅ Toxicity score (0.0-1.0)
- ✅ Hallucination risk (0.0-1.0)
- ✅ Sentiment score (-1.0 to 1.0)

### Context
- ✅ Request ID (unique)
- ✅ Session ID (for conversations)
- ✅ Model name
- ✅ Prompt category
- ✅ Generation parameters
- ✅ User agent
- ✅ Timestamp
- ✅ Custom metadata

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { ObservAIClient } from '@observai/sdk';

const app = express();
const aiClient = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY,
  projectName: 'express-api',
  userId: 'api-server'
});

app.post('/api/chat', async (req, res) => {
  try {
    const result = await aiClient.generateContent(
      'gemini-2.5-flash',
      req.body.message,
      {
        config: { sessionId: req.session.id },
        metadata: { userId: req.user.id }
      }
    );

    res.json({
      response: result.response.text(),
      tracking: result.tracking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await aiClient.dispose();
  process.exit(0);
});
```

### Next.js API Route

```typescript
// app/api/generate/route.ts
import { ObservAIClient } from '@observai/sdk';
import { NextResponse } from 'next/server';

const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  projectName: 'nextjs-app'
});

export async function POST(request: Request) {
  const { prompt, userId } = await request.json();

  const result = await client.generateContent(
    'gemini-2.5-flash',
    prompt,
    { metadata: { userId } }
  );

  return NextResponse.json({
    text: result.response.text(),
    tracking: result.tracking
  });
}
```

### React Component

```typescript
import { useState } from 'react';
import { ObservAIClient } from '@observai/sdk';

const client = new ObservAIClient({
  apiKey: import.meta.env.VITE_VERTEX_AI_API_KEY,
  projectName: 'react-app',
  userId: 'current-user'
});

function ChatComponent() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (prompt: string) => {
    setLoading(true);
    try {
      const result = await client.generateContent(
        'gemini-2.5-flash',
        prompt
      );
      setResponse(result.response.text());
      console.log('Cost:', result.tracking?.cost_estimate_usd);
    } finally {
      setLoading(false);
    }
  };

  return (/* your JSX */);
}
```

### Python (via REST API)

While the SDK is JavaScript/TypeScript, you can use the REST API directly:

```python
import requests
import json

def track_llm_request(data):
    response = requests.post(
        'https://your-supabase.supabase.co/functions/v1/track-llm',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        },
        json={
            'requests': [data],
            'batch_id': f'batch_{time.time()}',
            'timestamp': datetime.utcnow().isoformat()
        }
    )
    return response.json()
```

## Architecture

```
┌─────────────────────────────────────┐
│      Your Application               │
│  (Any JS/TS project)                │
│                                     │
│  import { ObservAIClient }          │
│  client.generateContent(...)        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      ObservAI SDK                   │
│  • Wraps @google/generative-ai     │
│  • Auto-tracks metrics              │
│  • Analyzes quality                 │
│  • Calculates costs                 │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Supabase Edge Function            │
│   /functions/v1/track-llm           │
│  • Validates data                   │
│  • Detects anomalies                │
│  • Creates alerts                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Supabase PostgreSQL               │
│  • llm_requests table               │
│  • alerts table                     │
│  • RLS policies                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   ObservAI Dashboard                │
│  • Real-time metrics                │
│  • Cost analysis                    │
│  • Alert management                 │
│  • Historical analytics             │
└─────────────────────────────────────┘
```

## Utilities

The SDK also exports useful utility functions:

```typescript
import {
  calculateCost,
  estimateTokens,
  analyzeQuality,
  categorizePrompt,
  generateRequestId,
  sanitizeText
} from '@observai/sdk';

// Calculate cost
const cost = calculateCost('gemini-2.5-pro', 1000, 500);
console.log(`Cost: $${cost}`); // $0.003750

// Estimate tokens
const tokens = estimateTokens('Hello, world!');
console.log(`Tokens: ${tokens}`); // ~4

// Analyze quality
const quality = analyzeQuality(prompt, response);
console.log(quality);
// {
//   coherence: 0.85,
//   toxicity: 0.02,
//   hallucination_risk: 0.15,
//   sentiment: 0.3
// }

// Categorize prompt
const category = categorizePrompt('Translate this to Spanish');
console.log(category); // 'translation'
```

## Best Practices

### 1. Use Environment Variables
```typescript
const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  endpoint: process.env.OBSERVAI_ENDPOINT,
  userId: process.env.USER_ID
});
```

### 2. Enable Batch Mode for High Traffic
```typescript
const client = new ObservAIClient({
  apiKey: process.env.VERTEX_AI_API_KEY!,
  batchMode: {
    enabled: true,
    maxBatchSize: 20,
    maxWaitMs: 3000
  }
});
```

### 3. Use Session IDs for Conversations
```typescript
const sessionId = client.newSession();

for (const message of conversation) {
  await client.generateContent(model, message, {
    config: { sessionId }
  });
}
```

### 4. Add Contextual Metadata
```typescript
await client.generateContent(model, prompt, {
  metadata: {
    feature: 'chat',
    userId: user.id,
    tier: user.subscription,
    experimentId: 'ab-test-123'
  }
});
```

### 5. Cleanup on Application Shutdown
```typescript
process.on('SIGTERM', async () => {
  await client.dispose(); // Flush pending batches
  process.exit(0);
});
```

## Troubleshooting

### Tracking not appearing in dashboard

1. Check your endpoint URL is correct
2. Verify your API key has proper permissions
3. Enable debug mode: `debug: true`
4. Check browser/server console for errors
5. Ensure Supabase Edge Function is deployed

### High latency

1. Enable batch mode to reduce network calls
2. Increase `maxWaitMs` to send less frequently
3. Check your internet connection
4. Verify Supabase region is close to you

### Type errors

Ensure you have the correct peer dependencies:
```bash
npm install @google/generative-ai@^0.24.0
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

MIT © ObservAI

## Support

- 📧 Email: support@observai.dev
- 🐛 Issues: [GitHub Issues](https://github.com/Shafwansafi06/observability-hub/issues)
- 💬 Discord: [Join our community](https://discord.gg/observai)
- 📚 Docs: [docs.observai.dev](https://docs.observai.dev)
