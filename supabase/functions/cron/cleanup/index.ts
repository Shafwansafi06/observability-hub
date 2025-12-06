/**
 * Cleanup Cron Job
 * 
 * Scheduled task that enforces data retention policies:
 * - Removes old metrics beyond retention period
 * - Archives old logs
 * - Cleans up resolved incidents
 * - Purges expired cache entries
 * - Vacuums and analyzes tables for performance
 * 
 * Schedule: Daily at 3:00 AM UTC
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Retention periods (in days)
const RETENTION_CONFIG = {
  metrics: {
    raw: 30,           // Raw metrics: 30 days
    hourly: 90,        // Hourly aggregates: 90 days
    daily: 365,        // Daily aggregates: 1 year
  },
  logs: {
    debug: 7,          // Debug logs: 7 days
    info: 30,          // Info logs: 30 days
    warn: 90,          // Warning logs: 90 days
    error: 365,        // Error logs: 1 year
  },
  llm_metrics: {
    raw: 90,           // LLM metrics: 90 days
    aggregated: 365,   // Aggregated: 1 year
  },
  incidents: {
    resolved: 180,     // Resolved incidents: 6 months
  },
  notifications: {
    read: 30,          // Read notifications: 30 days
  },
  api_keys: {
    revoked: 30,       // Revoked keys: 30 days
  },
};

interface CleanupStats {
  table: string;
  deletedRows: number;
  duration: number;
  error?: string;
}

interface CleanupReport {
  startTime: string;
  endTime: string;
  totalDuration: number;
  totalDeleted: number;
  stats: CleanupStats[];
  errors: string[];
}

// Type alias for Supabase client to avoid complex generics
type SupabaseAdminClient = ReturnType<typeof createClient>;

/**
 * Execute cleanup query with stats tracking
 */
