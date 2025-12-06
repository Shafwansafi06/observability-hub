/**
 * Vertex AI Backend API Server
 * Express server for handling Vertex AI predictions
 * Can be deployed to Vercel, Netlify, or any Node.js environment
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import rateLimit from 'express-rate-limit';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api/vertex-ai', limiter);

// Configuration
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const region = process.env.VERTEX_AI_REGION || 'us-central1';
const endpointId = process.env.VERTEX_AI_ENDPOINT_ID;

if (!projectId || !endpointId) {
  console.error('Missing required environment variables: GOOGLE_CLOUD_PROJECT, VERTEX_AI_ENDPOINT_ID');
  process.exit(1);
}

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const predictUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/${endpointId}:predict`;

// Circuit Breaker
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }
}

const circuitBreaker = new CircuitBreaker();

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    circuitBreaker: circuitBreaker.getState(),
    timestamp: new Date().toISOString(),
  });
});

// Batch prediction endpoint
app.post('/api/vertex-ai/predict', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { prompt, max_tokens, temperature, top_p, top_k, user_id, session_id } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check circuit breaker
    if (circuitBreaker.getState() === 'OPEN') {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    // Make prediction
    const prediction = await circuitBreaker.execute(async () => {
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      const response = await fetch(predictUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              prompt,
              max_tokens: max_tokens || 1000,
              temperature: temperature || 0.7,
              top_p: top_p || 0.9,
              top_k: top_k || 40,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    });

    const latency = Date.now() - startTime;

    res.json({
      success: true,
      requestId,
      prediction: prediction.predictions[0],
      metadata: {
        latency,
        modelId: prediction.deployedModelId,
        modelDisplayName: prediction.modelDisplayName,
      },
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;

    console.error('[API] Prediction failed:', error);

    res.status(500).json({
      success: false,
      requestId,
      error: error.message || 'Internal server error',
      metadata: {
        latency,
      },
    });
  }
});

// Streaming prediction endpoint
app.post('/api/vertex-ai/predict/stream', async (req: Request, res: Response) => {
  try {
    const { prompt, max_tokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get auth token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const streamUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/${endpointId}:streamPredict`;

    const response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt, max_tokens, temperature }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Streaming failed: ${response.status}`);
    }

    // Stream response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } finally {
      reader.releaseLock();
    }
  } catch (error: any) {
    console.error('[API] Streaming failed:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(port, () => {
  console.log(`🚀 Vertex AI API server running on http://localhost:${port}`);
  console.log(`Project: ${projectId}`);
  console.log(`Region: ${region}`);
  console.log(`Endpoint: ${endpointId}`);
});
