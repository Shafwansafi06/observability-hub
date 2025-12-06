/**
 * Check Alerts Cron Job
 * 
 * Scheduled task that evaluates alert rules against metrics:
 * - Checks threshold-based alerts
 * - Evaluates rate-based conditions
 * - Creates or updates incidents
 * - Sends notifications via configured channels
 * 
 * Schedule: Every minute
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Alert evaluation configuration
const CONFIG = {
  evaluationWindow: 60 * 1000,  // 1 minute evaluation window
  maxRulesPerBatch: 100,        // Max rules to evaluate per run
  notificationCooldown: 300,    // 5 minutes between repeat notifications
};

// Types
interface AlertRule {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  metric_type: string;
  condition: {
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
    threshold: number;
    aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'p95' | 'p99';
    window_minutes?: number;
    consecutive_breaches?: number;
  };
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  channels: string[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  metadata: Record<string, unknown>;
}

interface MetricValue {
  value: number;
  timestamp: string;
}

interface EvaluationResult {
  rule_id: string;
  triggered: boolean;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

interface NotificationPayload {
  channel: string;
  alert: AlertRule;
  result: EvaluationResult;
  incident_id?: string;
}

/**
 * Evaluate condition against a value
 */
function evaluateCondition(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'ne': return value !== threshold;
    default: return false;
  }
}

/**
 * Get operator display string
 */
function operatorToString(operator: string): string {
  switch (operator) {
    case 'gt': return '>';
    case 'lt': return '<';
    case 'gte': return '>=';
    case 'lte': return '<=';
    case 'eq': return '=';
    case 'ne': return '!=';
    default: return operator;
  }
}

/**
 * Calculate aggregated metric value
 */
async function getAggregatedMetric(
  supabase: SupabaseClient,
  projectId: string,
  metricType: string,
  aggregation: string,
  windowMinutes: number
): Promise<number | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  // Use different aggregation strategies based on type
  let query = supabase
    .from('metrics')
    .select('value')
    .eq('project_id', projectId)
    .eq('name', metricType)
    .gte('timestamp', since);
  
  const { data, error } = await query;
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  const values = data.map((d: { value: number }) => d.value).sort((a: number, b: number) => a - b);
  
  switch (aggregation) {
    case 'avg':
      return values.reduce((a: number, b: number) => a + b, 0) / values.length;
    case 'sum':
      return values.reduce((a: number, b: number) => a + b, 0);
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'p95':
      return values[Math.floor(values.length * 0.95)] ?? values[values.length - 1];
    case 'p99':
      return values[Math.floor(values.length * 0.99)] ?? values[values.length - 1];
    default:
      return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  }
}

/**
 * Get LLM-specific metrics
 */
async function getLLMMetric(
  supabase: SupabaseClient,
  projectId: string,
  metricType: string,
  windowMinutes: number
): Promise<number | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  // Map metric types to LLM metric columns
  const columnMap: Record<string, string> = {
    'llm.latency': 'latency_ms',
    'llm.tokens.input': 'input_tokens',
    'llm.tokens.output': 'output_tokens',
    'llm.tokens.total': 'total_tokens',
    'llm.cost': 'cost',
    'llm.error_rate': 'status',
  };
  
  const column = columnMap[metricType];
  if (!column) return null;
  
  // Special handling for error rate
  if (metricType === 'llm.error_rate') {
    const { data, error } = await supabase
      .from('llm_metrics')
      .select('status')
      .eq('project_id', projectId)
      .gte('timestamp', since);
    
    if (error || !data || data.length === 0) return null;
    
    const errorCount = data.filter((d: { status: string }) => d.status === 'error').length;
    return (errorCount / data.length) * 100;
  }
  
  // Standard aggregation
  const { data, error } = await supabase
    .from('llm_metrics')
    .select(column)
    .eq('project_id', projectId)
    .gte('timestamp', since);
  
  if (error || !data || data.length === 0) return null;
  
  // Cast data to the expected shape
  const records = data as unknown as Array<Record<string, number>>;
  const values = records.map((d) => d[column]).filter((v) => v !== null && v !== undefined) as number[];
  return values.reduce((a: number, b: number) => a + b, 0) / values.length;
}

/**
 * Evaluate a single alert rule
 */
