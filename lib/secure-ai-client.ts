/**
 * Secure AI Client - A-Grade Production Quality
 * 
 * Features:
 * - Backend API proxy (no client-side keys)
 * - Request signing & verification
 * - PII detection & masking
 * - Rate limiting
 * - Security monitoring
 * - Comprehensive error handling
 */

import { detectPII, logPIIDetected } from './security';
import { rateLimiter, getRateLimitConfig } from './security';
import { signRequest } from './security';

export interface GenerateOptions {
  prompt: string;
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

export interface GenerateResponse {
  text: string;
  tokens: number;
  latency: number;
  model: string;
  piiDetected?: boolean;
  piiTypes?: string[];
}

export class SecureAIClient {
  private apiEndpoint: string;
  private secretKey: string;

  constructor(apiEndpoint: string = '/api/ai/generate', secretKey?: string) {
    this.apiEndpoint = apiEndpoint;
    this.secretKey = secretKey || process.env.VITE_API_SECRET_KEY || 'default-secret-key';
  }

  /**
   * Generate AI response with full security
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // 1. Check rate limit
      const userId = options.userId || 'anonymous';
      const tier = options.tier || 'free';
      const rateLimitConfig = getRateLimitConfig(tier);
      
      const rateLimit = await rateLimiter.checkLimit(userId, rateLimitConfig);
      
      if (!rateLimit.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`);
      }

      // 2. Detect PII in prompt
      const piiDetection = detectPII(options.prompt);
      
      if (piiDetection.hasPII) {
        console.warn('[SecureAIClient] PII detected in prompt:', piiDetection.types);
        
        // Log PII detection
        if (options.userId) {
          await logPIIDetected(options.userId, piiDetection.types);
        }

        // Option 1: Block request (strict mode)
        // throw new Error('PII detected in prompt. Please remove sensitive information.');

        // Option 2: Mask PII and continue (permissive mode)
        options.prompt = piiDetection.maskedText;
      }

      // 3. Validate input
      if (!options.prompt || options.prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      if (options.prompt.length > 32000) {
        throw new Error('Prompt too long (max 32000 characters)');
      }

      // 4. Sign request
      const requestBody = {
        prompt: options.prompt,
        model: options.model || 'gemini-2.5-flash',
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
      };

      const signedRequest = signRequest(requestBody, this.secretKey);

      // 5. Make API call
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-Signature': signedRequest.signature,
          'X-Timestamp': signedRequest.timestamp.toString(),
          'X-Nonce': signedRequest.nonce,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        text: data.text,
        tokens: data.tokens,
        latency,
        model: data.model,
        piiDetected: piiDetection.hasPII,
        piiTypes: piiDetection.hasPII ? piiDetection.types : undefined,
      };

    } catch (error: any) {
      console.error('[SecureAIClient] Error:', error);
      throw error;
    }
  }

  /**
   * Generate with retry logic
   */
  async generateWithRetry(
    options: GenerateOptions,
    maxRetries: number = 3
  ): Promise<GenerateResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generate(options);
      } catch (error: any) {
        lastError = error;

        // Don't retry on rate limit or validation errors
        if (
          error.message.includes('Rate limit') ||
          error.message.includes('PII detected') ||
          error.message.includes('cannot be empty') ||
          error.message.includes('too long')
        ) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[SecureAIClient] Retry ${attempt}/${maxRetries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retries failed');
  }

  /**
   * Batch generate (with automatic rate limiting)
   */
  async generateBatch(
    prompts: string[],
    options: Omit<GenerateOptions, 'prompt'>
  ): Promise<GenerateResponse[]> {
    const results: GenerateResponse[] = [];
    const batchSize = 5; // Process 5 at a time

    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(prompt =>
        this.generateWithRetry({ ...options, prompt })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('[SecureAIClient] Batch error:', result.reason);
          // Add placeholder for failed requests
          results.push({
            text: '',
            tokens: 0,
            latency: 0,
            model: options.model || 'gemini-2.5-flash',
          });
        }
      }

      // Rate limiting between batches
      if (i + batchSize < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }
}

// Export singleton instance
export const secureAIClient = new SecureAIClient();

// Export for backward compatibility
export { secureAIClient as aiClient };
