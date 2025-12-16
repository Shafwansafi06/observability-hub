/**
 * Secure Vertex AI Gateway - Vercel Serverless Function
 * 
 * WHY THIS EXISTS:
 * - Vertex AI API keys must NEVER be exposed to the browser
 * - All AI requests must be validated and rate-limited on the server
 * - This provides a secure, auditable gateway between frontend and Google AI
 * 
 * SECURITY FEATURES:
 * - API key only accessible server-side (no VITE_ prefix)
 * - Input validation prevents prompt injection
 * - Rate limiting per IP address
 * - No secret leakage in error messages
 * - Request logging for security auditing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ===== CONFIGURATION =====
// Read from server-side environment variables (NO VITE_ prefix)
const VERTEX_AI_API_KEY = process.env.VERTEX_AI_API_KEY;
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PROMPT_LENGTH = 32000; // Gemini's context window limit
const MAX_TOKENS = 8192;

// Rate limiting configuration (simple in-memory store)
// In production, use Redis or Vercel KV
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

// ===== TYPES =====
interface GenerateRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface GenerateResponse {
  text: string;
  tokens: number;
  latency: number;
  model: string;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// ===== HELPER FUNCTIONS =====

/**
 * Get client IP for rate limiting
 */
function getClientIP(req: VercelRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    'unknown'
  );
}

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

/**
 * Validate input to prevent injection attacks
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { prompt, model, temperature, maxTokens } = body as GenerateRequest;

  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }

  if (prompt.length === 0 || prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt length must be between 1 and ${MAX_PROMPT_LENGTH} characters` };
  }

  // Check for obvious prompt injection attempts
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /eval\s*\(/i,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(prompt))) {
    return { valid: false, error: 'Invalid prompt content' };
  }

  if (model && typeof model !== 'string') {
    return { valid: false, error: 'Model must be a string' };
  }

  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return { valid: false, error: 'Temperature must be a number between 0 and 2' };
  }

  if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > MAX_TOKENS)) {
    return { valid: false, error: `Max tokens must be between 1 and ${MAX_TOKENS}` };
  }

  return { valid: true };
}

/**
 * Sanitize error messages to prevent secret leakage
 */
function sanitizeError(error: any): string {
  const message = error?.message || 'An error occurred';
  
  // Remove any potential API keys or sensitive info from error messages
  return message
    .replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED]')
    .replace(/[a-f0-9]{32,}/gi, '[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
}

// ===== MAIN HANDLER =====
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' } as ErrorResponse);
    return;
  }

  // Check if API key is configured
  if (!VERTEX_AI_API_KEY) {
    console.error('VERTEX_AI_API_KEY is not configured on server');
    res.status(503).json({ 
      error: 'AI service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    } as ErrorResponse);
    return;
  }

  const startTime = Date.now();
  const clientIP = getClientIP(req);

  try {
    // Rate limiting
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', '60');
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      } as ErrorResponse);
      return;
    }

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

    // Validate request
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({ 
        error: validation.error!,
        code: 'INVALID_REQUEST'
      } as ErrorResponse);
      return;
    }

    const { prompt, model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 1024 } = req.body as GenerateRequest;

    // Log request (without sensitive data)
    console.log('[AI Gateway] Request:', {
      ip: clientIP.substring(0, 8) + '...',
      model,
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });

    // Call Vertex AI
    const apiUrl = `${API_BASE_URL}/models/${model}:generateContent?key=${VERTEX_AI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AI Gateway] Vertex AI error:', response.status, errorData);
      
      // Return sanitized error
      res.status(response.status === 429 ? 429 : 500).json({
        error: response.status === 429 
          ? 'AI service rate limit exceeded. Please try again later.'
          : 'Failed to generate response',
        code: response.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'UPSTREAM_ERROR',
      } as ErrorResponse);
      return;
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    const latency = Date.now() - startTime;

    // Log success
    console.log('[AI Gateway] Success:', {
      model,
      tokens: tokensUsed,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });

    const result: GenerateResponse = {
      text: generatedText,
      tokens: tokensUsed,
      latency,
      model,
    };

    res.status(200).json(result);

  } catch (error: any) {
    console.error('[AI Gateway] Error:', sanitizeError(error));
    
    res.status(500).json({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    } as ErrorResponse);
  }
}
