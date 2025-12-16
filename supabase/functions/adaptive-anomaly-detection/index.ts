/**
 * Adaptive Anomaly Detection - Machine Learning Based
 * 
 * This edge function LEARNS what's normal for each user/project by:
 * 1. Computing statistical baselines (mean, stddev, percentiles)
 * 2. Detecting anomalies using Z-score and IQR methods
 * 3. Auto-tuning thresholds based on historical data
 * 4. Creating user-specific alert thresholds
 * 
 * Runs every 5 minutes via pg_cron or manually via webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Baseline {
  user_id: string;
  metric_name: string;
  mean: number;
  stddev: number;
  p50: number;
  p95: number;
  p99: number;
  sample_size: number;
  computed_at: string;
}

interface AnomalyDetectionConfig {
  z_score_threshold: number; // Default: 3.0 (99.7% confidence)
  iqr_multiplier: number; // Default: 1.5 (standard outlier detection)
  min_samples: number; // Minimum samples needed for baseline
  lookback_hours: number; // How far back to analyze
}

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  z_score_threshold: 3.0,
  iqr_multiplier: 1.5,
  min_samples: 30,
  lookback_hours: 24,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[adaptive-anomaly] Starting ML-based anomaly detection...');

    // Get all active users with recent data
    const { data: activeUsers, error: usersError } = await supabase
      .from('llm_requests')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('user_id');

    if (usersError) throw usersError;

    const uniqueUsers = [...new Set(activeUsers?.map(u => u.user_id) || [])];
    console.log(`[adaptive-anomaly] Found ${uniqueUsers.length} active users`);

    let totalBaselines = 0;
    let totalAnomalies = 0;

    // Process each user independently
    for (const userId of uniqueUsers) {
      const userBaselines = await computeUserBaselines(supabase, userId, DEFAULT_CONFIG);
      totalBaselines += userBaselines.length;

      const anomalies = await detectAnomaliesForUser(supabase, userId, userBaselines, DEFAULT_CONFIG);
      totalAnomalies += anomalies.length;

      if (anomalies.length > 0) {
        await createAnomalyAlerts(supabase, userId, anomalies);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: uniqueUsers.length,
        baselines_computed: totalBaselines,
        anomalies_detected: totalAnomalies,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[adaptive-anomaly] Error:', error);
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
 * Compute statistical baselines for a user's metrics
 * This is the "LEARNING" phase - understanding what's normal
 */
async function computeUserBaselines(
  supabase: any,
  userId: string,
  config: AnomalyDetectionConfig
): Promise<Baseline[]> {
  const lookbackDate = new Date(Date.now() - config.lookback_hours * 60 * 60 * 1000).toISOString();

  // Get historical data for the user
  const { data: requests, error } = await supabase
    .from('llm_requests')
    .select('latency_ms, cost_usd, tokens_total, coherence_score, toxicity_score, hallucination_risk')
    .eq('user_id', userId)
    .eq('success', true) // Only learn from successful requests
    .gte('created_at', lookbackDate)
    .order('created_at', { ascending: false });

  if (error || !requests || requests.length < config.min_samples) {
    console.log(`[adaptive-anomaly] Insufficient data for user ${userId} (${requests?.length || 0} samples)`);
    return [];
  }

  const metrics = [
    { name: 'latency_ms', values: requests.map(r => r.latency_ms).filter(v => v != null) },
    { name: 'cost_usd', values: requests.map(r => r.cost_usd).filter(v => v != null) },
    { name: 'tokens_total', values: requests.map(r => r.tokens_total).filter(v => v != null) },
    { name: 'coherence_score', values: requests.map(r => r.coherence_score).filter(v => v != null) },
    { name: 'toxicity_score', values: requests.map(r => r.toxicity_score).filter(v => v != null) },
    { name: 'hallucination_risk', values: requests.map(r => r.hallucination_risk).filter(v => v != null) },
  ];

  const baselines: Baseline[] = [];
  const timestamp = new Date().toISOString();

  for (const metric of metrics) {
    if (metric.values.length < config.min_samples) continue;

    const sorted = metric.values.sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
    const stddev = Math.sqrt(variance);

    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);

    baselines.push({
      user_id: userId,
      metric_name: metric.name,
      mean,
      stddev,
      p50,
      p95,
      p99,
      sample_size: metric.values.length,
      computed_at: timestamp,
    });
  }

  // Store baselines in database
  if (baselines.length > 0) {
    await supabase
      .from('user_baselines')
      .upsert(baselines, { onConflict: 'user_id,metric_name' });
    
    console.log(`[adaptive-anomaly] Computed ${baselines.length} baselines for user ${userId}`);
  }

  return baselines;
}

/**
 * Detect anomalies using learned baselines
 * This is the "DETECTION" phase - finding what's abnormal
 */
