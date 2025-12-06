/**
 * Vertex AI Client for Vite + React
 * Browser-side client for making predictions via backend API
 */

export interface PredictionRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  user_id?: string;
  session_id?: string;
}

export interface PredictionResponse {
  success: boolean;
  requestId: string;
  prediction?: {
    text: string;
    confidence?: number;
  };
  metadata?: {
    latency: number;
    modelId?: string;
    modelDisplayName?: string;
  };
  error?: string;
}

export class VertexAIClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = '/api/vertex-ai', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const data: PredictionResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[Vertex AI Client] Prediction failed:', error);
      throw error;
    }
  }

  async *predictStream(
    request: PredictionRequest
  ): AsyncGenerator<string, void, unknown> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/predict/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  yield parsed.text;
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('[Vertex AI Client] Streaming failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let vertexAIClient: VertexAIClient | null = null;

export function getVertexAIClient(): VertexAIClient {
  if (!vertexAIClient) {
    const baseUrl = import.meta.env.VITE_VERTEX_AI_API_URL || '/api/vertex-ai';
    const apiKey = import.meta.env.VITE_VERTEX_AI_API_KEY;
    vertexAIClient = new VertexAIClient(baseUrl, apiKey);
  }
  return vertexAIClient;
}

// Re-export from vertex-ai folder
export { useVertexAI } from './vertex-ai/useVertexAI';
export { vertexAI } from './vertex-ai/client';
export type { VertexAIMetrics } from './vertex-ai/client';