async function evaluateRule(
  supabase: SupabaseClient,
  rule: AlertRule
): Promise<EvaluationResult> {
  const windowMinutes = rule.condition.window_minutes || 5;
  const aggregation = rule.condition.aggregation || 'avg';
  
  // Determine if this is an LLM metric
  const isLLMMetric = rule.metric_type.startsWith('llm.');
  
  // Get the metric value
  let value: number | null;
  if (isLLMMetric) {
    value = await getLLMMetric(
      supabase,
      rule.project_id,
      rule.metric_type,
      windowMinutes
    );
  } else {
    value = await getAggregatedMetric(
      supabase,
      rule.project_id,
      rule.metric_type,
      aggregation,
      windowMinutes
    );
  }
  
  // Handle no data case
  if (value === null) {
    return {
      rule_id: rule.id,
      triggered: false,
      value: 0,
      threshold: rule.condition.threshold,
      message: `No data available for metric ${rule.metric_type}`,
      timestamp: new Date().toISOString(),
    };
  }
  
  // Evaluate the condition
  const triggered = evaluateCondition(
    value,
    rule.condition.operator,
    rule.condition.threshold
  );
  
  const operatorStr = operatorToString(rule.condition.operator);
  const message = triggered
    ? `Alert "${rule.name}" triggered: ${rule.metric_type} ${aggregation}(${windowMinutes}m) = ${value.toFixed(2)} ${operatorStr} ${rule.condition.threshold}`
    : `Alert "${rule.name}" OK: ${rule.metric_type} ${aggregation}(${windowMinutes}m) = ${value.toFixed(2)}`;
  
  return {
    rule_id: rule.id,
    triggered,
    value,
    threshold: rule.condition.threshold,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if rule is in cooldown period
 */
function isInCooldown(rule: AlertRule): boolean {
  if (!rule.last_triggered_at) return false;
  
  const cooldownMs = rule.cooldown_minutes * 60 * 1000;
  const lastTriggered = new Date(rule.last_triggered_at).getTime();
  
  return Date.now() - lastTriggered < cooldownMs;
}

/**
 * Create or update incident for triggered alert
 */
async function handleIncident(
  supabase: SupabaseClient,
  rule: AlertRule,
  result: EvaluationResult
): Promise<string | null> {
  // Check for existing open incident
  const { data: existingIncident } = await supabase
    .from('incidents')
    .select('id, occurrence_count')
    .eq('alert_rule_id', rule.id)
    .in('status', ['open', 'acknowledged'])
    .single();
  
  if (existingIncident) {
    // Update existing incident
    await supabase
      .from('incidents')
      .update({
        occurrence_count: existingIncident.occurrence_count + 1,
        last_occurrence_at: new Date().toISOString(),
        metadata: {
          last_value: result.value,
          last_message: result.message,
        },
      })
      .eq('id', existingIncident.id);
    
    return existingIncident.id;
  }
  
  // Create new incident
  const { data: newIncident, error } = await supabase
    .from('incidents')
    .insert({
      project_id: rule.project_id,
      alert_rule_id: rule.id,
      title: `Alert: ${rule.name}`,
      description: result.message,
      severity: rule.severity,
      status: 'open',
      occurrence_count: 1,
      first_occurrence_at: new Date().toISOString(),
      last_occurrence_at: new Date().toISOString(),
      metadata: {
        value: result.value,
        threshold: result.threshold,
        metric_type: rule.metric_type,
      },
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create incident:', error);
    return null;
  }
  
  return newIncident?.id ?? null;
}

/**
 * Resolve open incidents when alert clears
 */
async function resolveIncident(
  supabase: SupabaseClient,
  ruleId: string
): Promise<void> {
  await supabase
    .from('incidents')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('alert_rule_id', ruleId)
    .in('status', ['open', 'acknowledged']);
}

/**
 * Send notification through configured channels
 */
async function sendNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<void> {
  const { channel, alert, result, incident_id } = payload;
  
  // Create notification record
  await supabase.from('notifications').insert({
    project_id: alert.project_id,
    incident_id,
    channel,
    type: 'alert',
    title: `[${alert.severity.toUpperCase()}] ${alert.name}`,
    message: result.message,
    metadata: {
      rule_id: alert.id,
      value: result.value,
      threshold: result.threshold,
    },
    status: 'pending',
  });
  
  // TODO: Implement actual channel delivery (email, Slack, PagerDuty, etc.)
  // This would integrate with external services
  switch (channel) {
    case 'email':
      console.log('Would send email notification:', result.message);
      break;
    case 'slack':
      console.log('Would send Slack notification:', result.message);
      break;
    case 'pagerduty':
      console.log('Would send PagerDuty notification:', result.message);
      break;
    case 'webhook':
      console.log('Would call webhook:', result.message);
      break;
    default:
      console.log(`Unknown channel ${channel}:`, result.message);
  }
}

/**
 * Process evaluation results
 */
async function processResults(
  supabase: SupabaseClient,
  rules: AlertRule[],
  results: EvaluationResult[]
): Promise<{ triggered: number; resolved: number; notified: number }> {
  let triggered = 0;
  let resolved = 0;
  let notified = 0;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const rule = rules[i];
    
    if (result.triggered) {
      triggered++;
      
      // Create/update incident
      const incidentId = await handleIncident(supabase, rule, result);
      
      // Check cooldown before sending notifications
      if (!isInCooldown(rule)) {
        // Send notifications to all configured channels
        for (const channel of rule.channels) {
          await sendNotification(supabase, {
            channel,
            alert: rule,
            result,
            incident_id: incidentId ?? undefined,
          });
          notified++;
        }
        
        // Update last triggered timestamp
        await supabase
          .from('alert_rules')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', rule.id);
      }
      
      // Create alert record
      await supabase.from('alerts').insert({
        project_id: rule.project_id,
        rule_id: rule.id,
        severity: rule.severity,
        status: 'active',
        message: result.message,
        metric_value: result.value,
        threshold_value: result.threshold,
        triggered_at: new Date().toISOString(),
        metadata: {
          metric_type: rule.metric_type,
          condition: rule.condition,
        },
      });
      
    } else {
      // Check if we should resolve existing incidents
      const { data: openIncident } = await supabase
        .from('incidents')
        .select('id')
        .eq('alert_rule_id', rule.id)
        .in('status', ['open', 'acknowledged'])
        .single();
      
      if (openIncident) {
        await resolveIncident(supabase, rule.id);
        resolved++;
      }
    }
  }
  
  return { triggered, resolved, notified };
}

/**
 * Main alert check handler
 */
async function handleAlertCheck(): Promise<{
  rulesEvaluated: number;
  triggered: number;
  resolved: number;
  notified: number;
  errors: string[];
}> {
  const errors: string[] = [];
  
  console.log('Starting alert evaluation...');
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  // Fetch enabled alert rules
  const { data: rules, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('enabled', true)
    .limit(CONFIG.maxRulesPerBatch);
  
  if (rulesError) {
    errors.push(`Failed to fetch rules: ${rulesError.message}`);
    return { rulesEvaluated: 0, triggered: 0, resolved: 0, notified: 0, errors };
  }
  
  if (!rules || rules.length === 0) {
    console.log('No enabled alert rules found');
    return { rulesEvaluated: 0, triggered: 0, resolved: 0, notified: 0, errors };
  }
  
  console.log(`Evaluating ${rules.length} alert rules...`);
  
  // Evaluate all rules
  const evaluationPromises = rules.map((rule: AlertRule) => 
    evaluateRule(supabase, rule).catch((error: Error) => {
      errors.push(`Rule ${rule.id}: ${error.message}`);
      return {
        rule_id: rule.id,
        triggered: false,
        value: 0,
        threshold: rule.condition.threshold,
        message: `Evaluation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    })
  );
  
  const results = await Promise.all(evaluationPromises);
  
  // Process results
  const stats = await processResults(supabase, rules, results);
  
  console.log('Alert check completed:', {
    rulesEvaluated: rules.length,
    ...stats,
    errorCount: errors.length,
  });
  
  return {
    rulesEvaluated: rules.length,
    ...stats,
    errors,
  };
}

// Main HTTP handler
serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    const isAuthorized = 
      authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` ||
      authHeader === `Bearer ${cronSecret}`;
    
    if (!isAuthorized && cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle different HTTP methods
    if (req.method === 'GET') {
      // Health check
      return new Response(
        JSON.stringify({
          status: 'ok',
          name: 'check-alerts',
          schedule: 'every minute',
          config: CONFIG,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (req.method === 'POST') {
      // Run alert check
      const result = await handleAlertCheck();
      
      return new Response(
        JSON.stringify({
          success: result.errors.length === 0,
          ...result,
          processingTime: Date.now() - startTime,
        }),
        { 
          status: result.errors.length === 0 ? 200 : 207,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alert check handler error:', errorMessage);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
        processingTime: Date.now() - startTime,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
