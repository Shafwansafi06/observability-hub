/**
 * Vertex AI Client for Vite/React
 * Uses the Generative AI API with API Key authentication
 */

const API_KEY = import.meta.env.VITE_VERTEX_AI_API_KEY;
const BACKEND_ENDPOINT = import.meta.env.VITE_VERTEX_AI_ENDPOINT || 'http://localhost:3001';

export interface PredictionRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface PredictionResponse {
  text: string;
  tokens: number;
  latency: number;
  model: string;
}

export interface VertexAIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  tokensUsed: number;
}

class VertexAIClient {
  private metrics: VertexAIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    tokensUsed: 0,
  };

  /**
   * Make a prediction using Gemini API
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Use v1 API with gemini-2.0-flash model (or gemini-pro as fallback)
      const model = request.model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: request.prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: request.maxTokens || 1024,
            temperature: request.temperature || 0.7,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Prediction failed');
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokens = data.usageMetadata?.totalTokenCount || 0;

      // Update metrics
      this.metrics.successfulRequests++;
      this.metrics.tokensUsed += tokens;
      this.updateAverageLatency(latency);

      return {
        text,
        tokens,
        latency,
        model,
      };
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Stream a prediction response
   */
  async *predictStream(request: PredictionRequest): AsyncGenerator<string> {
    const model = request.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1024,
          temperature: request.temperature || 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Stream prediction failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse chunks from the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Analyze logs for anomalies using AI
   */
  async analyzeAnomalies(logs: string[]): Promise<{
    anomalies: Array<{
      log: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      explanation: string;
    }>;
    summary: string;
  }> {
    const prompt = `Analyze these log entries for anomalies and potential issues. Return a JSON response with anomalies found and a summary.

Logs:
${logs.slice(0, 50).join('\n')}

Response format:
{
  "anomalies": [
    {"log": "...", "severity": "low|medium|high|critical", "explanation": "..."}
  ],
  "summary": "..."
}`;

    const response = await this.predict({ prompt, maxTokens: 2048 });
    
    try {
      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback if parsing fails
    }

    return {
      anomalies: [],
      summary: response.text,
    };
  }

  /**
   * Get LLM performance metrics
   */
  async getLLMMetrics(): Promise<{
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    throughput: number;
    errorRate: number;
    tokenUsage: number;
  }> {
    // Simulated metrics based on actual usage
    const errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;

    return {
      latencyP50: this.metrics.averageLatency * 0.8,
      latencyP95: this.metrics.averageLatency * 1.5,
      latencyP99: this.metrics.averageLatency * 2,
      throughput: this.metrics.successfulRequests,
      errorRate,
      tokenUsage: this.metrics.tokensUsed,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): VertexAIMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      tokensUsed: 0,
    };
  }

  private updateAverageLatency(latency: number): void {
    const total = this.metrics.successfulRequests;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (total - 1) + latency) / total;
  }
}

// Export singleton instance
export const vertexAI = new VertexAIClient();
export default vertexAI;
