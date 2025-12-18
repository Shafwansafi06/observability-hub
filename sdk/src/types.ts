/**
 * ObservAI SDK - Types
 * Type definitions for the ObservAI tracking client
 *
 * Compatible with @google/genai (latest)
 */

/* -------------------------------------------------------------------------- */
/*                                Core Config                                 */
/* -------------------------------------------------------------------------- */

export interface ObservAIConfig {
  /** Gemini API key (AI Studio) */
  apiKey?: string;
  /** User email to associate tracked requests with a Supabase user */
  userEmail?: string;

  /** ObservAI backend endpoint */
  endpoint?: string;

  /** ObservAI user ID */
  userId?: string;

  /** Project name for grouping */
  projectName?: string;

  /** Enable debug logging */
  debug?: boolean;

  /** Automatic retry on failure */
  autoRetry?: boolean;

  /** Batch tracking */
  batchMode?: {
    enabled: boolean;
    maxBatchSize?: number;
    maxWaitMs?: number;
  };

  /** Metadata attached to all requests */
  metadata?: Record<string, any>;

  /** Optional injected AI client for testing or custom runtimes */
  aiClient?: any;
}

/* -------------------------------------------------------------------------- */
/*                               Quality Metrics                               */
/* -------------------------------------------------------------------------- */

export interface QualityScores {
  coherence: number;
  toxicity: number;
  hallucination_risk: number;
  sentiment?: number;
}

/* -------------------------------------------------------------------------- */
/*                              Tracking Payload                               */
/* -------------------------------------------------------------------------- */

export interface TrackedRequest {
  request_id: string;
  session_id?: string;
  user_id?: string;
  /** Optional user email to help server resolve user_id */
  user_email?: string;

  model: string;
  prompt: string;
  response: string;
  prompt_category?: string;

  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  cost_usd: number;

  coherence_score?: number;
  toxicity_score?: number;
  hallucination_risk?: number;
  sentiment_score?: number;

  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;

  success: boolean;
  error_message?: string;
  error_code?: string;
  retry_count: number;

  user_agent?: string;
  metadata?: Record<string, any>;

  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/*                              Ingestion API                                  */
/* -------------------------------------------------------------------------- */

export interface RequestBatch {
  requests: TrackedRequest[];
  batch_id: string;
  timestamp: string;
}

export interface IngestionResponse {
  success: boolean;
  batch_id?: string;
  received?: number;
  message?: string;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*                         Gemini Generation Config                             */
/* -------------------------------------------------------------------------- */

/**
 * Gemini-compatible generation config
 * (matches @google/genai runtime behavior)
 */
export interface TrackedGenerationConfig {
  /** Gemini controls */
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;

  /** ObservAI controls */
  disableTracking?: boolean;
  sessionId?: string;
  category?: string;
}

/* -------------------------------------------------------------------------- */
/*                          Generate Content Options                            */
/* -------------------------------------------------------------------------- */

export interface GenerateContentOptions {
  config?: TrackedGenerationConfig;
  metadata?: Record<string, any>;
}

/* -------------------------------------------------------------------------- */
/*                        Gemini Response (Minimal)                             */
/* -------------------------------------------------------------------------- */

/**
 * Minimal Gemini response shape we rely on.
 * This matches what @google/genai returns at runtime.
 */
export interface GeminiGenerateContentResponse {
  text?: string;
  candidates?: any[];
}

/* -------------------------------------------------------------------------- */
/*                        ObservAI Wrapped Result                               */
/* -------------------------------------------------------------------------- */

export interface TrackedGenerateContentResult {
  response: {
    text(): string;
  };

  tracking?: {
    request_id: string;
    latency_ms: number;
    tokens_used: number;
    cost_estimate_usd: number;
    tracked: boolean;
  };
}
