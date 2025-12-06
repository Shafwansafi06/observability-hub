# Vertex AI Integration for Vite + React

## 🎯 Overview

Complete Vertex AI integration for **Vite + React** applications with:
- Client-side React hooks
- Backend API server (Express)
- Batch and streaming predictions
- Circuit breaker & rate limiting
- Full TypeScript support

---

## 📦 Project Structure

```
src/
├── lib/
│   └── vertex-ai-client.ts         # Browser client for API calls
├── hooks/
│   └── use-vertex-ai.ts            # React hooks (batch + streaming)
└── components/
    └── vertex-ai/
        └── VertexAIDemo.tsx        # Example component

vertex-ai/
└── server/
    ├── api-server.ts               # Express API server
    └── package.json                # Server dependencies
```

---

## 🚀 Quick Start

### 1. Install Dependencies

#### Frontend (Vite + React)
Already included in main `package.json` - no additional dependencies needed!

#### Backend API Server
```bash
cd vertex-ai/server
npm install
```

### 2. Configure Environment

Create `.env` file in project root:

```bash
# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
VERTEX_AI_REGION=us-central1
VERTEX_AI_ENDPOINT_ID=1234567890
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# API Server
PORT=3001

# Frontend (optional - defaults to /api/vertex-ai)
VITE_VERTEX_AI_API_URL=http://localhost:3001/api/vertex-ai
```

### 3. Start Backend API Server

```bash
cd vertex-ai/server
npm run dev
```

Server will run on `http://localhost:3001`

### 4. Start Vite Dev Server

```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

### 5. Use in Your React Components

```tsx
import { VertexAIDemo } from '@/components/vertex-ai/VertexAIDemo';

function App() {
  return <VertexAIDemo />;
}
```

---

## 💻 Usage Examples

### Basic Prediction (Batch)

```tsx
import { useVertexAIPrediction } from '@/hooks/use-vertex-ai';

