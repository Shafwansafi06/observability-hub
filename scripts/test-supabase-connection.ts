/**
 * ObservAI Hub - Supabase Connection Test
 * Tests database connectivity and verifies all tables exist
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

// Load environment variables from .env file
config();

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('🔍 ObservAI Hub - Supabase Connection Test\n');
  console.log('📍 Supabase URL:', SUPABASE_URL);
  console.log('🔑 API Key:', SUPABASE_ANON_KEY!.substring(0, 20) + '...\n');

  const results: { test: string; status: string; details?: string }[] = [];

  // Test 1: Basic connection
  try {
    const { data, error } = await supabase.from('organizations').select('count', { count: 'exact', head: true });
    if (error) throw error;
    results.push({ test: 'Database Connection', status: '✅ PASS', details: `Connected successfully` });
  } catch (error: any) {
    results.push({ test: 'Database Connection', status: '❌ FAIL', details: error.message });
  }

  // Test 2: Check all required tables
  const tables = [
    'organizations',
    'projects',
    'user_profiles',
    'organization_members',
    'api_keys',
    'metrics',
    'llm_metrics',
    'logs',
    'spans',
    'alerts',
    'alert_rules',
    'incidents',
    'audit_logs'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
      if (error) throw error;
      results.push({ test: `Table: ${table}`, status: '✅ EXISTS' });
    } catch (error: any) {
      results.push({ test: `Table: ${table}`, status: '❌ MISSING', details: error.message });
    }
  }

  // Test 3: Check RLS policies (attempt unauthorized access)
  try {
    const { error } = await supabase.from('organizations').insert({ name: 'Test Org', slug: 'test' } as any);
    if (error && error.message.includes('row-level security')) {
      results.push({ test: 'RLS Policies', status: '✅ ACTIVE', details: 'Unauthorized access blocked' });
    } else {
      results.push({ test: 'RLS Policies', status: '⚠️  WARN', details: 'RLS may not be enforced' });
    }
  } catch (error: any) {
    results.push({ test: 'RLS Policies', status: '✅ ACTIVE', details: 'Access properly restricted' });
  }

  // Test 4: Check Edge Functions (if deployed)
  try {
    const { data, error } = await supabase.functions.invoke('ingest', {
      body: { type: 'metric', data: {} }
    });
    if (error && error.message.includes('not found')) {
      results.push({ test: 'Edge Functions', status: '⚠️  NOT DEPLOYED', details: 'Functions not yet deployed' });
    } else {
      results.push({ test: 'Edge Functions', status: '✅ DEPLOYED' });
    }
  } catch (error: any) {
    results.push({ test: 'Edge Functions', status: '⚠️  NOT DEPLOYED', details: 'Functions not accessible' });
  }

  // Print results
  console.log('\n📊 Test Results:\n');
  console.log('═'.repeat(80));
  results.forEach(({ test, status, details }) => {
    console.log(`${status.padEnd(12)} | ${test.padEnd(35)} ${details ? `| ${details}` : ''}`);
  });
  console.log('═'.repeat(80));

  const passed = results.filter(r => r.status.includes('✅')).length;
  const failed = results.filter(r => r.status.includes('❌')).length;
  const warnings = results.filter(r => r.status.includes('⚠️')).length;

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);

  if (failed > 0) {
    console.error('❌ Some tests failed. Please check your Supabase project setup.');
    process.exit(1);
  } else {
    console.log('✅ All critical tests passed! Supabase is ready.\n');
    process.exit(0);
  }
}

testConnection().catch((error) => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});
