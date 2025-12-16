/**
 * Secure AI Client - Frontend
 * 
 * WHY THIS APPROACH:
 * - All AI requests go through our secure backend gateway (/api/ai/generate)
 * - NO API keys in frontend code
 * - Supports demo/mock mode when backend is unavailable
 * - Type-safe with proper error handling
 * 
 * SECURITY BENEFITS:
 * - API keys never bundled into client code
 * - Rate limiting enforced server-side
 * - Input validation on both client and server
 * - No CORS issues (same-origin)
 */

// ===== TYPES =====
export interface AIRequest {
  prompt: string;
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  tokens: number;
  latency: number;
  model: string;
}

export interface AIError {
  error: string;
  code?: string;
}

export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  tokensUsed: number;
}

// ===== CONSTANTS =====
const AI_GATEWAY_URL = '/api/ai/generate';
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEMO_MODE_ENABLED = true; // Enable mock responses when backend unavailable

// ===== METRICS TRACKING =====
class MetricsTracker {
  private metrics: AIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    tokensUsed: 0,
  };

  recordRequest(success: boolean, latency: number, tokens: number = 0): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.tokensUsed += tokens;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average latency
    const totalLatency = this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency;
    this.metrics.averageLatency = totalLatency / this.metrics.totalRequests;
  }

  getMetrics(): AIMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      tokensUsed: 0,
    };
  }
}

// ===== DEMO/MOCK MODE =====
const MOCK_RESPONSES: Record<string, string> = {
  default: `This is a demo response. The AI backend is currently unavailable or not configured.

To enable real AI responses:
1. Add VERTEX_AI_API_KEY to your Vercel environment variables (NO VITE_ prefix)
2. Redeploy your application
3. The backend will automatically use the secure API gateway

This demo mode allows you to test the UI without backend configuration.`,
  
  optimization: `**Optimized Prompt:**

Your original prompt can be improved with these techniques:
- Add specific context and constraints
- Use structured formatting
- Specify the desired output format
- Include relevant examples

**Expected Improvements:**
- Token reduction: ~20%
- Clarity score: +35%
- Response quality: Significantly improved

**Pro Tip:** Break complex tasks into smaller, sequential steps for better results.

(Note: This is a demo response. Configure VERTEX_AI_API_KEY for real optimization.)`,
};

function generateMockResponse(prompt: string): AIResponse {
  const responseType = prompt.toLowerCase().includes('optim') ? 'optimization' : 'default';
  const mockText = MOCK_RESPONSES[responseType];
  
  return {
    text: mockText,
    tokens: Math.floor(mockText.length / 4), // Rough approximation
    latency: Math.random() * 500 + 200, // 200-700ms
    model: 'demo-mode',
  };
}

// ===== MAIN CLIENT CLASS =====
export class SecureAIClient {
  private metricsTracker = new MetricsTracker();
  private isBackendAvailable: boolean | null = null;

  constructor() {
    // Check backend availability on initialization
    this.checkBackendHealth();
  }

  /**
   * Check if backend is available (with caching)
   */
  private async checkBackendHealth(): Promise<boolean> {
    if (this.isBackendAvailable !== null) {
      return this.isBackendAvailable;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'health check' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.isBackendAvailable = response.status !== 503;
      return this.isBackendAvailable;
    } catch {
      this.isBackendAvailable = false;
      return false;
    }
  }

  /**
   * Generate AI response through secure backend gateway
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Client-side validation
      if (!request.prompt || request.prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      if (request.prompt.length > 32000) {
        throw new Error('Prompt is too long (max 32,000 characters)');
      }

      // Check backend availability
      const backendAvailable = await this.checkBackendHealth();
      
      if (!backendAvailable && DEMO_MODE_ENABLED) {
        console.warn('[AI Client] Backend unavailable, using demo mode');
        const mockResponse = generateMockResponse(request.prompt);
        this.metricsTracker.recordRequest(true, Date.now() - startTime, mockResponse.tokens);
        return mockResponse;
      }

      // Make request to backend gateway
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          model: request.model || 'gemini-2.5-flash',
          temperature: request.temperature ?? 0.7,
          maxTokens: request.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorData: AIError = await response.json().catch(() => ({
          error: 'Unknown error occurred',
        }));

        this.metricsTracker.recordRequest(false, latency);

        // Handle specific error codes
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }

        if (response.status === 503) {
          throw new Error('AI service is temporarily unavailable. Please try again later.');
        }

        throw new Error(errorData.error || 'Failed to generate response');
      }

      const data: AIResponse = await response.json();
      this.metricsTracker.recordRequest(true, latency, data.tokens);

      return data;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.metricsTracker.recordRequest(false, latency);

      // Handle network errors gracefully
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (DEMO_MODE_ENABLED && !navigator.onLine) {
        console.warn('[AI Client] Offline, using demo mode');
        return generateMockResponse(request.prompt);
      }

      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): AIMetrics {
    return this.metricsTracker.getMetrics();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metricsTracker.reset();
  }

  /**
   * Check if backend is configured and available
   */
  async isAvailable(): Promise<boolean> {
    return this.checkBackendHealth();
  }
}

// ===== SINGLETON INSTANCE =====
// Export a singleton instance for convenience
export const aiClient = new SecureAIClient();

// ===== CONVENIENCE FUNCTIONS =====
/**
 * Generate AI response (convenience function)
 */
export async function generateAIResponse(
  prompt: string,
  options?: Partial<Omit<AIRequest, 'prompt'>>
): Promise<AIResponse> {
  return aiClient.generate({
    prompt,
    ...options,
  });
}

/**
 * Get AI service metrics
 */
export function getAIMetrics(): AIMetrics {
  return aiClient.getMetrics();
}

/**
 * Check if AI service is available
 */
export async function isAIAvailable(): Promise<boolean> {
  return aiClient.isAvailable();
}
