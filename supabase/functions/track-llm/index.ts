/**
 * ObservAI Edge Function - track-llm
 * Ingestion endpoint for LLM tracking data from SDK
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: RequestBatch = await req.json();
    
    if (!body.requests || !Array.isArray(body.requests)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[track-llm] Processing batch with ${body.requests.length} requests`);

    // Extract user_id from first request or use 'anonymous'
    const userId = body.requests[0]?.user_id || 'anonymous';

    // Map to database format
    const dbRequests = body.requests.map(req => ({
      user_id: req.user_id || userId,
      model: req.model,
      prompt: req.prompt,
      response: req.response,
      prompt_category: req.prompt_category || 'general',
      
      latency_ms: req.latency_ms,
      tokens_in: req.tokens_in,
      tokens_out: req.tokens_out,
      tokens_total: req.tokens_total,
      cost_usd: req.cost_usd,
      
      coherence_score: req.coherence_score,
      toxicity_score: req.toxicity_score,
      hallucination_risk: req.hallucination_risk,
      sentiment_score: req.sentiment_score,
      
      temperature: req.temperature,
      max_tokens: req.max_tokens,
      top_p: req.top_p,
      frequency_penalty: 0,
      presence_penalty: 0,
      
      success: req.success,
      error_message: req.error_message,
      error_code: req.error_code,
      retry_count: req.retry_count,
      
      request_id: req.request_id,
      session_id: req.session_id,
      user_agent: req.user_agent,
      metadata: req.metadata || {},
      
      created_at: req.timestamp || new Date().toISOString(),
    }));

    // Insert into database (batch insert)
    const { data, error } = await supabase
      .from('llm_requests')
      .insert(dbRequests);

    if (error) {
      console.error('[track-llm] Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database insertion failed',
          details: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for anomalies and trigger alerts
    await checkForAnomalies(supabase, dbRequests);

    console.log(`[track-llm] Successfully tracked ${dbRequests.length} requests`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tracked ${dbRequests.length} requests`,
        batch_id: body.batch_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[track-llm] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Check for anomalies and create alerts
 */
async function checkForAnomalies(supabase: any, requests: any[]) {
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

    // Insert alerts if any
    if (alerts.length > 0) {
      await supabase.from('alerts').insert(alerts);
      console.log(`[track-llm] Created ${alerts.length} alerts`);
    }
  } catch (error) {
    console.error('[track-llm] Error checking anomalies:', error);
    // Don't throw - anomaly detection failures shouldn't block ingestion
  }
}
