/**
 * Security Module - A-Grade Production Security
 * 
 * This module provides enterprise-grade security features:
 * - PII Detection & Masking
 * - Request Signing & Verification
 * - Advanced Rate Limiting
 * - Security Monitoring & Alerting
 * - Prompt Injection Detection
 */

export * from './pii-detector';
export * from './request-signer';
export * from './rate-limiter';
export * from './security-monitor';

// Re-export commonly used functions
export {
  detectPII,
  hasPII,
  maskPII,
  getPIITypes,
} from './pii-detector';

export {
  signRequest,
  verifyRequest,
  verifyRequestWithReplayProtection,
  generateNonce,
  nonceStore,
} from './request-signer';

export {
  RateLimiter,
  rateLimiter,
  getRateLimitConfig,
  RATE_LIMITS,
} from './rate-limiter';

export {
  securityMonitor,
  logPromptInjection,
  logRateLimitExceeded,
  logAuthFailure,
  logPIIDetected,
  logReplayAttack,
} from './security-monitor';
