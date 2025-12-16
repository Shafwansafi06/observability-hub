/**
 * Seed Data Utility
 * Populates database with demo data for testing and demonstration
 */

import { supabase } from './supabaseClient';

/**
 * Generate demo LLM requests with realistic data
 */
export async function seedLLMRequests(count: number = 50) {
  const models = ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'];
  const categories = ['general', 'summarization', 'code_generation', 'translation', 'explanation'];
  
  const requests = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000);
    
    const success = Math.random() > 0.05; // 95% success rate
    const latency = success 
      ? Math.floor(200 + Math.random() * 800) 
      : Math.floor(3000 + Math.random() * 7000);
    
    const tokens_in = Math.floor(50 + Math.random() * 500);
    const tokens_out = success ? Math.floor(100 + Math.random() * 900) : 0;
    const tokens_total = tokens_in + tokens_out;
    
    requests.push({
      model: models[Math.floor(Math.random() * models.length)],
      prompt: `Demo prompt ${i + 1}`,
      response: success ? `Demo response ${i + 1}` : null,
      prompt_category: categories[Math.floor(Math.random() * categories.length)],
      latency_ms: latency,
      tokens_in,
      tokens_out,
      tokens_total,
      cost_usd: (tokens_total / 1000) * 0.002,
      coherence_score: success ? 0.7 + Math.random() * 0.3 : null,
      toxicity_score: Math.random() * 0.1,
      hallucination_risk: Math.random() * 0.3,
      sentiment_score: success ? -0.5 + Math.random() : null,
      temperature: 0.7,
      max_tokens: 1024,
      success,
      error_message: success ? null : 'API timeout error',
      error_code: success ? null : 'TIMEOUT',
      retry_count: success ? 0 : Math.floor(Math.random() * 3),
      request_id: `req_${Date.now()}_${i}`,
      session_id: `session_${Math.floor(Math.random() * 10)}`,
      metadata: {},
      created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString(),
    });
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user. Please login first.');
      return { success: false, error: 'Not authenticated' };
    }

    // Add user_id to all requests
    const requestsWithUser = requests.map(req => ({ ...req, user_id: user.id }));
    
    const { data, error } = await (supabase
      .from('llm_requests') as any)
      .insert(requestsWithUser);
    
    if (error) {
      console.error('Error seeding LLM requests:', error);
      return { success: false, error };
    }
    
    console.log(`✅ Successfully seeded ${count} LLM requests`);
    return { success: true, count };
  } catch (error) {
    console.error('Exception seeding data:', error);
    return { success: false, error };
  }
}

/**
 * Generate demo alerts
 */
export async function seedAlerts(count: number = 10) {
  const alertTemplates = [
    {
      title: 'High Latency Detected',
      description: 'Model inference latency exceeded 1000ms threshold',
      severity: 'warning',
      source: 'Performance Monitor',
    },
    {
      title: 'Elevated Error Rate',
      description: 'Error rate has increased to 8% in the last 10 minutes',
      severity: 'critical',
      source: 'Error Tracking',
    },
    {
      title: 'Token Limit Approaching',
      description: 'Monthly token usage is at 85% of quota',
      severity: 'warning',
      source: 'Cost Monitor',
    },
    {
      title: 'Hallucination Risk Detected',
      description: 'Multiple responses flagged with high hallucination probability',
      severity: 'warning',
      source: 'Quality Analyzer',
    },
    {
      title: 'Unusual Traffic Pattern',
      description: 'Request rate spike detected: 300% above baseline',
      severity: 'critical',
      source: 'Traffic Monitor',
    },
    {
      title: 'Model Response Timeout',
      description: 'API timeout rate increased to 12%',
      severity: 'critical',
      source: 'Availability Monitor',
    },
    {
      title: 'Cost Spike Detected',
      description: 'Hourly cost exceeded $50 threshold',
      severity: 'warning',
      source: 'Cost Monitor',
    },
    {
      title: 'Low Coherence Scores',
      description: 'Average coherence score dropped below 0.7',
      severity: 'warning',
      source: 'Quality Analyzer',
    },
  ];
  
  const statuses: Array<'active' | 'acknowledged' | 'resolved'> = ['active', 'active', 'active', 'acknowledged', 'resolved'];
  const alerts = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const template = alertTemplates[i % alertTemplates.length];
    const hoursAgo = Math.floor(Math.random() * 48);
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    alerts.push({
      ...template,
      status,
      created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString(),
      acknowledged_at: status !== 'active' ? new Date(timestamp.getTime() + 1800000).toISOString() : null,
      resolved_at: status === 'resolved' ? new Date(timestamp.getTime() + 3600000).toISOString() : null,
    });
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user. Please login first.');
      return { success: false, error: 'Not authenticated' };
    }

    const alertsWithUser = alerts.map(alert => ({ ...alert, user_id: user.id }));
    
    const { data, error } = await (supabase
      .from('alerts') as any)
      .insert(alertsWithUser);
    
    if (error) {
      console.error('Error seeding alerts:', error);
      return { success: false, error };
    }
    
    console.log(`✅ Successfully seeded ${count} alerts`);
    return { success: true, count };
  } catch (error) {
    console.error('Exception seeding alerts:', error);
    return { success: false, error };
  }
}

