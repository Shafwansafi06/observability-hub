/**
 * ObservAI SDK - Example Usage
 * Demonstrates various features of the SDK
 */

import { ObservAIClient } from '../src/index';

// Load environment variables (in real app, use dotenv)
const VERTEX_AI_KEY = process.env.VERTEX_AI_API_KEY || 'your-key-here';
const OBSERVAI_ENDPOINT = process.env.OBSERVAI_ENDPOINT || 'https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm';

/**
 * Example 1: Basic Usage
 */
async function example1_basicUsage() {
  console.log('\n📌 Example 1: Basic Usage\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'example-user',
    projectName: 'sdk-examples'
  });

  const result = await client.generateContent(
    'gemini-2.5-flash',
    'Explain what is an API in one sentence.'
  );

  console.log('Response:', result.response.text());
  console.log('\nTracking Info:');
  console.log('  - Request ID:', result.tracking?.request_id);
  console.log('  - Latency:', result.tracking?.latency_ms, 'ms');
  console.log('  - Tokens:', result.tracking?.tokens_used);
  console.log('  - Cost: $', result.tracking?.cost_estimate_usd?.toFixed(6));

  await client.dispose();
}

/**
 * Example 2: With Custom Configuration
 */
async function example2_customConfig() {
  console.log('\n📌 Example 2: Custom Configuration\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    endpoint: OBSERVAI_ENDPOINT,
    userId: 'power-user',
    projectName: 'advanced-app',
    debug: true,
    batchMode: {
      enabled: true,
      maxBatchSize: 5,
      maxWaitMs: 3000
    },
    metadata: {
      environment: 'development',
      version: '1.0.0'
    }
  });

  const result = await client.generateContent(
    'gemini-2.5-pro',
    'Write a haiku about programming',
    {
      config: {
        temperature: 0.9,
        topP: 0.95,
        category: 'content_creation'
      },
      metadata: {
        feature: 'poetry-generator'
      }
    }
  );

  console.log('Haiku:', result.response.text());
  console.log('\nCost (Pro model): $', result.tracking?.cost_estimate_usd?.toFixed(6));

  await client.dispose();
}

/**
 * Example 3: Session Tracking (Conversation)
 */
async function example3_sessionTracking() {
  console.log('\n📌 Example 3: Session Tracking\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'chat-user',
    projectName: 'chatbot'
  });

  // Start a new session
  const sessionId = client.newSession();
  console.log('Session ID:', sessionId);

  const conversation = [
    'Hello! What is your name?',
    'Tell me a fun fact about space.',
    'Thank you!'
  ];

  for (const message of conversation) {
    const result = await client.generateContent(
      'gemini-2.5-flash',
      message,
      {
        config: { sessionId }
      }
    );

    console.log(`\nUser: ${message}`);
    console.log(`AI: ${result.response.text()}`);
  }

  await client.dispose();
}

/**
 * Example 4: Batch Mode with Manual Flush
 */
async function example4_batchMode() {
  console.log('\n📌 Example 4: Batch Mode\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'batch-user',
    projectName: 'bulk-processing',
    batchMode: {
      enabled: true,
      maxBatchSize: 10,
      maxWaitMs: 10000 // 10 seconds
    }
  });

  console.log('Generating 5 requests...');

  const prompts = [
    'What is 2+2?',
    'Name a color',
    'What day comes after Monday?',
    'Say hello',
    'Count to 3'
  ];

  for (const prompt of prompts) {
    const result = await client.generateContent('gemini-2.5-flash', prompt);
    console.log(`  ✓ ${prompt} -> ${result.response.text()}`);
  }

  // Manually flush the batch
  console.log('\nFlushing batch...');
  await client.flushBatch();
  console.log('Batch sent to ObservAI!');

  await client.dispose();
}

/**
 * Example 5: Error Handling
 */
async function example5_errorHandling() {
  console.log('\n📌 Example 5: Error Handling\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'error-test',
    projectName: 'error-handling',
    autoRetry: true
  });

  try {
    // This might fail due to various reasons
    const result = await client.generateContent(
      'gemini-2.5-flash',
      'Test prompt'
    );

    console.log('Success:', result.response.text());
  } catch (error) {
    console.error('Error occurred:', error instanceof Error ? error.message : error);
    // Error is still tracked in ObservAI dashboard!
  }

  await client.dispose();
}

/**
 * Example 6: Quality Analysis
 */
async function example6_qualityAnalysis() {
  console.log('\n📌 Example 6: Quality Analysis\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'quality-user',
    projectName: 'quality-check'
  });

  const testCases = [
    'Explain quantum computing',
    'Write something toxic', // Will be flagged
    'Tell me about AI'
  ];

  for (const prompt of testCases) {
    const result = await client.generateContent('gemini-2.5-flash', prompt);
    
    console.log(`\nPrompt: ${prompt}`);
    console.log(`Response: ${result.response.text().substring(0, 100)}...`);
    // Quality scores are automatically calculated and sent to dashboard
  }

  console.log('\n💡 Check your ObservAI dashboard to see quality scores!');

  await client.dispose();
}

/**
 * Example 7: Multiple Projects
 */
async function example7_multipleProjects() {
  console.log('\n📌 Example 7: Multiple Projects\n');

  // Client for project A
  const clientA = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'user-123',
    projectName: 'project-a'
  });

  // Client for project B
  const clientB = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'user-123',
    projectName: 'project-b'
  });

  const resultA = await clientA.generateContent('gemini-2.5-flash', 'Hello from Project A');
  console.log('Project A:', resultA.response.text());

  const resultB = await clientB.generateContent('gemini-2.5-flash', 'Hello from Project B');
  console.log('Project B:', resultB.response.text());

  console.log('\n💡 Both projects will show separately in your dashboard!');

  await clientA.dispose();
  await clientB.dispose();
}

/**
 * Example 8: Advanced - Using Underlying Model
 */
async function example8_advancedModel() {
  console.log('\n📌 Example 8: Advanced Model Usage\n');

  const client = new ObservAIClient({
    apiKey: VERTEX_AI_KEY,
    userId: 'advanced-user',
    projectName: 'advanced-features'
  });

  // Get the underlying model for advanced usage
  const model = client.getModel('gemini-2.5-flash');
  
  // Use startChat for conversations (this won't auto-track yet)
  const chat = model.startChat();
  
  const msg1 = await chat.sendMessage('Hello!');
  console.log('AI:', msg1.response.text());

  const msg2 = await chat.sendMessage('What is 2+2?');
  console.log('AI:', msg2.response.text());

  // For auto-tracking, use client.generateContent() with sessionId

  await client.dispose();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   ObservAI SDK - Usage Examples');
  console.log('═══════════════════════════════════════════════════');

  try {
    await example1_basicUsage();
    await example2_customConfig();
    await example3_sessionTracking();
    await example4_batchMode();
    await example5_errorHandling();
    await example6_qualityAnalysis();
    await example7_multipleProjects();
    await example8_advancedModel();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('   ✅ All examples completed!');
    console.log('   📊 Check your ObservAI dashboard at:');
    console.log('   http://localhost:5173/dashboard');
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_basicUsage,
  example2_customConfig,
  example3_sessionTracking,
  example4_batchMode,
  example5_errorHandling,
  example6_qualityAnalysis,
  example7_multipleProjects,
  example8_advancedModel,
};
