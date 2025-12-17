/**
 * Diagnostic endpoint to check environment variables in Vercel
 * Access at: /api/diagnostic
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      // Check for AI keys (don't expose actual values!)
      VERTEX_AI_API_KEY: process.env.VERTEX_AI_API_KEY ? '✅ Set' : '❌ Not set',
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || process.env.VITE_GCP_PROJECT_ID || '❌ Not set',
      VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION || 'us-central1 (default)',
      GCP_SERVICE_ACCOUNT_KEY: process.env.GCP_SERVICE_ACCOUNT_KEY ? '✅ Set' : '❌ Not set',
      
      // Supabase
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not set',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set',
      
      // Datadog
      VITE_DD_APPLICATION_ID: process.env.VITE_DD_APPLICATION_ID ? '✅ Set' : '❌ Not set',
      VITE_DD_CLIENT_TOKEN: process.env.VITE_DD_CLIENT_TOKEN ? '✅ Set' : '❌ Not set',
      DD_API_KEY: process.env.DD_API_KEY ? '✅ Set' : '❌ Not set',
    },
    availableEnvVars: Object.keys(process.env)
      .filter(key => 
        key.includes('VERTEX') || 
        key.includes('GCP') || 
        key.includes('SUPABASE') ||
        key.includes('DATADOG') ||
        key.includes('DD_')
      )
      .sort(),
    recommendations: [] as Array<{ priority: string; issue: string; solution: string; value: string }>
  };

  // Add recommendations based on missing vars
  if (!process.env.VERTEX_AI_API_KEY) {
    diagnostics.recommendations.push({
      priority: 'CRITICAL',
      issue: 'VERTEX_AI_API_KEY not configured',
      solution: 'Add VERTEX_AI_API_KEY (no VITE_ prefix) in Vercel Dashboard → Settings → Environment Variables',
      value: 'Your Google Cloud API Key from https://console.cloud.google.com/apis/credentials'
    });
  }

  if (!process.env.GCP_PROJECT_ID && !process.env.VITE_GCP_PROJECT_ID) {
    diagnostics.recommendations.push({
      priority: 'HIGH',
      issue: 'GCP_PROJECT_ID not configured',
      solution: 'Add GCP_PROJECT_ID (or VITE_GCP_PROJECT_ID) with your Google Cloud project ID',
      value: 'e.g., utility-gravity-461209-p0'
    });
  }

  res.status(200).json(diagnostics);
}
