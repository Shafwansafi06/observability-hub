/**
 * Security Check Script
 * Validates security configuration and runs basic security tests
 */

import { detectPII, hasPII, maskPII } from '../lib/security/pii-detector';
import { signRequest, verifyRequest } from '../lib/security/request-signer';
import { rateLimiter, getRateLimitConfig } from '../lib/security/rate-limiter';

console.log('🔒 Running Security Checks...\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  };
}

async function runTests() {
  // Test 1: PII Detection
  await test('PII Detection - Email', () => {
    const result = detectPII('Contact me at john@example.com');
    return result.hasPII && result.types.includes('email');
  })();

  await test('PII Detection - Phone', () => {
    const result = detectPII('Call me at 555-123-4567');
    return result.hasPII && result.types.includes('phone');
  })();

  await test('PII Detection - Credit Card', () => {
    const result = detectPII('Card: 4532-1234-5678-9010');
    return result.hasPII && result.types.includes('creditCard');
  })();

  await test('PII Masking', () => {
    const masked = maskPII('Email: john@example.com, Phone: 555-123-4567');
    return !masked.includes('john@example.com') && !masked.includes('555-123-4567');
  })();

  // Test 2: Request Signing
  await test('Request Signing', () => {
    const request = { prompt: 'test' };
    const signed = signRequest(request, 'test-secret');
    return signed.signature.length === 64; // SHA256 hex length
  })();

  await test('Request Verification - Valid', () => {
    const request = { prompt: 'test' };
    const signed = signRequest(request, 'test-secret');
    const verified = verifyRequest(signed, 'test-secret');
    return verified.valid;
  })();

  await test('Request Verification - Invalid Secret', () => {
    const request = { prompt: 'test' };
    const signed = signRequest(request, 'test-secret');
    const verified = verifyRequest(signed, 'wrong-secret');
    return !verified.valid;
  })();

  await test('Request Verification - Expired', () => {
    const request = { prompt: 'test' };
    const oldTimestamp = Date.now() - 400000; // 6+ minutes ago
    const signed = signRequest(request, 'test-secret', oldTimestamp);
    const verified = verifyRequest(signed, 'test-secret', 300000); // 5 min max age
    return !verified.valid;
  })();

  // Test 3: Rate Limiting
  await test('Rate Limiting - Free Tier Config', () => {
    const config = getRateLimitConfig('free');
    return config.maxRequests === 10 && config.windowMs === 3600000;
  })();

  await test('Rate Limiting - Pro Tier Config', () => {
    const config = getRateLimitConfig('pro');
    return config.maxRequests === 100 && config.windowMs === 3600000;
  })();

  await test('Rate Limiting - Check Limit', async () => {
    const config = { windowMs: 60000, maxRequests: 5 };
    const result = await rateLimiter.checkLimit('test-user-1', config);
    return result.allowed && result.remaining === 4;
  })();

  await test('Rate Limiting - Enforce Limit', async () => {
    const config = { windowMs: 60000, maxRequests: 2 };
    const testUser = `test-user-${Date.now()}`;
    
    // Use up the limit
    await rateLimiter.checkLimit(testUser, config);
    await rateLimiter.checkLimit(testUser, config);
    
    // This should be blocked
    const result = await rateLimiter.checkLimit(testUser, config);
    return !result.allowed && result.remaining === 0;
  })();

  // Test 4: Environment Variables
  await test('Environment Variables - API Keys Not in Client', () => {
    // Check that production keys don't have VITE_ prefix
    const hasVitePrefix = Object.keys(process.env).some(key => 
      key.startsWith('VITE_') && 
      (key.includes('SECRET') || key.includes('PRIVATE') || key.includes('SERVICE_ACCOUNT'))
    );
    return !hasVitePrefix;
  })();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('🎉 All security checks passed!\n');
    console.log('Security Rating: A (Excellent) ✅\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some security checks failed. Please review and fix.\n');
    console.log('Security Rating: B (Good) - Needs improvement\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Security check failed:', error);
  process.exit(1);
});
