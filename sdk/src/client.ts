/**
 * ObservAI SDK - Core Client
 * Automatic LLM tracking for Gemini (@google/genai)
 */

// Note: we avoid a static import of Google/Generative AI libraries so the
// SDK can be used in test environments without installing those packages.
// Consumers can inject an `aiClient` via `ObservAIConfig.aiClient` or
// install one of the supported runtime packages (`@google/generative-ai` or `@google/genai`).

import type {
  ObservAIConfig,
  TrackedRequest,
  IngestionResponse,
  TrackedGenerationConfig,
  GenerateContentOptions,
  TrackedGenerateContentResult,
} from "./types";

import {
  calculateCost,
  estimateTokens,
  analyzeQuality,
  categorizePrompt,
  generateRequestId,
  getUserAgent,
  sanitizeText,
  retryWithBackoff,
} from "./utils";

export class ObservAIClient {
  private ai: any;
  private config: any;
  private sessionId: string;
  private requestBatch: TrackedRequest[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(config: ObservAIConfig) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;

    // If an `aiClient` is injected, use it (useful for tests or custom runtimes).
    if (config.aiClient) {
      this.ai = config.aiClient;
    } else {
      // Try to lazily require one of the supported Google client packages so
      // consumers don't need to have them installed for tests that inject
      // a mock client. If neither package is available and no apiKey was
      // provided, fail fast with an actionable error.
      let created: any = null;
      if (apiKey) {
        try {
          // Try CommonJS require (works in Node.js). We try both package
          // names that may be present depending on SDK versions.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const GA = require('@google/generative-ai');
          created = new GA.GoogleGenerativeAI(apiKey);
        } catch (e1) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const GA2 = require('@google/genai');
            created = new GA2.GoogleGenAI({ apiKey });
          } catch (e2) {
            // leave created null; we'll handle below
          }
        }
      }

      if (!created && !config.aiClient) {
        if (!apiKey) {
          throw new Error(
            'ObservAI: GEMINI_API_KEY is required (pass apiKey or set env var) or provide an `aiClient` in config'
          );
        }
        throw new Error(
          'ObservAI: missing runtime dependency @google/generative-ai or @google/genai. Install one or pass `aiClient` in config.'
        );
      }