async function executeCleanup(
  supabase: SupabaseAdminClient,
  tableName: string,
  query: string
): Promise<CleanupStats> {
  const startTime = Date.now();
  
  try {
    // Use raw SQL for DELETE operations with RETURNING to count
    const { data, error } = await supabase.rpc('execute_cleanup_query', {
      p_query: query,
    } as never);

    if (error) {
      throw error;
    }

    const result = data as { deleted_count: number } | null;
    return {
      table: tableName,
      deletedRows: result?.deleted_count || 0,
      duration: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Cleanup failed for ${tableName}:`, errorMessage);
    
    return {
      table: tableName,
      deletedRows: 0,
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Clean up old raw metrics
 */
async function cleanupMetrics(
  supabase: any
): Promise<CleanupStats[]> {
  const stats: CleanupStats[] = [];
  
  // Delete old raw metrics
  const rawCutoff = new Date();
  rawCutoff.setDate(rawCutoff.getDate() - RETENTION_CONFIG.metrics.raw);
  
  // Batch delete to avoid long-running transactions
  const batchSize = 10000;
  let totalDeleted = 0;
  let batchDeleted = 0;
  const startTime = Date.now();
  
  do {
    const { count, error } = await supabase
      .from('metrics')
      .delete({ count: 'exact' })
      .lt('timestamp', rawCutoff.toISOString())
      .limit(batchSize);
    
    if (error) {
      stats.push({
        table: 'metrics',
        deletedRows: totalDeleted,
        duration: Date.now() - startTime,
        error: error.message,
      });
      return stats;
    }
    
    batchDeleted = count || 0;
    totalDeleted += batchDeleted;
    
    // Small delay between batches to reduce load
    if (batchDeleted === batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (batchDeleted === batchSize);
  
  stats.push({
    table: 'metrics',
    deletedRows: totalDeleted,
    duration: Date.now() - startTime,
  });
  
  return stats;
}

/**
 * Clean up old LLM metrics
 */
async function cleanupLLMMetrics(
  supabase: any
): Promise<CleanupStats[]> {
  const stats: CleanupStats[] = [];
  
  const rawCutoff = new Date();
  rawCutoff.setDate(rawCutoff.getDate() - RETENTION_CONFIG.llm_metrics.raw);
  
  const startTime = Date.now();
  const { count, error } = await supabase
    .from('llm_metrics')
    .delete({ count: 'exact' })
    .lt('timestamp', rawCutoff.toISOString());
  
  stats.push({
    table: 'llm_metrics',
    deletedRows: count || 0,
    duration: Date.now() - startTime,
    error: error?.message,
  });
  
  return stats;
}

/**
 * Clean up old logs based on severity
 */
async function cleanupLogs(
  supabase: any
): Promise<CleanupStats[]> {
  const stats: CleanupStats[] = [];
  
  // Clean up each log level with different retention
  const logLevels: Array<{ level: string; days: number }> = [
    { level: 'debug', days: RETENTION_CONFIG.logs.debug },
    { level: 'info', days: RETENTION_CONFIG.logs.info },
    { level: 'warn', days: RETENTION_CONFIG.logs.warn },
    { level: 'error', days: RETENTION_CONFIG.logs.error },
  ];
  
  for (const { level, days } of logLevels) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const startTime = Date.now();
    const { count, error } = await supabase
      .from('logs')
      .delete({ count: 'exact' })
      .eq('level', level)
      .lt('timestamp', cutoff.toISOString());
    
    stats.push({
      table: `logs_${level}`,
      deletedRows: count || 0,
      duration: Date.now() - startTime,
      error: error?.message,
    });
  }
  
  return stats;
}

/**
 * Clean up old trace contexts
 */
async function cleanupTraceContexts(
  supabase: any
): Promise<CleanupStats> {
  // Trace contexts should live as long as their associated logs
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_CONFIG.logs.error); // Use longest retention
  
  const startTime = Date.now();
  const { count, error } = await supabase
    .from('trace_context')
    .delete({ count: 'exact' })
    .lt('start_time', cutoff.toISOString());
  
  return {
    table: 'trace_context',
    deletedRows: count || 0,
    duration: Date.now() - startTime,
    error: error?.message,
  };
}

/**
 * Clean up resolved incidents
 */
async function cleanupIncidents(
  supabase: any
): Promise<CleanupStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_CONFIG.incidents.resolved);
  
  const startTime = Date.now();
  const { count, error } = await supabase
    .from('incidents')
    .delete({ count: 'exact' })
    .eq('status', 'resolved')
    .lt('resolved_at', cutoff.toISOString());
  
  return {
    table: 'incidents',
    deletedRows: count || 0,
    duration: Date.now() - startTime,
    error: error?.message,
  };
}

/**
 * Clean up old notifications
 */
async function cleanupNotifications(
  supabase: any
): Promise<CleanupStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_CONFIG.notifications.read);
  
  const startTime = Date.now();
  const { count, error } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .eq('read', true)
    .lt('created_at', cutoff.toISOString());
  
  return {
    table: 'notifications',
    deletedRows: count || 0,
    duration: Date.now() - startTime,
    error: error?.message,
  };
}

/**
 * Clean up revoked API keys
 */
async function cleanupApiKeys(
  supabase: any
): Promise<CleanupStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_CONFIG.api_keys.revoked);
  
  const startTime = Date.now();
  const { count, error } = await supabase
    .from('api_keys')
    .delete({ count: 'exact' })
    .eq('revoked', true)
    .lt('updated_at', cutoff.toISOString());
  
  return {
    table: 'api_keys',
    deletedRows: count || 0,
    duration: Date.now() - startTime,
    error: error?.message,
  };
}

/**
 * Archive old data to cold storage (placeholder for S3/GCS integration)
 */
async function archiveOldData(
  _supabase: any
): Promise<void> {
  // TODO: Implement archival to cold storage
  // This would export old data to S3/GCS before deletion
  // For now, this is a placeholder
  console.log('Archival to cold storage not yet implemented');
}

/**
 * Refresh materialized views after cleanup
 */
async function refreshMaterializedViews(
  supabase: any
): Promise<CleanupStats[]> {
  const stats: CleanupStats[] = [];
  
  const views = [
    'metrics_hourly_summary',
    'metrics_daily_summary',
    'llm_metrics_summary',
    'project_metrics_overview',
    'alert_summary_by_project',
  ];
  
  for (const view of views) {
    const startTime = Date.now();
    try {
      const { error } = await supabase.rpc('refresh_materialized_view', {
        view_name: view,
      } as never);
      
      stats.push({
        table: `matview_${view}`,
        deletedRows: 0, // Not applicable for refresh
        duration: Date.now() - startTime,
        error: error?.message,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stats.push({
        table: `matview_${view}`,
        deletedRows: 0,
        duration: Date.now() - startTime,
        error: errorMessage,
      });
    }
  }
  
  return stats;
}

/**
 * Log cleanup report to the database
 */
async function logCleanupReport(
  supabase: any,
  report: CleanupReport
): Promise<void> {
  try {
    const logEntry = {
      level: report.errors.length > 0 ? 'warn' : 'info',
      category: 'cleanup',
      message: `Cleanup completed: ${report.totalDeleted} rows deleted in ${report.totalDuration}ms`,
      metadata: {
        stats: report.stats,
        errors: report.errors,
      },
      timestamp: new Date().toISOString(),
    };
    await supabase.from('system_logs').insert(logEntry as never);
  } catch (error) {
    console.error('Failed to log cleanup report:', error);
  }
}

/**
 * Main cleanup handler
 */
async function handleCleanup(): Promise<CleanupReport> {
  const startTime = Date.now();
  const report: CleanupReport = {
    startTime: new Date().toISOString(),
    endTime: '',
    totalDuration: 0,
    totalDeleted: 0,
    stats: [],
    errors: [],
  };
  
  console.log('Starting scheduled cleanup...');
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  try {
    // Run all cleanup tasks
    const tasks = await Promise.allSettled([
      cleanupMetrics(supabase),
      cleanupLLMMetrics(supabase),
      cleanupLogs(supabase),
      cleanupTraceContexts(supabase),
      cleanupIncidents(supabase),
      cleanupNotifications(supabase),
      cleanupApiKeys(supabase),
    ]);
    
    // Process results
    for (const task of tasks) {
      if (task.status === 'fulfilled') {
        const result = task.value;
        if (Array.isArray(result)) {
          report.stats.push(...result);
        } else {
          report.stats.push(result);
        }
      } else {
        report.errors.push(task.reason?.message || 'Unknown error');
      }
    }
    
    // Calculate totals
    report.totalDeleted = report.stats.reduce(
      (sum, stat) => sum + stat.deletedRows,
      0
    );
    
    // Collect errors from stats
    for (const stat of report.stats) {
      if (stat.error) {
        report.errors.push(`${stat.table}: ${stat.error}`);
      }
    }
    
    // Archive old data (optional)
    await archiveOldData(supabase);
    
    // Refresh materialized views
    const refreshStats = await refreshMaterializedViews(supabase);
    report.stats.push(...refreshStats);
    
    // Finalize report
    report.endTime = new Date().toISOString();
    report.totalDuration = Date.now() - startTime;
    
    // Log report to database
    await logCleanupReport(supabase, report);
    
    console.log('Cleanup completed:', {
      totalDeleted: report.totalDeleted,
      duration: report.totalDuration,
      errorCount: report.errors.length,
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup failed:', errorMessage);
    report.errors.push(`Fatal error: ${errorMessage}`);
    report.endTime = new Date().toISOString();
    report.totalDuration = Date.now() - startTime;
  }
  
  return report;
}

// Main HTTP handler
serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    // Verify this is a valid cron invocation
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    // Allow service role key or cron secret
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
          name: 'cleanup',
          schedule: 'daily at 3:00 AM UTC',
          retention: RETENTION_CONFIG,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (req.method === 'POST') {
      // Run cleanup
      const report = await handleCleanup();
      
      return new Response(
        JSON.stringify({
          success: report.errors.length === 0,
          report,
          processingTime: Date.now() - startTime,
        }),
        { 
          status: report.errors.length === 0 ? 200 : 207,
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
    console.error('Cleanup handler error:', errorMessage);
    
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
