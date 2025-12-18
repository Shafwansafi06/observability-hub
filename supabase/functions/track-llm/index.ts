/**
 * ObservAI Edge Function - track-llm
 * Ingestion endpoint for LLM tracking data from SDK
 * 
 * NOTE: This uses basic threshold detection for real-time alerts.
 * For ML-based anomaly detection with learned baselines, see:
 * /functions/adaptive-anomaly-detection/index.ts
 * 
 * The ML detector runs every 5 minutes and learns YOUR normal patterns.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

interface TrackedRequest {
  request_id: string;
  session_id?: string;
  user_id?: string;
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

interface RequestBatch {
  requests: TrackedRequest[];
  batch_id: string;
  timestamp: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top-level Supabase REST helper using service role key to avoid bundling
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function restRequest(method: string, path: string, body?: unknown) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/${path}`;
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation',
  };

  const finalUrl = method === 'GET' && body ? `${url}?${String(body)}` : url;
  const res = await fetch(finalUrl, {
    method,
    headers,
    body: method === 'GET' || !body ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }; } catch (e) { return { ok: res.ok, status: res.status, data: text }; }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  try {
    // Validate function secrets
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[track-llm] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Parse request body
    const body: RequestBatch = await req.json();
    if (!body || !Array.isArray(body.requests) || body.requests.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[track-llm] Processing batch with ${body.requests.length} requests`);

    // Resolve any provided user_email fields to auth.user ids via REST
    const emails = new Set<string>();
    for (const r of body.requests) {
      if ((r as any).user_email) emails.add(String((r as any).user_email));
    }

    const emailToId: Record<string, string | null> = {};
    for (const email of emails) {
      try {
        const q = `select=id&email=eq.${encodeURIComponent(email)}`;
        const res = await restRequest('GET', `auth.users?${q}`);
        if (res.ok && Array.isArray(res.data) && res.data.length > 0 && res.data[0].id) {
          emailToId[email] = res.data[0].id;
        } else {
          emailToId[email] = null;
        }
      } catch (e) {
        emailToId[email] = null;
      }
    }

    // Map to database format
    const dbRequests = body.requests.map((req) => {
      const userId = req.user_id ?? ((req as any).user_email ? emailToId[String((req as any).user_email)] : null) ?? null;
      return {
        user_id: userId,
        model: req.model,
        prompt: (req.prompt ?? null) ? String(req.prompt).slice(0, 20000) : null,
        response: (req.response ?? null) ? String(req.response).slice(0, 20000) : null,
        prompt_category: req.prompt_category ?? 'general',
        latency_ms: typeof req.latency_ms === 'number' ? req.latency_ms : null,
        tokens_in: typeof req.tokens_in === 'number' ? req.tokens_in : (typeof req.tokens_total === 'number' ? req.tokens_total : null),
        tokens_out: typeof req.tokens_out === 'number' ? req.tokens_out : null,
        tokens_total: typeof req.tokens_total === 'number' ? req.tokens_total : null,
        cost_usd: typeof req.cost_usd === 'number' ? req.cost_usd : null,
        coherence_score: typeof req.coherence_score === 'number' ? req.coherence_score : null,
        toxicity_score: typeof req.toxicity_score === 'number' ? req.toxicity_score : null,
        hallucination_risk: typeof req.hallucination_risk === 'number' ? req.hallucination_risk : null,
        sentiment_score: typeof req.sentiment_score === 'number' ? req.sentiment_score : null,
        temperature: typeof req.temperature === 'number' ? req.temperature : null,
        max_tokens: typeof req.max_tokens === 'number' ? req.max_tokens : null,
        top_p: typeof req.top_p === 'number' ? req.top_p : null,
        frequency_penalty: null,
        presence_penalty: null,
        success: typeof req.success === 'boolean' ? req.success : true,
        error_message: req.error_message ?? null,
        error_code: req.error_code ?? null,
        retry_count: typeof req.retry_count === 'number' ? req.retry_count : 0,
        request_id: req.request_id ?? null,
        session_id: req.session_id ?? null,
        user_agent: req.user_agent ?? null,
        metadata: {
          ...(req.metadata ?? {}),
          // preserve any provided user_email so the UI can surface it
          user_email: (req as any).user_email ?? null,
        },
        created_at: req.timestamp ?? new Date().toISOString(),
      };
    });

    // Debug: log resolved email->user_id mapping when in function logs
    if (Object.keys(emailToId).length > 0) {
      console.log('[track-llm] Resolved emails:', emailToId);
    }

    // Insert llm_requests via REST
    const insertRes = await restRequest('POST', 'llm_requests', dbRequests);
    if (!insertRes.ok) {
      console.error('[track-llm] Database insert error:', insertRes.status, insertRes.data);
      return new Response(JSON.stringify({ success: false, error: 'Database insertion failed', details: insertRes.data }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for anomalies and trigger alerts
    await checkForAnomalies(dbRequests);

    console.log(`[track-llm] Successfully tracked ${dbRequests.length} requests`);

    return new Response(JSON.stringify({ success: true, message: `Tracked ${dbRequests.length} requests`, batch_id: body.batch_id ?? null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[track-llm] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/**
 * Check for anomalies and create alerts
 */
