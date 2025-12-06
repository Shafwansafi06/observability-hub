/**
 * ObservAI Hub - Cron: Aggregate Metrics
 * 
 * Scheduled function to aggregate raw metrics into rollups.
 * Run every 5 minutes via Supabase cron.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAdminClient } from '../../_shared/auth.ts';
import { createSuccessResponse, createErrorResponse } from '../../_shared/cors.ts';

serve(async (req: Request) => {
  // Verify cron secret for security
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return createErrorResponse('UNAUTHORIZED', 'Invalid cron secret', 401);
  }
  
  const startTime = Date.now();
  const results: Record<string, number> = {};
  
  try {
    const adminClient = createAdminClient();
    
    // Get current time and calculate aggregation windows
    const now = new Date();
    
    // Aggregate 1-minute data (last 10 minutes to catch any delays)
    const oneMinEnd = new Date(now);
    oneMinEnd.setSeconds(0, 0);
    const oneMinStart = new Date(oneMinEnd.getTime() - 10 * 60 * 1000);
    
    const { data: oneMinResult } = await adminClient.rpc('aggregate_metrics', {
      p_period: '1m',
      p_start_time: oneMinStart.toISOString(),
      p_end_time: oneMinEnd.toISOString(),
    });
    results['1m'] = oneMinResult || 0;
    
    // Aggregate 5-minute data (last 30 minutes)
    const fiveMinEnd = new Date(now);
    fiveMinEnd.setMinutes(Math.floor(fiveMinEnd.getMinutes() / 5) * 5, 0, 0);
    const fiveMinStart = new Date(fiveMinEnd.getTime() - 30 * 60 * 1000);
    
    const { data: fiveMinResult } = await adminClient.rpc('aggregate_metrics', {
      p_period: '5m',
      p_start_time: fiveMinStart.toISOString(),
      p_end_time: fiveMinEnd.toISOString(),
    });
    results['5m'] = fiveMinResult || 0;
    
    // Aggregate 1-hour data (last 6 hours, run less frequently)
    if (now.getMinutes() < 5) {
      const oneHourEnd = new Date(now);
      oneHourEnd.setMinutes(0, 0, 0);
      const oneHourStart = new Date(oneHourEnd.getTime() - 6 * 60 * 60 * 1000);
      
      const { data: oneHourResult } = await adminClient.rpc('aggregate_metrics', {
        p_period: '1h',
        p_start_time: oneHourStart.toISOString(),
        p_end_time: oneHourEnd.toISOString(),
      });
      results['1h'] = oneHourResult || 0;
    }
    
    // Aggregate 1-day data (run once per hour, first 5 minutes)
    if (now.getMinutes() < 5 && now.getHours() === 0) {
      const oneDayEnd = new Date(now);
      oneDayEnd.setHours(0, 0, 0, 0);
      const oneDayStart = new Date(oneDayEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const { data: oneDayResult } = await adminClient.rpc('aggregate_metrics', {
        p_period: '1d',
        p_start_time: oneDayStart.toISOString(),
        p_end_time: oneDayEnd.toISOString(),
      });
      results['1d'] = oneDayResult || 0;
    }
    
    // Refresh materialized views
    await adminClient.rpc('refresh_metrics_views');
    
    const duration = Date.now() - startTime;
    
    console.log('Metrics aggregation completed', {
      duration_ms: duration,
      results,
    });
    
    return createSuccessResponse({
      success: true,
      duration_ms: duration,
      aggregated: results,
    });
    
  } catch (error) {
    console.error('Metrics aggregation error:', error);
    return createErrorResponse('AGGREGATION_ERROR', 'Failed to aggregate metrics', 500);
  }
});