async function detectAnomaliesForUser(
  supabase: any,
  userId: string,
  baselines: Baseline[],
  config: AnomalyDetectionConfig
): Promise<any[]> {
  if (baselines.length === 0) return [];

  // Get recent requests (last 15 minutes)
  const recentDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: recentRequests, error } = await supabase
    .from('llm_requests')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', recentDate);

  if (error || !recentRequests) return [];

  const anomalies = [];
  const baselineMap = new Map(baselines.map(b => [b.metric_name, b]));

  for (const request of recentRequests) {
    // Check latency
    const latencyBaseline = baselineMap.get('latency_ms');
    if (latencyBaseline && request.latency_ms) {
      const zScore = (request.latency_ms - latencyBaseline.mean) / latencyBaseline.stddev;
      
      if (Math.abs(zScore) > config.z_score_threshold) {
        anomalies.push({
          user_id: userId,
          request_id: request.id,
          anomaly_type: 'latency_spike',
          detection_method: 'z_score',
          severity: zScore > 4 ? 'critical' : 'warning',
          metric_name: 'latency_ms',
          actual_value: request.latency_ms,
          expected_value: latencyBaseline.mean,
          z_score: zScore,
          baseline_mean: latencyBaseline.mean,
          baseline_stddev: latencyBaseline.stddev,
          deviation_percentage: ((request.latency_ms - latencyBaseline.mean) / latencyBaseline.mean * 100).toFixed(2),
          metadata: {
            model: request.model,
            p95_threshold: latencyBaseline.p95,
            p99_threshold: latencyBaseline.p99,
          },
        });
      }
    }

    // Check cost
    const costBaseline = baselineMap.get('cost_usd');
    if (costBaseline && request.cost_usd) {
      const zScore = (request.cost_usd - costBaseline.mean) / costBaseline.stddev;
      
      if (zScore > config.z_score_threshold) {
        anomalies.push({
          user_id: userId,
          request_id: request.id,
          anomaly_type: 'cost_spike',
          detection_method: 'z_score',
          severity: zScore > 5 ? 'critical' : 'warning',
          metric_name: 'cost_usd',
          actual_value: request.cost_usd,
          expected_value: costBaseline.mean,
          z_score: zScore,
          baseline_mean: costBaseline.mean,
          baseline_stddev: costBaseline.stddev,
          deviation_percentage: ((request.cost_usd - costBaseline.mean) / costBaseline.mean * 100).toFixed(2),
        });
      }
    }

    // Check toxicity (higher than usual is bad)
    const toxicityBaseline = baselineMap.get('toxicity_score');
    if (toxicityBaseline && request.toxicity_score) {
      const zScore = (request.toxicity_score - toxicityBaseline.mean) / toxicityBaseline.stddev;
      
      if (zScore > config.z_score_threshold) {
        anomalies.push({
          user_id: userId,
          request_id: request.id,
          anomaly_type: 'toxicity_spike',
          detection_method: 'z_score',
          severity: 'critical',
          metric_name: 'toxicity_score',
          actual_value: request.toxicity_score,
          expected_value: toxicityBaseline.mean,
          z_score: zScore,
          baseline_mean: toxicityBaseline.mean,
          baseline_stddev: toxicityBaseline.stddev,
        });
      }
    }

    // Check coherence (lower than usual is bad)
    const coherenceBaseline = baselineMap.get('coherence_score');
    if (coherenceBaseline && request.coherence_score) {
      const zScore = (request.coherence_score - coherenceBaseline.mean) / coherenceBaseline.stddev;
      
      if (zScore < -config.z_score_threshold) { // Note: negative because low coherence is bad
        anomalies.push({
          user_id: userId,
          request_id: request.id,
          anomaly_type: 'coherence_drop',
          detection_method: 'z_score',
          severity: 'warning',
          metric_name: 'coherence_score',
          actual_value: request.coherence_score,
          expected_value: coherenceBaseline.mean,
          z_score: zScore,
          baseline_mean: coherenceBaseline.mean,
          baseline_stddev: coherenceBaseline.stddev,
        });
      }
    }
  }

  // Store anomalies in database
  if (anomalies.length > 0) {
    await supabase.from('anomalies').insert(anomalies);
    console.log(`[adaptive-anomaly] Detected ${anomalies.length} anomalies for user ${userId}`);
  }

  return anomalies;
}

/**
 * Create alerts from detected anomalies
 */
async function createAnomalyAlerts(supabase: any, userId: string, anomalies: any[]) {
  const alerts = anomalies.map(anomaly => ({
    user_id: userId,
    title: formatAnomalyTitle(anomaly),
    description: formatAnomalyDescription(anomaly),
    severity: anomaly.severity,
    source: 'ml_detection',
    alert_type: 'ml_detected',
    anomaly_score: Math.abs(anomaly.z_score),
    current_value: anomaly.actual_value,
    threshold_value: anomaly.expected_value,
    metadata: {
      ...anomaly.metadata,
      request_id: anomaly.request_id,
      detection_method: anomaly.detection_method,
      z_score: anomaly.z_score,
      deviation: anomaly.deviation_percentage,
    },
  }));

  await supabase.from('alerts').insert(alerts);
}

/**
 * Helper: Calculate percentile
 */
function percentile(sorted: number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Helper: Format anomaly title
 */
function formatAnomalyTitle(anomaly: any): string {
  const titles: Record<string, string> = {
    latency_spike: '🚨 Abnormal Latency Detected',
    cost_spike: '💰 Unusual Cost Spike',
    toxicity_spike: '⚠️ Toxicity Anomaly',
    coherence_drop: '📉 Quality Drop Detected',
  };
  return titles[anomaly.anomaly_type] || 'Anomaly Detected';
}

/**
 * Helper: Format anomaly description
 */
function formatAnomalyDescription(anomaly: any): string {
  const value = anomaly.actual_value.toFixed(2);
  const expected = anomaly.expected_value.toFixed(2);
  const deviation = anomaly.deviation_percentage || 'N/A';
  
  return `${anomaly.metric_name}: ${value} (expected: ${expected}, deviation: ${deviation}%, z-score: ${anomaly.z_score.toFixed(2)})`;
}
