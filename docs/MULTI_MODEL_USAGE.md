# Multi-Model Usage Guide

ObservAI now supports **3 cutting-edge Google AI models** with different capabilities and rate limits.

## 🤖 Available Models

### 1. Gemini 2.5 Flash (Text Generation - Fast)
- **Model**: `gemini-2.5-flash`
- **Type**: Text generation
- **Rate Limits**: 1,000 RPM | 1M TPM | 10K RPD
- **Best For**: Fast responses, code generation, real-time chat
- **Cost**: $0.075/1M input tokens, $0.30/1M output tokens

### 2. Gemini 2.5 Pro (Advanced Reasoning)
- **Model**: `gemini-2.5-pro`
- **Type**: Advanced text generation
- **Rate Limits**: 150 RPM | 2M TPM | 10K RPD
- **Best For**: Complex reasoning, long context, detailed analysis
- **Cost**: $1.25/1M input tokens, $5.00/1M output tokens

### 3. Imagen 4.0 Fast (Image Generation)
- **Model**: `imagen-4.0-fast-generate`
- **Type**: Text-to-image generation
- **Rate Limits**: 10 RPM | 70 RPD
- **Best For**: Fast image generation, UI mockups, visual content
- **Cost**: $0.02 per image

---

## 📝 Usage Examples

### Example 1: Fast Text Generation (Default)

```typescript
import { vertexAI, ModelType } from '@/lib/vertex-ai/client';

// Quick response for simple queries
const response = await vertexAI.predict({
  prompt: 'Explain observability in 2 sentences',
  model: ModelType.TEXT_FAST,
  temperature: 0.7,
  maxTokens: 150
});

console.log(response.text);
// Response: Fast, concise answer
// Latency: ~500-800ms
```

### Example 2: Complex Reasoning with Pro Model

```typescript
import { vertexAI, ModelType } from '@/lib/vertex-ai/client';

// Deep analysis for complex problems
const response = await vertexAI.predict({
  prompt: `Analyze this log pattern and suggest root cause:
  
  ERROR: Connection timeout to db.prod.internal:5432
  ERROR: Connection timeout to db.prod.internal:5432
  ERROR: Connection timeout to db.prod.internal:5432
  WARN: High memory usage (95%)
  ERROR: OOMKilled: Container exceeded memory limit
  
  Provide detailed diagnosis with 5 action items.`,
  
  model: ModelType.TEXT_PRO,
  temperature: 0.3, // Lower for more deterministic reasoning
  maxTokens: 2048   // Longer for detailed analysis
});

console.log(response.text);
// Response: Detailed analysis with root cause and actionable steps
// Latency: ~2-4s (worth it for complex tasks)
```

### Example 3: Image Generation

```typescript
import { vertexAI, ModelType } from '@/lib/vertex-ai/client';

// Generate dashboard mockup
const response = await vertexAI.predict({
  prompt: 'Modern observability dashboard with dark theme, metrics charts, logs stream, and alert panel. Professional UI design, blue and purple gradients',
  
  model: ModelType.IMAGE,
  imageConfig: {
    numberOfImages: 1,
    aspectRatio: '16:9',
  }
});

// response.imageUrl contains base64 encoded image
console.log(`<img src="${response.imageUrl}" />`);
```

### Example 4: Streaming Text (Fast Model Only)

```typescript
import { vertexAI, ModelType } from '@/lib/vertex-ai/client';

// Stream long-form content
const stream = vertexAI.predictStream({
  prompt: 'Write a comprehensive guide to LLM observability with Datadog',
  model: ModelType.TEXT_FAST, // Only text models support streaming
  maxTokens: 2048
});

for await (const chunk of stream) {
  process.stdout.write(chunk); // Print as it arrives
}
```

---

## 🎯 Model Selection Strategy

### When to Use Each Model:

```typescript
import { VertexAIClient } from '@/lib/vertex-ai/client';

// Automatic model selection
const modelForTask = VertexAIClient.getModelForTask('fast');    // Returns TEXT_FAST
const modelForComplex = VertexAIClient.getModelForTask('complex'); // Returns TEXT_PRO
const modelForImage = VertexAIClient.getModelForTask('image');    // Returns IMAGE
```

### Decision Tree:

```
Need image generation?
├─ YES → Use IMAGE (imagen-4.0-fast-generate)
└─ NO ↓

Task complexity?
├─ Simple/Fast → Use TEXT_FAST (gemini-2.5-flash)
│   • Chat responses
│   • Code generation
│   • Quick summaries
│   • Real-time analysis
│
└─ Complex/Deep → Use TEXT_PRO (gemini-2.5-pro)
    • Root cause analysis
    • Multi-step reasoning
    • Detailed explanations
    • Long context processing
```

---

## 📊 Model Comparison

