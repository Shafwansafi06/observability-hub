/**
 * ObservAI Hub - Alerts Edge Function
 * 
 * Manage alert rules, alerts, and acknowledgments.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, handleCorsPreFlight, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { authenticate, createAdminClient, checkOrgRole } from '../_shared/auth.ts';
import { createCacheClient, cacheKeys, cacheTTL } from '../_shared/cache.ts';

// =====================================================
// SCHEMAS
// =====================================================

const alertConditionConfigSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'ne']),
  threshold: z.number(),
  for_duration: z.string().regex(/^\d+[smhd]$/),
});

const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  project_id: z.string().uuid().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
  condition_type: z.enum(['threshold', 'anomaly', 'absence', 'rate_change', 'pattern']),
  condition_config: alertConditionConfigSchema,
  query: z.string().min(1),
  evaluation_interval_seconds: z.number().int().min(10).max(3600).optional().default(60),
  pending_period_seconds: z.number().int().min(0).max(3600).optional().default(300),
  labels: z.record(z.string()).optional().default({}),
  annotations: z.record(z.string()).optional().default({}),
  group_by: z.array(z.string()).optional().default([]),
  notification_channels: z.array(z.string().uuid()).optional().default([]),
  auto_resolve: z.boolean().optional().default(true),
  resolve_after_seconds: z.number().int().min(60).max(86400).optional().default(300),
});

const updateAlertRuleSchema = createAlertRuleSchema.partial().extend({
  enabled: z.boolean().optional(),
});

const acknowledgeAlertSchema = z.object({
  comment: z.string().max(1000).optional(),
});

const resolveAlertSchema = z.object({
  resolution_note: z.string().max(1000).optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// =====================================================
// HANDLER
// =====================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/alerts', '').split('/').filter(Boolean);
  
  try {
    const auth = await authenticate(req);
    
    if (!auth.authenticated) {
      return createErrorResponse('UNAUTHORIZED', auth.error || 'Authentication required', 401);
    }
    
    const adminClient = createAdminClient();
    const cache = createCacheClient();
    
    // GET /alerts - List alerts
    if (req.method === 'GET' && pathParts.length === 0) {
      const params = Object.fromEntries(url.searchParams);
      
      const page = parseInt(params.page || '1');
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = (page - 1) * limit;
      
      let query = adminClient
        .from('alerts')
        .select('*, alert_rules(name, severity)', { count: 'exact' })
        .eq('organization_id', auth.organizationId)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (params.project_id) {
        query = query.eq('project_id', params.project_id);
      }
      
      if (params.status) {
        query = query.in('status', params.status.split(','));
      }
      
      if (params.severity) {
        query = query.in('severity', params.severity.split(','));
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        console.error('Alerts query error:', error);
        return createErrorResponse('QUERY_ERROR', 'Failed to fetch alerts', 500);
      }
      
      return createSuccessResponse({
        items: data,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      });
    }
    
    // GET /alerts/summary - Get alerts summary
    if (req.method === 'GET' && pathParts[0] === 'summary') {
      const cacheKey = cacheKeys.alertsCount(auth.organizationId!);
      
      const cached = await cache.get(cacheKey);
      if (cached) {
        return createSuccessResponse(cached, 200, { cached: true });
      }
      
      const { data, error } = await adminClient.rpc('get_alerts_summary', {
        p_org_id: auth.organizationId,
      });
      
      if (error) {
        console.error('Alerts summary error:', error);
        return createErrorResponse('QUERY_ERROR', 'Failed to fetch alerts summary', 500);
      }
      
      const summary = data?.[0] || {
        total_active: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        pending_count: 0,
        firing_count: 0,
        acknowledged_count: 0,
      };
      
      await cache.set(cacheKey, summary, cacheTTL.alertsCount);
      
      return createSuccessResponse(summary);
    }
    
    // GET /alerts/rules - List alert rules
    if (req.method === 'GET' && pathParts[0] === 'rules') {
      const params = Object.fromEntries(url.searchParams);
      
      let query = adminClient
        .from('alert_rules')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .order('created_at', { ascending: false });
      
      if (params.project_id) {
        query = query.eq('project_id', params.project_id);
      }
      
      if (params.enabled !== undefined) {
        query = query.eq('enabled', params.enabled === 'true');
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Alert rules query error:', error);
        return createErrorResponse('QUERY_ERROR', 'Failed to fetch alert rules', 500);
      }
      
      return createSuccessResponse(data);
    }
    
    // POST /alerts/rules - Create alert rule
    if (req.method === 'POST' && pathParts[0] === 'rules') {
      // Check admin permission
      if (auth.authType === 'jwt') {
        const isAdmin = await checkOrgRole(auth.userId!, auth.organizationId!, ['owner', 'admin']);
        if (!isAdmin) {
          return createErrorResponse('FORBIDDEN', 'Admin role required', 403);
        }
      } else if (!auth.scopes?.includes('admin')) {
        return createErrorResponse('FORBIDDEN', 'Admin scope required', 403);
      }
      
      const body = await req.json();
      const validation = createAlertRuleSchema.safeParse(body);
      
      if (!validation.success) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid request body', 400, {
          errors: validation.error.errors,
        });
      }
      
      const { data, error } = await adminClient
        .from('alert_rules')
        .insert({
          ...validation.data,
          organization_id: auth.organizationId,
          created_by: auth.userId,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Create alert rule error:', error);
        return createErrorResponse('CREATE_ERROR', 'Failed to create alert rule', 500);
      }
      
      return createSuccessResponse(data, 201);
    }
    
    // PATCH /alerts/rules/:id - Update alert rule
    if (req.method === 'PATCH' && pathParts[0] === 'rules' && pathParts[1]) {
      const ruleId = pathParts[1];
      
      // Check admin permission
      if (auth.authType === 'jwt') {
        const isAdmin = await checkOrgRole(auth.userId!, auth.organizationId!, ['owner', 'admin']);
        if (!isAdmin) {
          return createErrorResponse('FORBIDDEN', 'Admin role required', 403);
        }
      } else if (!auth.scopes?.includes('admin')) {
        return createErrorResponse('FORBIDDEN', 'Admin scope required', 403);
      }
      
      const body = await req.json();
      const validation = updateAlertRuleSchema.safeParse(body);
      
      if (!validation.success) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid request body', 400, {
          errors: validation.error.errors,
        });
      }
      
      const { data, error } = await adminClient
        .from('alert_rules')
        .update(validation.data)
        .eq('id', ruleId)
        .eq('organization_id', auth.organizationId)
        .select()
        .single();
      
      if (error) {
        console.error('Update alert rule error:', error);
        return createErrorResponse('UPDATE_ERROR', 'Failed to update alert rule', 500);
      }
      
      return createSuccessResponse(data);
    }
    
    // DELETE /alerts/rules/:id - Delete alert rule
    if (req.method === 'DELETE' && pathParts[0] === 'rules' && pathParts[1]) {
      const ruleId = pathParts[1];
      
      // Check admin permission
      if (auth.authType === 'jwt') {
        const isAdmin = await checkOrgRole(auth.userId!, auth.organizationId!, ['owner', 'admin']);
        if (!isAdmin) {
          return createErrorResponse('FORBIDDEN', 'Admin role required', 403);
        }
      } else if (!auth.scopes?.includes('admin')) {
        return createErrorResponse('FORBIDDEN', 'Admin scope required', 403);
      }
      
      const { error } = await adminClient
        .from('alert_rules')
        .delete()
        .eq('id', ruleId)
        .eq('organization_id', auth.organizationId);
      
      if (error) {
        console.error('Delete alert rule error:', error);
        return createErrorResponse('DELETE_ERROR', 'Failed to delete alert rule', 500);
      }
      
      return createSuccessResponse({ deleted: true });
    }
    
    // POST /alerts/:id/acknowledge - Acknowledge alert
    if (req.method === 'POST' && pathParts[1] === 'acknowledge') {
      const alertId = pathParts[0];
      
      const body = await req.json();
      const validation = acknowledgeAlertSchema.safeParse(body);
      
      if (!validation.success) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid request body', 400);
      }
      
      const { data, error } = await adminClient.rpc('acknowledge_alert', {
        p_alert_id: alertId,
        p_acknowledged_by: auth.userId,
      });
      
      if (error || !data) {
        console.error('Acknowledge alert error:', error);
        return createErrorResponse('UPDATE_ERROR', 'Failed to acknowledge alert', 500);
      }
      
      // Add comment if provided
      if (validation.data.comment && auth.userId) {
        await adminClient.from('alert_comments').insert({
          alert_id: alertId,
          user_id: auth.userId,
          content: `[Acknowledged] ${validation.data.comment}`,
        });
      }
      
      // Invalidate cache
      await cache.del(cacheKeys.alertsCount(auth.organizationId!));
      
      return createSuccessResponse({ acknowledged: true });
    }
    
    // POST /alerts/:id/resolve - Resolve alert
    if (req.method === 'POST' && pathParts[1] === 'resolve') {
      const alertId = pathParts[0];
      
      const body = await req.json();
      const validation = resolveAlertSchema.safeParse(body);
      
      if (!validation.success) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid request body', 400);
      }
      
      const { data, error } = await adminClient.rpc('resolve_alert', {
        p_alert_id: alertId,
        p_resolved_by: auth.userId,
        p_resolution_type: 'manual',
        p_resolution_note: validation.data.resolution_note,
      });
      
      if (error || !data) {
        console.error('Resolve alert error:', error);
        return createErrorResponse('UPDATE_ERROR', 'Failed to resolve alert', 500);
      }
      
      // Invalidate cache
      await cache.del(cacheKeys.alertsCount(auth.organizationId!));
      
      return createSuccessResponse({ resolved: true });
    }
    
    // GET /alerts/:id - Get single alert
    if (req.method === 'GET' && pathParts.length === 1) {
      const alertId = pathParts[0];
      
      const { data, error } = await adminClient
        .from('alerts')
        .select('*, alert_rules(name, severity, description), alert_comments(*, user_profiles(full_name, avatar_url))')
        .eq('id', alertId)
        .eq('organization_id', auth.organizationId)
        .single();
      
      if (error) {
        console.error('Get alert error:', error);
        return createErrorResponse('NOT_FOUND', 'Alert not found', 404);
      }
      
      return createSuccessResponse(data);
    }
    
    // POST /alerts/:id/comments - Add comment
    if (req.method === 'POST' && pathParts[1] === 'comments') {
      const alertId = pathParts[0];
      
      if (!auth.userId) {
        return createErrorResponse('FORBIDDEN', 'User authentication required', 403);
      }
      
      const body = await req.json();
      const validation = addCommentSchema.safeParse(body);
      
      if (!validation.success) {
        return createErrorResponse('VALIDATION_ERROR', 'Invalid request body', 400);
      }
      
      const { data, error } = await adminClient
        .from('alert_comments')
        .insert({
          alert_id: alertId,
          user_id: auth.userId,
          content: validation.data.content,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Add comment error:', error);
        return createErrorResponse('CREATE_ERROR', 'Failed to add comment', 500);
      }
      
      return createSuccessResponse(data, 201);
    }
    
    return createErrorResponse('NOT_FOUND', 'Endpoint not found', 404);
    
  } catch (error) {
    console.error('Alerts endpoint error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
});
