/**
 * ObservAI SDK - Core Client
 * Main client for tracking LLM usage with automatic observability
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type {
  ObservAIConfig,
  TrackedRequest,
  RequestBatch,
  IngestionResponse,
  TrackedGenerationConfig,
  GenerateContentOptions,
  TrackedGenerateContentResult,
} from './types';
import {
  calculateCost,
  estimateTokens,
  analyzeQuality,
  categorizePrompt,
  generateRequestId,
  getUserAgent,
  sanitizeText,
  retryWithBackoff,
} from './utils';

/**
 * ObservAI Client for automatic LLM tracking
 * 
 * @example
 * ```typescript
 * const client = new ObservAIClient({
 *   apiKey: 'YOUR_VERTEX_AI_KEY',
 *   userId: 'user-123',
 *   projectName: 'my-project'
 * });
 * 
 * const result = await client.generateContent('gemini-2.5-flash', 'Hello, world!');
 * console.log(result.response.text());
 * ```
 */
export class ObservAIClient {
  private genAI: GoogleGenerativeAI;
  private config: Required<ObservAIConfig>;
  private sessionId: string;
  private requestBatch: TrackedRequest[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(config: ObservAIConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    
    // Set defaults
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint || 'https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm',
      userId: config.userId || 'anonymous',
      projectName: config.projectName || 'default',
      debug: config.debug || false,
      autoRetry: config.autoRetry !== false,
      batchMode: {
        enabled: config.batchMode?.enabled || false,
        maxBatchSize: config.batchMode?.maxBatchSize || 10,
        maxWaitMs: config.batchMode?.maxWaitMs || 5000,
      },
      metadata: config.metadata || {},
    };

    // Generate session ID
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (this.config.debug) {
      console.log('[ObservAI] Initialized with config:', {
        endpoint: this.config.endpoint,
        userId: this.config.userId,
        projectName: this.config.projectName,
        sessionId: this.sessionId,
      });
    }

    // Setup batch mode
    if (this.config.batchMode.enabled) {
      this.startBatchTimer();
    }
  }

  /**
   * Generate content with automatic tracking
   */
  async generateContent(
    modelName: string,
    prompt: string | any[],
    options?: GenerateContentOptions
  ): Promise<TrackedGenerateContentResult> {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const config = options?.config;
    const shouldTrack = config?.disableTracking !== true;

    try {
      // Get model
      const model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: config,
      });

      // Make the actual API call
      const result = await model.generateContent(prompt);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Extract text
      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      const responseText = result.response.text();

      // Calculate metrics
      const tokensIn = estimateTokens(promptText);
      const tokensOut = estimateTokens(responseText);
      const tokensTotal = tokensIn + tokensOut;
      const cost = calculateCost(modelName, tokensIn, tokensOut);
      const quality = analyzeQuality(promptText, responseText);

      // Track request
      if (shouldTrack) {
        const trackedData: TrackedRequest = {
          request_id: requestId,
          session_id: config?.sessionId || this.sessionId,
          user_id: this.config.userId,
          
          model: modelName,
          prompt: sanitizeText(promptText),
          response: sanitizeText(responseText),
          prompt_category: config?.category || categorizePrompt(promptText),
          
          latency_ms: latency,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          tokens_total: tokensTotal,
          cost_usd: cost,
          
          coherence_score: quality.coherence,
          toxicity_score: quality.toxicity,
          hallucination_risk: quality.hallucination_risk,
          sentiment_score: quality.sentiment,
          
          temperature: config?.temperature,
          max_tokens: (config as any)?.maxTokens,
          top_p: config?.topP,
          top_k: config?.topK,
          
          success: true,
          retry_count: 0,
          
          user_agent: getUserAgent(),
          metadata: {
            ...this.config.metadata,
            ...options?.metadata,
            project_name: this.config.projectName,
          },
          
          timestamp: new Date().toISOString(),
        };

        await this.trackRequest(trackedData);
      }

      // Add tracking metadata to result
      const trackedResult = result as TrackedGenerateContentResult;
      trackedResult.tracking = {
        request_id: requestId,
        latency_ms: latency,
        tokens_used: tokensTotal,
        cost_estimate_usd: cost,
        tracked: shouldTrack,
      };

      if (this.config.debug) {
        console.log('[ObservAI] Request tracked:', {
          requestId,
          latency,
          tokens: tokensTotal,
          cost: `$${cost.toFixed(6)}`,
        });
      }

      return trackedResult;
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

      // Track failed request
      if (shouldTrack) {
        const failedData: TrackedRequest = {
          request_id: requestId,
          session_id: config?.sessionId || this.sessionId,
          user_id: this.config.userId,
          
          model: modelName,
          prompt: sanitizeText(promptText),
          response: '',
          prompt_category: config?.category || categorizePrompt(promptText),
          
          latency_ms: latency,
          tokens_in: estimateTokens(promptText),
          tokens_out: 0,
          tokens_total: estimateTokens(promptText),
          cost_usd: 0,
          
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
          error_code: (error as any)?.code || 'UNKNOWN',
          retry_count: 0,
          
          user_agent: getUserAgent(),
          metadata: {
            ...this.config.metadata,
            ...options?.metadata,
            project_name: this.config.projectName,
          },
          
          timestamp: new Date().toISOString(),
        };

        await this.trackRequest(failedData);
      }

      throw error;
    }
  }

  /**
   * Track a request (with batching support)
   */
  private async trackRequest(data: TrackedRequest): Promise<void> {
    if (this.config.batchMode.enabled) {
      // Add to batch
      this.requestBatch.push(data);

      // Send if batch is full
      if (this.requestBatch.length >= this.config.batchMode.maxBatchSize!) {
        await this.flushBatch();
      }
    } else {
      // Send immediately
      await this.sendTracking([data]);
    }
  }

  /**
   * Send tracking data to ObservAI backend
   */
  private async sendTracking(requests: TrackedRequest[]): Promise<void> {
    try {
      const sendFn = async () => {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            requests,
            batch_id: generateRequestId(),
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ObservAI API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as IngestionResponse;
        
        if (this.config.debug) {
          console.log('[ObservAI] Tracking sent:', result);
        }

        return result;
      };

      // Retry if enabled
      if (this.config.autoRetry) {
        await retryWithBackoff(sendFn, 3, 1000);
      } else {
        await sendFn();
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[ObservAI] Failed to send tracking:', error);
      }
      // Don't throw - tracking failures shouldn't break the app
    }
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.requestBatch.length > 0) {
        this.flushBatch();
      }
    }, this.config.batchMode.maxWaitMs);
  }

  /**
   * Flush pending batch
   */
  async flushBatch(): Promise<void> {
    if (this.requestBatch.length === 0) return;

    const batch = [...this.requestBatch];
    this.requestBatch = [];

    await this.sendTracking(batch);
  }

  /**
   * Get the underlying Google Generative AI client (for advanced usage)
   */
  getGenAI(): GoogleGenerativeAI {
    return this.genAI;
  }

  /**
   * Get a specific model (with tracking wrapper)
   */
  getModel(modelName: string, config?: TrackedGenerationConfig): GenerativeModel {
    return this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: config,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ObservAIConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Start a new session
   */
  newSession(): string {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.sessionId;
  }

  /**
   * Cleanup (flush pending batches and clear timers)
   */
  async dispose(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    await this.flushBatch();
  }
}
