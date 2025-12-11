#!/usr/bin/env node
/**
 * Import AI/ML Detection Rules to Datadog
 * 
 * This script imports all 40 AI/ML detection rules to your Datadog account.
 * 
 * Prerequisites:
 * - DD_API_KEY environment variable set
 * - DD_APP_KEY environment variable set (create at: https://app.datadoghq.com/organization-settings/application-keys)
 * - DD_SITE environment variable set (e.g., us5.datadoghq.com)
 * 
 * Usage:
 *   node scripts/import-detection-rules.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DD_SITE = process.env.DD_SITE || 'us5.datadoghq.com';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

if (!DD_API_KEY || !DD_APP_KEY) {
  console.error('❌ Error: DD_API_KEY and DD_APP_KEY environment variables are required.');
  console.error('\n📝 Setup instructions:');
  console.error('1. Get API key: https://app.datadoghq.com/organization-settings/api-keys');
  console.error('2. Get APP key: https://app.datadoghq.com/organization-settings/application-keys');
  console.error('3. Export them: export DD_API_KEY=xxx DD_APP_KEY=yyy');
  console.error('4. Run again: node scripts/import-detection-rules.js');
  process.exit(1);
}

// Load detection rules
const rulesPath = path.join(__dirname, '..', 'datadog', 'monitors', 'ai-ml-detection-rules.json');
let detectionRules;

try {
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  detectionRules = JSON.parse(rulesContent);
} catch (error) {
  console.error(`❌ Error loading detection rules from ${rulesPath}:`, error.message);
  process.exit(1);
}

console.log('🚀 Starting Datadog Detection Rules Import');
console.log(`📊 Total rules to import: ${detectionRules.metadata.total_rules}`);
console.log(`📁 Categories: ${detectionRules.metadata.categories}\n`);

// Function to create a monitor in Datadog
async function createMonitor(rule) {
  const url = `https://api.${DD_SITE}/api/v1/monitor`;
  
  const monitorPayload = {
    name: rule.name,
    type: rule.type,
    query: rule.query,
    message: rule.message,
    tags: rule.tags,
    priority: rule.priority,
    options: {
      notify_no_data: false,
      notify_audit: false,
      require_full_window: false,
      include_tags: true,
      new_group_delay: 60,
      evaluation_delay: 60,
      thresholds: rule.thresholds || {}
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': DD_API_KEY,
        'DD-APPLICATION-KEY': DD_APP_KEY
      },
      body: JSON.stringify(monitorPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { success: true, id: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Import all rules
async function importAllRules() {
  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (const category of detectionRules.detection_rules) {
    console.log(`\n📂 Category: ${category.category}`);
    console.log(`   Rules: ${category.rules.length}`);
    
    for (const rule of category.rules) {
      process.stdout.write(`   ⏳ Importing ${rule.id}: ${rule.name}...`);
      
      const result = await createMonitor(rule);
      
      if (result.success) {
        successCount++;
        console.log(` ✅ Success (ID: ${result.id})`);
        results.push({ rule: rule.id, status: 'success', monitorId: result.id });
      } else {
        failCount++;
        console.log(` ❌ Failed: ${result.error}`);
        results.push({ rule: rule.id, status: 'failed', error: result.error });
      }
      
      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully imported: ${successCount} rules`);
  console.log(`❌ Failed to import: ${failCount} rules`);
  console.log(`📈 Success rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
  
  if (failCount > 0) {
    console.log('\n❌ Failed rules:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`   - ${r.rule}: ${r.error}`);
    });
  }
  
  console.log('\n🎉 Import complete!');
  console.log(`\n🔗 View your monitors: https://app.${DD_SITE}/monitors/manage`);
  
  // Save results to file
  const resultsPath = path.join(__dirname, '..', 'datadog', 'import-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ 
    timestamp: new Date().toISOString(),
    summary: { total: successCount + failCount, success: successCount, failed: failCount },
    results 
  }, null, 2));
  console.log(`📝 Results saved to: ${resultsPath}`);
}

// Run import
importAllRules().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
