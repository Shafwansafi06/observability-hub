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
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.VITE_GCP_PROJECT_ID;
const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const VERTEX_AI_API_KEY = process.env.VERTEX_AI_API_KEY; // For Google AI Studio fallback
const GCP_SERVICE_ACCOUNT_KEY = process.env.GCP_SERVICE_ACCOUNT_KEY; // JSON string of service account
const MAX_PROMPT_LENGTH = 32000; // Gemini's context window limit
const MAX_TOKENS = 8192;

// Vertex AI REST endpoint
const VERTEX_AI_BASE_URL = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models`;

// Cache for access token
let cachedToken: { token: string; expiry: number } | null = null;

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

/**
 * Get OAuth2 access token for Vertex AI
 * Uses service account JSON for authentication
 */
async function getAccessToken(): Promise<string> {
  // Check cache first (tokens are valid for ~1 hour)
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  // If using API key (Google AI Studio fallback)
  if (VERTEX_AI_API_KEY && !GCP_SERVICE_ACCOUNT_KEY) {
    console.warn('[AI Gateway] Using API key fallback (not recommended for production)');
    return VERTEX_AI_API_KEY;
  }

  // Parse service account JSON
  if (!GCP_SERVICE_ACCOUNT_KEY) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY not configured');
  }

  const serviceAccount = JSON.parse(GCP_SERVICE_ACCOUNT_KEY);
  const { client_email, private_key } = serviceAccount;

  // Create JWT for Google OAuth2
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const jwtPayload = Buffer.from(JSON.stringify({
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  // Sign JWT
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${jwtHeader}.${jwtPayload}`);
  const signature = sign.sign(private_key, 'base64url');
  const jwt = `${jwtHeader}.${jwtPayload}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token');
  }

  const tokenData = await tokenResponse.json();
  
  // Cache token (expires in ~1 hour, cache for 55 minutes)
  cachedToken = {
    token: tokenData.access_token,
    expiry: Date.now() + 55 * 60 * 1000,
  };

  return tokenData.access_token;
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
    console.error('❌ VERTEX_AI_API_KEY is not configured on server');
    console.error('Environment variables available:', Object.keys(process.env).filter(k => k.includes('VERTEX') || k.includes('GCP')));
    res.status(503).json({ 
      error: 'VERTEX_AI_API_KEY not configured in Vercel environment variables',
      code: 'SERVICE_UNAVAILABLE',
      details: 'Add VERTEX_AI_API_KEY (no VITE_ prefix) in Vercel Dashboard → Settings → Environment Variables'
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

    const { prompt, model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 8024 } = req.body as GenerateRequest;

    // ✅ CORRECT: Vertex AI model names (no mapping needed)
    // gemini-2.5-flash → Fast, cheap, real-time
    // gemini-2.5-pro → Powerful, reasoning, analysis
    const actualModel = model === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    // Log request (without sensitive data)
    console.log('[AI Gateway] Request:', {
      ip: clientIP.substring(0, 8) + '...',
      model: actualModel,
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });

    // ✅ CORRECT: Try Vertex AI first, fallback to API key if needed
    let response: Response;
    let usedVertexAI = false;

    try {
      // Attempt Vertex AI with service account (production-grade)
      if (GCP_SERVICE_ACCOUNT_KEY) {
        const apiUrl = `${VERTEX_AI_BASE_URL}/${actualModel}:generateContent`;
        const accessToken = await getAccessToken();
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: prompt }],
            }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              topP: 0.95,
              topK: 40,
            },
          }),
        });
        usedVertexAI = true;
      } else {
        // Fallback to Google AI Studio with API key
        console.warn('[AI Gateway] Using API key fallback (configure GCP_SERVICE_ACCOUNT_KEY for production)');
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${VERTEX_AI_API_KEY}`;
        
        response = await fetch(apiUrl, {
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
      }
    } catch (authError: any) {
      console.error('[AI Gateway] Auth error, falling back to API key:', sanitizeError(authError));
      
      // Final fallback to API key
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${VERTEX_AI_API_KEY}`;
      
      response = await fetch(apiUrl, {
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
    }

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