/**
 * Generate demo logs
 */
export async function seedLogs(count: number = 100) {
  const services = ['api-gateway', 'llm-service', 'auth-service', 'data-pipeline', 'ml-analyzer'];
  const levels: Array<'info' | 'warning' | 'error' | 'critical'> = ['info', 'info', 'info', 'warning', 'error'];
  const messages = [
    'Request processed successfully',
    'Database query completed',
    'Cache hit for request',
    'Rate limit warning',
    'Slow query detected',
    'Connection timeout',
    'Invalid API key',
    'Request queued',
    'Batch processing complete',
    'Health check passed',
  ];
  
  const logs = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const minutesAgo = Math.floor(Math.random() * 1440); // Last 24 hours
    const timestamp = new Date(now.getTime() - minutesAgo * 60000);
    
    logs.push({
      level: levels[Math.floor(Math.random() * levels.length)],
      service: services[Math.floor(Math.random() * services.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      metadata: {
        request_id: `req_${Date.now()}_${i}`,
        duration_ms: Math.floor(Math.random() * 1000),
      },
      created_at: timestamp.toISOString(),
    });
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user. Please login first.');
      return { success: false, error: 'Not authenticated' };
    }

    const logsWithUser = logs.map(log => ({ ...log, user_id: user.id }));
    
    const { data, error } = await (supabase
      .from('logs') as any)
      .insert(logsWithUser);
    
    if (error) {
      console.error('Error seeding logs:', error);
      return { success: false, error };
    }
    
    console.log(`✅ Successfully seeded ${count} logs`);
    return { success: true, count };
  } catch (error) {
    console.error('Exception seeding logs:', error);
    return { success: false, error };
  }
}

/**
 * Seed all data types
 */
export async function seedAllData() {
  console.log('🌱 Starting data seeding...');
  
  const results = {
    llmRequests: await seedLLMRequests(50),
    alerts: await seedAlerts(10),
    logs: await seedLogs(100),
  };
  
  const allSuccess = Object.values(results).every(r => r.success);
  
  if (allSuccess) {
    console.log('✅ All data seeded successfully!');
    console.log('📊 Summary:');
    console.log(`  - LLM Requests: ${results.llmRequests.count}`);
    console.log(`  - Alerts: ${results.alerts.count}`);
    console.log(`  - Logs: ${results.logs.count}`);
  } else {
    console.error('❌ Some seed operations failed');
  }
  
  return results;
}

/**
 * Clear all demo data for a user
 */
export async function clearDemoData() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user. Please login first.');
      return { success: false, error: 'Not authenticated' };
    }

    console.log('🗑️ Clearing demo data...');
    
    await (supabase.from('llm_requests') as any).delete().eq('user_id', user.id);
    await (supabase.from('alerts') as any).delete().eq('user_id', user.id);
    await (supabase.from('logs') as any).delete().eq('user_id', user.id);
    
    console.log('✅ Demo data cleared successfully');
    return { success: true };
  } catch (error) {
    console.error('Error clearing demo data:', error);
    return { success: false, error };
  }
}

// Export window object for browser console access
if (typeof window !== 'undefined') {
  (window as any).seedData = {
    seedAllData,
    seedLLMRequests,
    seedAlerts,
    seedLogs,
    clearDemoData,
  };
  console.log('💡 Seed functions available via window.seedData');
}
