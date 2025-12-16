/**
 * Vertex AI Client for Vite/React (DEPRECATED - Use ai-client.ts instead)
 * 
 * SECURITY NOTICE:
 * This client has been migrated to use a secure backend gateway.
 * All AI requests now go through /api/ai/generate to protect API keys.
 * 
 * WHY THE CHANGE:
 * - API keys should NEVER be in client-side code (VITE_ variables are bundled)
 * - Backend gateway provides rate limiting, validation, and audit logging
 * - Prevents API key theft and abuse
 * 
 * MIGRATION PATH:
 * - Old code using vertexAI.predict() continues to work
 * - Internally routes through secure backend
 * - No API key needed in frontend
 */

import { aiClient, type AIRequest, type AIResponse } from '../ai-client';

// No longer reading VITE_VERTEX_AI_API_KEY - using backend gateway instead
const USE_BACKEND_GATEWAY = true;

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
    // No longer requires API key in frontend
    // Backend gateway handles authentication
    console.log('[VertexAI] Using secure backend gateway at /api/ai/generate');
  }

  /**
   * Get the backend gateway URL (SECURE)
   * All requests now go through our backend to protect API keys
   */
  private getGatewayUrl(): string {
    return '/api/ai/generate';
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
   * Make a prediction using secure backend gateway
   * 
   * SECURITY: All requests now route through /api/ai/generate
   * This ensures API keys are never exposed in the frontend bundle
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const modelName = (request.model as ModelType) || ModelType.TEXT_FAST;

      // Use secure backend gateway instead of direct API call
      const aiRequest: AIRequest = {
        prompt: request.prompt,
        model: modelName as any,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 1024,
      };

      const aiResponse: AIResponse = await aiClient.generate(aiRequest);

      // Update metrics
      this.metrics.successfulRequests++;
      this.metrics.tokensUsed += aiResponse.tokens;
      this.updateAverageLatency(aiResponse.latency);
      this.trackModelUsage(modelName as string, aiResponse.tokens, aiResponse.latency);

      return {
        text: aiResponse.text,
        tokens: aiResponse.tokens,
        latency: aiResponse.latency,
        model: aiResponse.model,
        modelType: 'text',
      };
    } catch (error) {
      this.metrics.failedRequests++;
      const latency = Date.now() - startTime;
      this.updateAverageLatency(latency);
      throw error;
    }
  }

  /**
   * Stream a prediction response (text models only)
   * 
   * NOTE: Streaming is not yet supported through the secure backend gateway.
   * This will be added in a future update. For now, use the standard predict() method.
   */
  async *predictStream(request: PredictionRequest): AsyncGenerator<string> {
    // TODO: Implement streaming through backend gateway
    // For now, fall back to non-streaming prediction
    const response = await this.predict(request);
    if (response.text) {
      yield response.text;
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
