/**
 * Health Check Endpoint
 * Use this to verify environment variables are set correctly
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      // Check which variables are set (but don't expose the values!)
      VERTEX_AI_API_KEY: process.env.VERTEX_AI_API_KEY ? '✅ Set' : '❌ Missing',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    deployment: {
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || 'unknown',
    }
  };

  res.status(200).json(health);
}
