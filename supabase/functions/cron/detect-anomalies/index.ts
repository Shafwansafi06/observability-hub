/**
 * ObservAI Hub - Cron: Detect Anomalies
 * 
 * Scheduled function to detect anomalies in metrics.
 * Run every 5 minutes via Supabase cron.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAdminClient } from '../../_shared/auth.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/cors.ts';

interface AnomalyCandidate {
  organization_id: string;
  project_id: string;
  metric_name: string;
  model_name: string | null;
  current_value: number;
  is_anomaly: boolean;
  z_score: number;
  baseline_mean: number;
  baseline_stddev: number;
  confidence: number;
}

serve(async (req: Request) => {
  // Verify cron secret
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return createErrorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
  }
  
  const startTime = Date.now();
  const anomaliesDetected: string[] = [];
  
  try {
    const adminClient = createAdminClient();
    
    // Get all organizations with active projects
    const { data: orgs, error: orgsError } = await adminClient
      .from('organizations')
      .select('id')
      .is('deleted_at', null);
    
    if (orgsError) {
      throw orgsError;
    }
    
    for (const org of orgs || []) {
      // Get active projects
      const { data: projects } = await adminClient
        .from('projects')
        .select('id')
        .eq('organization_id', org.id)
        .eq('status', 'active');
      
      // Type for the LLM metrics we're selecting
      interface LLMMetricRow {
        latency_ms: number;
        is_error: boolean;
        total_tokens: number;
        confidence_score: number | null;
      }
      
      for (const project of projects || []) {
        // Check key metrics for anomalies
        const metricsToCheck = [
          'latency_ms',
          'error_rate',
          'token_count',
          'confidence_score',
        ];
        
        for (const metricName of metricsToCheck) {
          // Get recent metric value
          const { data: recentMetrics } = await adminClient
            .from('llm_metrics')
            .select('latency_ms, is_error, total_tokens, confidence_score')
            .eq('organization_id', org.id)
            .eq('project_id', project.id)
            .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .limit(100) as { data: LLMMetricRow[] | null };
          
          if (!recentMetrics || recentMetrics.length < 10) {
            continue; // Not enough data
          }
          
          // Calculate current value based on metric
          let currentValue: number;
          switch (metricName) {
            case 'latency_ms':
              currentValue = recentMetrics.reduce((sum: number, m: LLMMetricRow) => sum + m.latency_ms, 0) / recentMetrics.length;
              break;
            case 'error_rate':
              currentValue = recentMetrics.filter((m: LLMMetricRow) => m.is_error).length / recentMetrics.length;
              break;
            case 'token_count':
              currentValue = recentMetrics.reduce((sum: number, m: LLMMetricRow) => sum + m.total_tokens, 0) / recentMetrics.length;
              break;
            case 'confidence_score':
              const scoresWithValue = recentMetrics.filter((m: LLMMetricRow) => m.confidence_score !== null);
              currentValue = scoresWithValue.length > 0 
                ? scoresWithValue.reduce((sum: number, m: LLMMetricRow) => sum + (m.confidence_score || 0), 0) / scoresWithValue.length
                : 0;
              break;
            default:
              continue;
          }
          
          // Detect anomaly using z-score
          const { data: anomalyResult } = await adminClient.rpc('detect_anomaly_zscore', {
            p_org_id: org.id,
            p_project_id: project.id,
            p_metric_name: metricName,
            p_current_value: currentValue,
            p_lookback_hours: 24,
            p_threshold_stddev: 3.0,
          });
          
          if (anomalyResult && anomalyResult.length > 0) {
            const result = anomalyResult[0];
            
            if (result.is_anomaly) {
              // Create anomaly record
              const { data: anomaly, error: anomalyError } = await adminClient
                .from('anomalies')
                .insert({
                  organization_id: org.id,
                  project_id: project.id,
                  anomaly_type: `${metricName}_anomaly`,
                  detection_method: 'zscore',
                  severity: result.z_score > 4 ? 'critical' : 'warning',
                  confidence_score: result.confidence,
                  metric_name: metricName,
                  environment: 'production',
                  observed_value: currentValue,
                  expected_value: result.baseline_mean,
                  baseline_mean: result.baseline_mean,
                  baseline_stddev: result.baseline_stddev,
                  deviation_score: result.z_score,
                  status: 'new',
                })
                .select()
                .single();
              
              if (!anomalyError && anomaly) {
                anomaliesDetected.push(anomaly.id);
                
                // Check if there's an alert rule for this anomaly type
                const { data: alertRules } = await adminClient
                  .from('alert_rules')
                  .select('id')
                  .eq('organization_id', org.id)
                  .eq('condition_type', 'anomaly')
                  .eq('enabled', true)
                  .contains('labels', { metric: metricName });
                
                // Fire alerts for matching rules
                for (const rule of alertRules || []) {
                  await adminClient.rpc('fire_alert', {
                    p_rule_id: rule.id,
                    p_current_value: currentValue,
                    p_labels: {
                      metric: metricName,
                      anomaly_id: anomaly.id,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Auto-resolve old anomalies that haven't recurred
    const { error: resolveError } = await adminClient
      .from('anomalies')
      .update({
        status: 'resolved',
        ended_at: new Date().toISOString(),
      })
      .eq('status', 'new')
      .lt('detected_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
    
    if (resolveError) {
      console.error('Failed to auto-resolve anomalies:', resolveError);
    }
    
    const duration = Date.now() - startTime;
    
    console.log('Anomaly detection completed', {
      duration_ms: duration,
      anomalies_detected: anomaliesDetected.length,
    });
    
    return createSuccessResponse({
      success: true,
      duration_ms: duration,
      anomalies_detected: anomaliesDetected.length,
      anomaly_ids: anomaliesDetected,
    });
    
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return createErrorResponse('DETECTION_ERROR', 'Failed to detect anomalies', 500);
  }
});