| Feature | TEXT_FAST | TEXT_PRO | IMAGE |
|---------|-----------|----------|-------|
| Speed | ⚡⚡⚡ Fast | ⚡⚡ Medium | ⚡ Slower |
| Quality | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Great |
| Cost | $ Low | $$$ High | $$ Medium |
| RPM Limit | 1,000 | 150 | 10 |
| Streaming | ✅ Yes | ✅ Yes | ❌ No |
| Best For | Volume | Accuracy | Visuals |

---

## 🔧 Implementation in ObservAI

### Updated LLM Tester Component

```typescript
// In your React component
import { vertexAI, ModelType, MODEL_CONFIGS } from '@/lib/vertex-ai/client';
import { trackLLMRequestAPM } from '@/lib/datadog-apm';

const [selectedModel, setSelectedModel] = useState<ModelType>(ModelType.TEXT_FAST);

const handleTest = async () => {
  const startTime = Date.now();
  
  try {
    const response = await vertexAI.predict({
      prompt: userPrompt,
      model: selectedModel,
      temperature: 0.7,
      maxTokens: 1024,
    });
    
    const latency = Date.now() - startTime;
    
    // Track in Datadog with model-specific tags
    trackLLMRequestAPM({
      prompt: userPrompt,
      model: response.model,
      temperature: 0.7,
      maxTokens: 1024,
      latency,
      tokens_in: userPrompt.split(/\s+/).length * 1.3, // Estimate
      tokens_out: response.tokens,
      success: true,
      cost: calculateModelCost(response),
    });
    
    setResult(response.text || response.imageUrl);
  } catch (error) {
    // Track failure
    trackLLMRequestAPM({
      prompt: userPrompt,
      model: selectedModel,
      latency: Date.now() - startTime,
      success: false,
      error: error.message,
      tokens_in: 0,
      tokens_out: 0,
    });
  }
};

// Model selector UI
<Select value={selectedModel} onValueChange={setSelectedModel}>
  {VertexAIClient.getAvailableModels().map(({ model, config }) => (
    <SelectItem key={model} value={model}>
      {config.name} ({config.type})
      <span className="text-xs text-gray-500">
        {config.rpm} RPM | {config.capabilities.join(', ')}
      </span>
    </SelectItem>
  ))}
</Select>
```

---

## 📈 Monitoring in Datadog

### Key Metrics to Track:

1. **Per-Model Performance**:
   ```
   avg(llm.latency_ms) by {llm.model}
   sum(llm.tokens.total) by {llm.model}
   sum(llm.cost_usd) by {llm.model}
   ```

2. **Model Usage Distribution**:
   ```
   count(action.target.name:llm_inference) by {llm.model}
   ```

3. **Cost Optimization**:
   ```
   // Are we using TEXT_PRO unnecessarily?
   avg(llm.cost_usd) by {llm.prompt.category}
   ```

4. **Rate Limit Monitoring**:
   ```
   // Alert if approaching limits
   rate(llm.requests) by {llm.model} > 900  // 90% of TEXT_FAST limit
   rate(llm.requests) by {llm.model:gemini-2.5-pro} > 135  // 90% of PRO limit
   ```

---

## 🚀 Rate Limit Management

### Built-in Rate Limiting (Coming Soon):

```typescript
// Future enhancement: Automatic fallback
const response = await vertexAI.predictWithFallback({
  prompt: 'Analyze this',
  preferredModel: ModelType.TEXT_PRO,
  fallbackModel: ModelType.TEXT_FAST,
  // If TEXT_PRO hits rate limit, automatically use TEXT_FAST
});
```

### Manual Rate Tracking:

```typescript
const metrics = vertexAI.getMetrics();

// Check per-model usage
console.log(metrics.modelUsage['gemini-2.5-pro']);
// {
//   requests: 145,
//   tokens: 1_980_000,
//   avgLatency: 2341
// }

// Warn if approaching limits
if (metrics.modelUsage['gemini-2.5-pro']?.requests > 140) {
  console.warn('⚠️ Approaching PRO model rate limit (150 RPM)');
  // Switch to TEXT_FAST for non-critical tasks
}
```

---

## 💡 Best Practices

1. **Use TEXT_FAST by default** - Reserve TEXT_PRO for tasks that truly need it
2. **Batch image generation** - 10 RPM limit means plan ahead
3. **Monitor costs** - TEXT_PRO is 16x more expensive for input, 25x for output
4. **Cache results** - Don't regenerate identical prompts
5. **Stream when possible** - Better UX for long responses
6. **Track per-model metrics** - Optimize based on actual usage patterns

---

## 🎯 Competition Edge

Having **3 specialized models** demonstrates:
- ✅ **Production-ready architecture** - Not just one model
- ✅ **Cost optimization** - Right model for right task
- ✅ **Scale planning** - Rate limit awareness
- ✅ **Advanced capabilities** - Image generation + reasoning
- ✅ **Comprehensive observability** - Track all model types

This is **hackathon-winning material**! 🏆