      this.ai = created;
    }

    this.config = {
      apiKey: apiKey ?? '',
      endpoint:
        config.endpoint ??
        "https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm",
      userEmail: config.userEmail ?? '',
      userId: config.userId ?? "anonymous",
      projectName: config.projectName ?? "default",
      debug: config.debug ?? false,
      autoRetry: config.autoRetry ?? true,
      batchMode: {
        enabled: config.batchMode?.enabled ?? false,
        maxBatchSize: config.batchMode?.maxBatchSize ?? 10,
        maxWaitMs: config.batchMode?.maxWaitMs ?? 5000,
      },
      metadata: config.metadata ?? {},
    };

    this.sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    if (this.config.debug) {
      console.log("[ObservAI] Initialized", {
        endpoint: this.config.endpoint,
        userId: this.config.userId,
        projectName: this.config.projectName,
        sessionId: this.sessionId,
      });
    }

    if (this.config.batchMode.enabled) {
      this.startBatchTimer();
    }
  }

  /**
   * Generate content with automatic tracking
   */
  async generateContent(
    model: string,
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<TrackedGenerateContentResult> {
    const start = Date.now();
    const requestId = generateRequestId();
    const cfg = options?.config;
    const shouldTrack = cfg?.disableTracking !== true;

    // 🔑 Separate Gemini config from ObservAI config
    const geminiConfig = cfg
      ? {
          temperature: cfg.temperature,
          topP: cfg.topP,
          topK: cfg.topK,
          maxOutputTokens: cfg.maxOutputTokens,
        }
      : undefined;

    try {
      const res = await this.ai.models.generateContent({
        model,
        contents: prompt,
        ...(geminiConfig ? { generationConfig: geminiConfig } : {}),
      });

      const latency = Date.now() - start;
      const responseText = res.text ?? "";

      const tokensIn = estimateTokens(prompt);
      const tokensOut = estimateTokens(responseText);
      const totalTokens = tokensIn + tokensOut;

      const cost = calculateCost(model, tokensIn, tokensOut);
      const quality = analyzeQuality(prompt, responseText);

      if (shouldTrack) {
        await this.trackRequest({
          request_id: requestId,
          session_id: cfg?.sessionId ?? this.sessionId,
          user_id: this.config.userId,

          model,
          prompt: sanitizeText(prompt),
          response: sanitizeText(responseText),
          prompt_category: cfg?.category ?? categorizePrompt(prompt),

          latency_ms: latency,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          tokens_total: totalTokens,
          cost_usd: cost,

          coherence_score: quality.coherence,
          toxicity_score: quality.toxicity,
          hallucination_risk: quality.hallucination_risk,
          sentiment_score: quality.sentiment,

          temperature: cfg?.temperature,
          max_tokens: cfg?.maxOutputTokens,
          top_p: cfg?.topP,
          top_k: cfg?.topK,

          success: true,
          retry_count: 0,
          user_agent: getUserAgent(),
          user_email: options?.metadata?.user_email ?? this.config.userEmail ?? undefined,
          metadata: {
            ...this.config.metadata,
            ...options?.metadata,
            project_name: this.config.projectName,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return {
        response: {
          text: () => responseText,
        },
        tracking: {
          request_id: requestId,
          latency_ms: latency,
          tokens_used: totalTokens,
          cost_estimate_usd: cost,
          tracked: shouldTrack,
        },
      };
    } catch (err: any) {
      const latency = Date.now() - start;

      if (shouldTrack) {
        await this.trackRequest({
          request_id: requestId,
          session_id: this.sessionId,
          user_id: this.config.userId,

          model,
          prompt: sanitizeText(prompt),
          response: "",
          prompt_category: categorizePrompt(prompt),

          latency_ms: latency,
          tokens_in: estimateTokens(prompt),
          tokens_out: 0,
          tokens_total: estimateTokens(prompt),
          cost_usd: 0,

          success: false,
          error_message: err?.message ?? "Unknown error",
          error_code: err?.status ?? "UNKNOWN",
          retry_count: 0,
          user_agent: getUserAgent(),
          user_email: options?.metadata?.user_email ?? this.config.userEmail ?? undefined,
          metadata: {
            ...this.config.metadata,
            project_name: this.config.projectName,
          },
          timestamp: new Date().toISOString(),
        });
      }

      throw err;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                 Tracking                                   */
  /* -------------------------------------------------------------------------- */

  private async trackRequest(data: TrackedRequest): Promise<void> {
    if (this.config.batchMode.enabled) {
      this.requestBatch.push(data);
      const maxBatchSize = this.config.batchMode.maxBatchSize ?? 10;
      if (this.requestBatch.length >= maxBatchSize) {
        await this.flushBatch();
      }
    } else {
      await this.sendTracking([data]);
    }
  }

  private async sendTracking(requests: TrackedRequest[]): Promise<void> {
    const send = async () => {
      const res = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          requests,
          batch_id: generateRequestId(),
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      if (this.config.debug) {
        const json = (await res.json()) as IngestionResponse;
        console.log("[ObservAI] Tracking sent", json);
      }
    };

    if (this.config.autoRetry) {
      await retryWithBackoff(send, 3, 1000);
    } else {
      await send();
    }
  }

  private startBatchTimer() {
    const maxWait = this.config.batchMode.maxWaitMs ?? 5000;
    this.batchTimer = setInterval(() => {
      if (this.requestBatch.length) {
        this.flushBatch();
      }
    }, maxWait);
  }

  async flushBatch() {
    if (!this.requestBatch.length) return;
    const batch = [...this.requestBatch];
    this.requestBatch = [];
    await this.sendTracking(batch);
  }

  /* -------------------------------------------------------------------------- */
  /*                                 Sessions                                   */
  /* -------------------------------------------------------------------------- */

  getSessionId() {
    return this.sessionId;
  }

  newSession() {
    this.sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    return this.sessionId;
  }

  async dispose() {
    if (this.batchTimer) clearInterval(this.batchTimer);
    await this.flushBatch();
  }
}
