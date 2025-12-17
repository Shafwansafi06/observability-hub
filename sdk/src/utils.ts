/**
 * ObservAI SDK - Utilities
 * Helper functions for quality analysis, cost calculation, and more
 */

import type { QualityScores } from './types';

/**
 * Model pricing (per 1M tokens) as of December 2025
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.0-pro': { input: 0.05, output: 0.15 },
};

/**
 * Calculate cost in USD based on model and token usage
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-1.5-flash'];
  
  const inputCost = (tokensIn / 1_000_000) * pricing.input;
  const outputCost = (tokensOut / 1_000_000) * pricing.output;
  
  return parseFloat((inputCost + outputCost).toFixed(6));
}

/**
 * Estimate token count from text (approximate)
 * Rule of thumb: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Analyze response quality using heuristics
 * Returns scores between 0.0 and 1.0
 */
export function analyzeQuality(prompt: string, response: string): QualityScores {
  return {
    coherence: calculateCoherence(response),
    toxicity: detectToxicity(response),
    hallucination_risk: estimateHallucinationRisk(prompt, response),
    sentiment: analyzeSentiment(response),
  };
}

/**
 * Calculate coherence score (0.0 - 1.0)
 * Based on sentence structure, punctuation, and length consistency
 */
function calculateCoherence(text: string): number {
  if (!text || text.length < 10) return 0.3;
  
  // Check for basic sentence structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0.4;
  
  // Average sentence length (should be reasonable)
  const avgSentenceLength = text.length / sentences.length;
  let score = 0.5;
  
  // Penalize very short or very long sentences
  if (avgSentenceLength > 20 && avgSentenceLength < 200) {
    score += 0.2;
  }
  
  // Reward proper punctuation
  const punctuationMatches = text.match(/[.!?,;:]/g);
  if (punctuationMatches && punctuationMatches.length > sentences.length * 0.5) {
    score += 0.15;
  }
  
  // Reward varied vocabulary (unique words ratio)
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const uniqueWords = new Set(words);
  const vocabularyRatio = uniqueWords.size / Math.max(words.length, 1);
  if (vocabularyRatio > 0.3) {
    score += 0.15;
  }
  
  return Math.min(1.0, score);
}

/**
 * Detect toxic content (0.0 - 1.0, higher = more toxic)
 * Simple keyword-based detection
 */
function detectToxicity(text: string): number {
  const toxicPatterns = [
    /\b(hate|kill|die|stupid|idiot|dumb|moron)\b/gi,
    /\b(f[*u]ck|sh[*i]t|damn|hell)\b/gi,
    /\b(racist|sexist|discriminat)\w*/gi,
  ];
  
  let toxicityScore = 0;
  const lowerText = text.toLowerCase();
  
  toxicPatterns.forEach(pattern => {
    const matches = lowerText.match(pattern);
    if (matches) {
      toxicityScore += matches.length * 0.15;
    }
  });
  
  // Check for excessive CAPS (yelling)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  if (capsRatio > 0.5 && text.length > 20) {
    toxicityScore += 0.2;
  }
  
  return Math.min(1.0, toxicityScore);
}

/**
 * Estimate hallucination risk (0.0 - 1.0)
 * Based on vague language, contradictions, and unusual patterns
 */
function estimateHallucinationRisk(prompt: string, response: string): number {
  if (!response || response.length < 10) return 0.7;
  
  let risk = 0.0;
  
  // Check for hedge words (may indicate uncertainty)
  const hedgeWords = ['maybe', 'perhaps', 'possibly', 'might', 'could be', 'not sure', 'unclear'];
  const hedgeCount = hedgeWords.reduce((count, word) => {
    return count + (response.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
  }, 0);
  risk += Math.min(0.3, hedgeCount * 0.05);
  
  // Check for generic/vague responses
  const genericPhrases = [
    'in general', 'typically', 'usually', 'often', 'sometimes',
    'it depends', 'various', 'different'
  ];
  const genericCount = genericPhrases.reduce((count, phrase) => {
    return count + (response.toLowerCase().includes(phrase) ? 1 : 0);
  }, 0);
  risk += Math.min(0.2, genericCount * 0.04);
  
  // Check for contradictions (simple detection)
  const contradictionPatterns = [
    /however.*but/gi,
    /yes.*no|no.*yes/gi,
    /true.*false|false.*true/gi,
  ];
  contradictionPatterns.forEach(pattern => {
    if (pattern.test(response)) risk += 0.15;
  });
  
  // Check response length vs prompt length (unusually short = higher risk)
  const promptLength = prompt.length;
  const responseLength = response.length;
  if (promptLength > 100 && responseLength < promptLength * 0.3) {
    risk += 0.2;
  }
  
  return Math.min(1.0, risk);
}

/**
 * Analyze sentiment (-1.0 to 1.0)
 * Negative = -1.0, Neutral = 0.0, Positive = 1.0
 */
function analyzeSentiment(text: string): number {
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'happy', 'joy', 'love', 'like', 'best', 'perfect', 'awesome'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
    'sad', 'angry', 'disappointed', 'poor', 'fail', 'problem'
  ];
  
  const lowerText = text.toLowerCase();
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    const matches = lowerText.match(new RegExp(`\\b${word}\\w*\\b`, 'g'));
    if (matches) positiveCount += matches.length;
  });
  
  negativeWords.forEach(word => {
    const matches = lowerText.match(new RegExp(`\\b${word}\\w*\\b`, 'g'));
    if (matches) negativeCount += matches.length;
  });
  
  const totalSentimentWords = positiveCount + negativeCount;
  if (totalSentimentWords === 0) return 0;
  
  const sentimentScore = (positiveCount - negativeCount) / totalSentimentWords;
  return Math.max(-1.0, Math.min(1.0, sentimentScore));
}

/**
 * Categorize prompt based on content
 */
export function categorizePrompt(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  if (/translat|convert.*language/.test(lowerPrompt)) return 'translation';
  if (/summar|tldr|brief/.test(lowerPrompt)) return 'summarization';
  if (/code|program|function|debug/.test(lowerPrompt)) return 'code_generation';
  if (/explain|what is|why|how does/.test(lowerPrompt)) return 'explanation';
  if (/write|create|generate.*content/.test(lowerPrompt)) return 'content_creation';
  if (/analyz|evaluat|assess/.test(lowerPrompt)) return 'analysis';
  
  return 'general';
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get user agent string (browser or Node.js)
 */
export function getUserAgent(): string {
  const nav = (globalThis as any).navigator;
  if (nav && nav.userAgent) {
    return nav.userAgent;
  }
  if (typeof process !== 'undefined' && (process as any).version) {
    return `Node.js/${(process as any).version}`;
  }
  return 'Unknown';
}

/**
 * Sanitize text to remove sensitive information
 */
export function sanitizeText(text: string, maxLength: number = 10000): string {
  if (!text) return '';
  
  // Truncate if too long
  let sanitized = text.substring(0, maxLength);
  
  // Remove potential API keys (basic pattern)
  sanitized = sanitized.replace(/\b[A-Za-z0-9]{32,}\b/g, '[REDACTED_KEY]');
  
  // Remove email addresses (optional, configurable)
  // sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  return sanitized;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}