async function checkForAnomalies(requests: any[]) {
  try {
    const alerts = [];

    for (const req of requests) {
      // High latency check
      if (req.success && req.latency_ms > 5000) {
        alerts.push({
          user_id: req.user_id,
          title: 'High Latency Detected',
          description: `Request took ${req.latency_ms}ms (threshold: 5000ms)`,
          severity: 'warning',
          source: 'auto_detection',
          alert_type: 'threshold_breach',
          current_value: req.latency_ms,
          threshold_value: 5000,
          metadata: {
            request_id: req.request_id,
            model: req.model,
          },
        });
      }

      // High cost check
      if (req.cost_usd > 0.1) {
        alerts.push({
          user_id: req.user_id,
          title: 'High Cost Request',
          description: `Single request cost $${req.cost_usd.toFixed(4)}`,
          severity: 'info',
          source: 'auto_detection',
          alert_type: 'threshold_breach',
          current_value: req.cost_usd,
          threshold_value: 0.1,
          metadata: {
            request_id: req.request_id,
            model: req.model,
            tokens: req.tokens_total,
          },
        });
      }

      // High toxicity check
      if (req.toxicity_score && req.toxicity_score > 0.7) {
        alerts.push({
          user_id: req.user_id,
          title: 'High Toxicity Content Detected',
          description: `Toxicity score: ${req.toxicity_score.toFixed(2)}`,
          severity: 'critical',
          source: 'auto_detection',
          alert_type: 'ml_detected',
          anomaly_score: req.toxicity_score,
          metadata: {
            request_id: req.request_id,
            model: req.model,
          },
        });
      }

      // Error check
      if (!req.success) {
        alerts.push({
          user_id: req.user_id,
          title: 'Request Failed',
          description: req.error_message || 'Unknown error',
          severity: 'warning',
          source: 'auto_detection',
          alert_type: 'automated',
          metadata: {
            request_id: req.request_id,
            model: req.model,
            error_code: req.error_code,
          },
        });
      }
    }

    // Insert alerts if any (via REST)
    if (alerts.length > 0) {
      const res = await restRequest('POST', 'alerts', alerts);
      if (!res.ok) {
        console.error('[track-llm] failed creating alerts:', res.status, res.data);
      } else {
        console.log(`[track-llm] Created ${Array.isArray(res.data) ? res.data.length : alerts.length} alerts`);
      }
    }
  } catch (error) {
    console.error('[track-llm] Error checking anomalies:', error);
    // Don't throw - anomaly detection failures shouldn't block ingestion
  }
}
