/**
 * Request Signing & Verification
 * Implements HMAC-SHA256 signing for API requests to prevent replay attacks
 */

import crypto from 'crypto';

export interface SignedRequest {
  body: any;
  timestamp: number;
  signature: string;
  nonce: string;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Sign a request with HMAC-SHA256
 */
export function signRequest(
  body: any,
  secretKey: string,
  timestamp?: number,
  nonce?: string
): SignedRequest {
  const ts = timestamp || Date.now();
  const n = nonce || generateNonce();
  
  // Create canonical string: timestamp|nonce|body
  const canonicalString = `${ts}|${n}|${JSON.stringify(body)}`;
  
  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString)
    .digest('hex');

  return {
    body,
    timestamp: ts,
    signature,
    nonce: n,
  };
}

/**
 * Verify a signed request
 */
export function verifyRequest(
  signedRequest: SignedRequest,
  secretKey: string,
  maxAgeMs: number = 300000 // 5 minutes default
): VerificationResult {
  const { body, timestamp, signature, nonce } = signedRequest;

  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const age = now - timestamp;

  if (age > maxAgeMs) {
    return {
      valid: false,
      error: 'Request expired',
    };
  }

  if (age < -60000) {
    // Request from future (clock skew tolerance: 1 minute)
    return {
      valid: false,
      error: 'Invalid timestamp',
    };
  }

  // Recreate canonical string
  const canonicalString = `${timestamp}|${nonce}|${JSON.stringify(body)}`;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString)
    .digest('hex');

  if (signature !== expectedSignature) {
    return {
      valid: false,
      error: 'Invalid signature',
    };
  }

  return { valid: true };
}

/**
 * Nonce store for preventing replay attacks
 * In production, use Redis or similar distributed cache
 */
class NonceStore {
  private store = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old nonces every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 600000);
  }

  /**
   * Check if nonce has been used
   */
  hasNonce(nonce: string): boolean {
    return this.store.has(nonce);
  }

  /**
   * Mark nonce as used
   */
  useNonce(nonce: string, timestamp: number): void {
    this.store.set(nonce, timestamp);
  }

  /**
   * Clean up old nonces (older than 10 minutes)
   */
  private cleanup(): void {
    const cutoff = Date.now() - 600000;
    for (const [nonce, timestamp] of this.store.entries()) {
      if (timestamp < cutoff) {
        this.store.delete(nonce);
      }
    }
  }

  /**
   * Destroy the store
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global nonce store
export const nonceStore = new NonceStore();

/**
 * Verify request and check for replay attacks
 */
export function verifyRequestWithReplayProtection(
  signedRequest: SignedRequest,
  secretKey: string,
  maxAgeMs?: number
): VerificationResult {
  // First verify the signature
  const verification = verifyRequest(signedRequest, secretKey, maxAgeMs);
  
  if (!verification.valid) {
    return verification;
  }

  // Check for replay attack
  if (nonceStore.hasNonce(signedRequest.nonce)) {
    return {
      valid: false,
      error: 'Replay attack detected',
    };
  }

  // Mark nonce as used
  nonceStore.useNonce(signedRequest.nonce, signedRequest.timestamp);

  return { valid: true };
}
