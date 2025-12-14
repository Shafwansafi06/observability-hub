/**
 * ObservAI SDK - Types
 * Type definitions for the ObservAI tracking client
 */

import type { GenerateContentResult, GenerationConfig } from '@google/generative-ai';

/**
 * Configuration for ObservAI client initialization
 */
export interface ObservAIConfig {
  /** Your Vertex AI API key */
  apiKey: string;
  
  /** ObservAI backend endpoint (default: production) */
  endpoint?: string;
  
  /** Your ObservAI user ID (for multi-user tracking) */
  userId?: string;
  
  /** Project name for grouping requests */
  projectName?: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Automatic retry on failure */
  autoRetry?: boolean;
  
  /** Batch tracking data (sends every N requests or M seconds) */
  batchMode?: {
    enabled: boolean;
    maxBatchSize?: number;
    maxWaitMs?: number;
  };
  
  /** Custom metadata to attach to all requests */
  metadata?: Record<string, any>;
}

/**
 * Quality analysis scores
 */
export interface QualityScores {
  coherence: number;
  toxicity: number;
  hallucination_risk: number;
  sentiment?: number;
}

/**
 * Tracked request data sent to ObservAI backend
 */
export interface TrackedRequest {
  // Request metadata
  request_id: string;
  session_id?: string;
  user_id?: string;
  
  // Model details
  model: string;
  prompt: string;
  response: string;
  prompt_category?: string;
  
  // Performance metrics
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  cost_usd: number;
  
  // Quality metrics
  coherence_score?: number;
  toxicity_score?: number;
  hallucination_risk?: number;
  sentiment_score?: number;
  
  // Request parameters
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  
  // Status
  success: boolean;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  
  // Context
  user_agent?: string;
  metadata?: Record<string, any>;
  
  // Timestamp
  timestamp: string;
}

/**
 * Batch of tracked requests
 */
export interface RequestBatch {
  requests: TrackedRequest[];
  batch_id: string;
  timestamp: string;
}

/**
 * Response from ObservAI ingestion API
 */
export interface IngestionResponse {
  success: boolean;
  request_id?: string;
  message?: string;
  error?: string;
}

/**
 * Extended generation config with tracking options
 */
export interface TrackedGenerationConfig extends GenerationConfig {
  /** Custom category for this prompt */
  category?: string;
  
  /** Session ID for conversation tracking */
  sessionId?: string;
  
  /** Disable tracking for this specific request */
  disableTracking?: boolean;
}

/**
 * Options for content generation with tracking
 */
export interface GenerateContentOptions {
  /** Generation configuration */
  config?: TrackedGenerationConfig;
  
  /** Additional metadata for this request */
  metadata?: Record<string, any>;
}

/**
 * Extended result with tracking information
 */
export interface TrackedGenerateContentResult extends GenerateContentResult {
  /** Tracking metadata */
  tracking?: {
    request_id: string;
    latency_ms: number;
    tokens_used: number;
    cost_estimate_usd: number;
    tracked: boolean;
  };
}