function MyComponent() {
  const { predict, loading, data, error } = useVertexAIPrediction();

  const handlePredict = async () => {
    const response = await predict({
      prompt: 'Explain machine learning',
      max_tokens: 500,
      temperature: 0.7,
    });
    
    console.log(response.prediction?.text);
  };

  return (
    <div>
      <button onClick={handlePredict} disabled={loading}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {data && <p>{data.prediction?.text}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Streaming Prediction

```tsx
import { useVertexAIStream } from '@/hooks/use-vertex-ai';

function StreamingComponent() {
  const { predictStream, loading, text, error } = useVertexAIStream({
    onChunk: (chunk) => console.log('Received:', chunk),
  });

  const handleStream = async () => {
    await predictStream({
      prompt: 'Write a story about AI',
      max_tokens: 1000,
    });
  };

  return (
    <div>
      <button onClick={handleStream} disabled={loading}>
        {loading ? 'Streaming...' : 'Stream'}
      </button>
      <div className="prose">
        {text}
      </div>
    </div>
  );
}
```

### Direct Client Usage

```tsx
import { getVertexAIClient } from '@/lib/vertex-ai-client';

// Make a prediction
const client = getVertexAIClient();
const response = await client.predict({
  prompt: 'Hello, AI!',
  max_tokens: 100,
});

console.log(response.prediction?.text);
```

---

## 🔧 API Endpoints

### POST `/api/vertex-ai/predict`

Batch prediction endpoint.

**Request:**
```json
{
  "prompt": "Explain quantum computing",
  "max_tokens": 1000,
  "temperature": 0.7,
  "top_p": 0.9,
  "top_k": 40,
  "user_id": "optional-user-id",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "uuid",
  "prediction": {
    "text": "Quantum computing is...",
    "confidence": 0.95
  },
  "metadata": {
    "latency": 250,
    "modelId": "1234567890",
    "modelDisplayName": "gpt4-turbo"
  }
}
```

### POST `/api/vertex-ai/predict/stream`

Streaming prediction endpoint (Server-Sent Events).

**Request:** Same as batch

**Response:** SSE stream
```
data: {"text": "Quantum"}
data: {"text": " computing"}
data: {"text": " is..."}
data: [DONE]
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "circuitBreaker": "CLOSED",
  "timestamp": "2025-12-04T..."
}
```

---

## 🏗️ Architecture

```
React Component
    │
    ├─► useVertexAIPrediction() / useVertexAIStream()
    │       │
    │       └─► VertexAIClient (Browser)
    │               │
    │               └─► fetch() to Backend API
    │
Backend API Server (Express)
    │
    ├─► Rate Limiter (100 req/min)
    ├─► Circuit Breaker (5 failure threshold)
    │
    └─► Google Cloud Vertex AI
            │
            └─► Model Endpoint (Autoscaling 2-20 replicas)
```

---

## 🔐 Security

### API Server Features:
- ✅ Rate limiting (100 requests/minute per IP)
- ✅ Circuit breaker (fails fast on 5 consecutive errors)
- ✅ CORS protection
- ✅ Request validation
- ✅ Google Auth via service account

### Best Practices:
1. **Never expose service account keys** in frontend code
2. **Always use backend API** for Vertex AI calls
3. **Add authentication** to API endpoints (JWT, API keys)
4. **Enable HTTPS** in production
5. **Use environment variables** for sensitive config

---

## 🚢 Deployment

### Deploy Backend API

#### Option 1: Vercel Serverless Function

Create `api/vertex-ai/predict.ts`:
```ts
import { VercelRequest, VercelResponse } from '@vercel/node';
// ... implement handler
```

#### Option 2: Google Cloud Run

```bash
# Build container
docker build -t gcr.io/$PROJECT_ID/vertex-ai-api ./vertex-ai/server

# Push to GCR
docker push gcr.io/$PROJECT_ID/vertex-ai-api

# Deploy
gcloud run deploy vertex-ai-api \
  --image gcr.io/$PROJECT_ID/vertex-ai-api \
  --region us-central1 \
  --allow-unauthenticated
```

#### Option 3: Traditional Node.js Server

```bash
cd vertex-ai/server
npm run build
node dist/api-server.js
```

### Deploy Frontend (Vite)

```bash
npm run build
# Deploy dist/ folder to:
# - Vercel
# - Netlify
# - Google Cloud Storage + CDN
# - Any static hosting
```

Update `VITE_VERTEX_AI_API_URL` to production API URL.

---

## 📊 Monitoring

The API server includes:
- Request ID tracking
- Latency measurement
- Circuit breaker state monitoring
- Error logging

Integrate with Datadog (already in your project):

```ts
// In api-server.ts, add after successful prediction:
trackLLMEvent({
  model: prediction.modelDisplayName,
  prompt,
  completion: prediction.predictions[0].text,
  latency,
  userId: user_id,
});
```

---

## 🧪 Testing

```bash
# Test batch prediction
curl -X POST http://localhost:3001/api/vertex-ai/predict \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello AI", "max_tokens": 50}'

# Test streaming
curl -N http://localhost:3001/api/vertex-ai/predict/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Tell me a story", "max_tokens": 100}'

# Health check
curl http://localhost:3001/api/health
```

---

## 🎨 UI Components

Included demo component with:
- ✅ Batch and streaming mode toggle
- ✅ Loading states
- ✅ Error handling
- ✅ Response display with metadata
- ✅ Request ID tracking
- ✅ shadcn/ui components

---

## 🔧 Troubleshooting

### "Cannot find module 'google-auth-library'"

The server dependencies are separate. Install them:
```bash
cd vertex-ai/server
npm install
```

### "Circuit breaker is OPEN"

The API has detected 5 consecutive failures. Wait 60 seconds for automatic recovery, or restart the server.

### CORS errors

Update CORS configuration in `api-server.ts`:
```ts
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite dev server
}));
```

### Rate limit exceeded

Default: 100 requests/minute. Increase in `api-server.ts`:
```ts
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // Increase limit
});
```

---

## 📚 Additional Resources

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [React Hooks Guide](https://react.dev/reference/react)
- [Vite Configuration](https://vitejs.dev/config/)
- [Express.js Documentation](https://expressjs.com/)

---

## ✅ Checklist

- [x] Client-side React hooks
- [x] Browser-safe API client
- [x] Express API server
- [x] Rate limiting
- [x] Circuit breaker
- [x] Streaming support
- [x] TypeScript types
- [x] Example component
- [x] Error handling
- [x] Production deployment guide

---

**Built for Vite + React. Production-ready. Deploy in minutes.** 🚀
