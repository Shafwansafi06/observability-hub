/**
 * Vertex AI Client for Vite/React
 * Two-Model Support: Gemini 2.5 Flash (Fast) and Gemini 2.5 Pro (Advanced)
 * Uses Vite proxy to avoid CORS issues
 */

const API_KEY = import.meta.env.VITE_VERTEX_AI_API_KEY;
const USE_PROXY = import.meta.env.DEV; // Use proxy in development

// Supported models with their capabilities and limits
export enum ModelType {
  TEXT_FAST = 'gemini-2.5-flash',               // 1K RPM, 1M TPM - Fast text generation
  TEXT_PRO = 'gemini-2.5-pro',                  // 150 RPM, 2M TPM - Advanced reasoning
}

export interface ModelConfig {
  name: string;
  type: 'text' | 'image';
  rpm: number;  // Requests per minute
  tpm: number;  // Tokens per minute
  rpd: number;  // Requests per day
  capabilities: string[];
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  [ModelType.TEXT_FAST]: {
    name: 'Gemini 2.5 Flash',
    type: 'text',
    rpm: 1000,
    tpm: 1_000_000,
    rpd: 10_000,
    capabilities: ['text-generation', 'fast-response', 'code-generation'],
  },
  [ModelType.TEXT_PRO]: {
    name: 'Gemini 2.5 Pro',
    type: 'text',
    rpm: 150,
    tpm: 2_000_000,
    rpd: 10_000,
    capabilities: ['advanced-reasoning', 'complex-tasks', 'long-context'],
  },
};

export interface PredictionRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: ModelType | string;
  // Image generation specific
  imageConfig?: {
    numberOfImages?: number;
    aspectRatio?: string;
    negativeSeed?: number;
  };
}

export interface PredictionResponse {
  text?: string;
  imageUrl?: string;
  tokens: number;
  latency: number;
  model: string;
  modelType: 'text' | 'image';
}

export interface VertexAIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  tokensUsed: number;
  // Per-model metrics
  modelUsage: Record<string, {
    requests: number;
    tokens: number;
    avgLatency: number;
  }>;
}

class VertexAIClient {
  private metrics: VertexAIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    tokensUsed: 0,
    modelUsage: {},
  };

  constructor() {
    if (!API_KEY) {
      throw new Error('VITE_VERTEX_AI_API_KEY is not configured');
    }
  }

  /**
   * Get the base URL for API requests (text models)
   */
  private getTextModelUrl(model: string): string {
    if (USE_PROXY) {
      return `/api/gemini/v1beta/models/${model}:generateContent`;
    } else {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    }
  }

  /**
   * Track model-specific metrics
   */
  private trackModelUsage(model: string, tokens: number, latency: number) {
    if (!this.metrics.modelUsage[model]) {
      this.metrics.modelUsage[model] = {
        requests: 0,
        tokens: 0,
        avgLatency: 0,
      };
    }

    const usage = this.metrics.modelUsage[model];
    usage.requests++;
    usage.tokens += tokens;
    usage.avgLatency = (usage.avgLatency * (usage.requests - 1) + latency) / usage.requests;
  }

  /**
   * Make a prediction using Gemini Text API
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const modelName = (request.model as ModelType) || ModelType.TEXT_FAST;

      // Text generation
      const url = this.getTextModelUrl(modelName as string);

      const response = await fetch(`${url}?key=${API_KEY}`, {
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
        throw new Error(error.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokens = data.usageMetadata?.totalTokenCount || 0;

      // Update metrics
      this.metrics.successfulRequests++;
      this.metrics.tokensUsed += tokens;
      this.updateAverageLatency(latency);
      this.trackModelUsage(modelName as string, tokens, latency);

      return {
        text,
        tokens,
        latency,
        model: modelName as string,
        modelType: 'text',
      };
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Stream a prediction response (text models only)
   */
  async *predictStream(request: PredictionRequest): AsyncGenerator<string> {
    const modelName = (request.model as ModelType) || ModelType.TEXT_FAST;
    const config = MODEL_CONFIGS[modelName as ModelType];

    if (config?.type !== 'text') {
      throw new Error('Streaming is only supported for text models');
    }

    const baseUrl = USE_PROXY 
      ? `/api/gemini/v1beta/models/${modelName}:streamGenerateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent`;

    const response = await fetch(`${baseUrl}?key=${API_KEY}`, {
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
   * Helper: Get recommended model for specific task
   */
  static getModelForTask(task: 'fast' | 'complex'): ModelType {
    switch (task) {
      case 'fast':
        return ModelType.TEXT_FAST;
      case 'complex':
        return ModelType.TEXT_PRO;
      default:
        return ModelType.TEXT_FAST;
    }
  }

  /**
   * Get all available models with their configs
   */
  static getAvailableModels(): Array<{ model: ModelType; config: ModelConfig }> {
    return Object.entries(MODEL_CONFIGS).map(([model, config]) => ({
      model: model as ModelType,
      config,
    }));
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
      modelUsage: {},
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
