/**
 * ObservAI Hub - Metrics Edge Function
 * 
 * Query and aggregate metrics data.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, handleCorsPreFlight, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { authenticate, createAdminClient } from '../_shared/auth.ts';
import { createCacheClient, cacheKeys, cacheTTL } from '../_shared/cache.ts';

// =====================================================
// SCHEMAS
// =====================================================

const getMetricsQuerySchema = z.object({
  project_id: z.string().uuid(),
  metric_name: z.string().optional(),
  environment: z.string().optional(),
  model_name: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  granularity: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).optional().default('1h'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

const getLLMMetricsQuerySchema = z.object({
  project_id: z.string().uuid(),
  model_name: z.string().optional(),
  model_provider: z.string().optional(),
  environment: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

// =====================================================
// HANDLER
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }
  
  const url = new URL(req.url);
  const path = url.pathname.replace('/metrics', '');
  
  try {
    // Authenticate request
    const auth = await authenticate(req);
    
    if (!auth.authenticated) {
      return createErrorResponse('UNAUTHORIZED', auth.error || 'Authentication required', 401);
    }
    
    // Check for read scope
    if (auth.authType === 'api_key' && !auth.scopes?.includes('read')) {
      return createErrorResponse('FORBIDDEN', 'Read scope required', 403);
    }
    
    const adminClient = createAdminClient();
    const cache = createCacheClient();
    
    // Route handling
    switch (req.method) {
      case 'GET': {
        // Parse query params
        const params = Object.fromEntries(url.searchParams);
        
        if (path === '/summary' || path === '/llm/summary') {
          // LLM metrics summary
          const validation = getLLMMetricsQuerySchema.safeParse(params);
          if (!validation.success) {
            return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, {
              errors: validation.error.errors,
            });
          }
          
          const query = validation.data;
          
          // Check cache
          const cacheKey = cacheKeys.metricsAgg(
            auth.organizationId!,
            query.project_id,
            `${query.start_time}-${query.end_time}`
          );
          
          const cached = await cache.get(cacheKey);
          if (cached) {
            return createSuccessResponse(cached, 200, { cached: true });
          }
          
          // Query summary
          const { data, error } = await adminClient.rpc('get_llm_metrics_summary', {
            p_org_id: auth.organizationId,
            p_project_id: query.project_id,
            p_start_time: query.start_time,
            p_end_time: query.end_time,
          });
          
          if (error) {
            console.error('LLM metrics summary error:', error);
            return createErrorResponse('QUERY_ERROR', 'Failed to fetch metrics summary', 500);
          }
          
          // Cache result
          await cache.set(cacheKey, data, cacheTTL.metricsAgg);
          
          return createSuccessResponse(data);
        }
        
        if (path === '/timeseries') {
          // Time series data
          const validation = getMetricsQuerySchema.safeParse(params);
          if (!validation.success) {
            return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, {
              errors: validation.error.errors,
            });
          }
          
          const query = validation.data;
          
          if (!query.metric_name) {
            return createErrorResponse('VALIDATION_ERROR', 'metric_name is required for timeseries', 400);
          }
          
          const { data, error } = await adminClient.rpc('get_time_series', {
            p_org_id: auth.organizationId,
            p_project_id: query.project_id,
            p_metric_name: query.metric_name,
            p_start_time: query.start_time,
            p_end_time: query.end_time,
            p_granularity: query.granularity,
          });
          
          if (error) {
            console.error('Time series error:', error);
            return createErrorResponse('QUERY_ERROR', 'Failed to fetch time series', 500);
          }
          
          return createSuccessResponse(data);
        }
        
        if (path === '/stats') {
          // Metric statistics
          const validation = getMetricsQuerySchema.safeParse(params);
          if (!validation.success) {
            return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, {
              errors: validation.error.errors,
            });
          }
          
          const query = validation.data;
          
          if (!query.metric_name) {
            return createErrorResponse('VALIDATION_ERROR', 'metric_name is required for stats', 400);
          }
          
          const { data, error } = await adminClient.rpc('get_metric_stats', {
            p_org_id: auth.organizationId,
            p_project_id: query.project_id,
            p_metric_name: query.metric_name,
            p_start_time: query.start_time,
            p_end_time: query.end_time,
            p_environment: query.environment,
          });
          
          if (error) {
            console.error('Metric stats error:', error);
            return createErrorResponse('QUERY_ERROR', 'Failed to fetch metric stats', 500);
          }
          
          return createSuccessResponse(data?.[0] || null);
        }
        
        // Default: list LLM metrics
        const validation = getLLMMetricsQuerySchema.safeParse(params);
        if (!validation.success) {
          return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, {
            errors: validation.error.errors,
          });
        }
        
        const query = validation.data;
        const offset = (query.page - 1) * query.limit;
        
        let dbQuery = adminClient
          .from('llm_metrics')
          .select('*', { count: 'exact' })
          .eq('organization_id', auth.organizationId)
          .eq('project_id', query.project_id)
          .gte('timestamp', query.start_time)
          .lte('timestamp', query.end_time)
          .order('timestamp', { ascending: false })
          .range(offset, offset + query.limit - 1);
        
        if (query.model_name) {
          dbQuery = dbQuery.eq('model_name', query.model_name);
        }
        
        if (query.model_provider) {
          dbQuery = dbQuery.eq('model_provider', query.model_provider);
        }
        
        if (query.environment) {
          dbQuery = dbQuery.eq('environment', query.environment);
        }
        
        const { data, count, error } = await dbQuery;
        
        if (error) {
          console.error('LLM metrics query error:', error);
          return createErrorResponse('QUERY_ERROR', 'Failed to fetch metrics', 500);
        }
        
        return createSuccessResponse({
          items: data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: count || 0,
            total_pages: Math.ceil((count || 0) / query.limit),
            has_next: offset + query.limit < (count || 0),
            has_prev: query.page > 1,
          },
        });
      }
      
      default:
        return createErrorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
});
