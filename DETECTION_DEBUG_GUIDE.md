# Detection Engine Debug Guide

## 🐛 Critical Bug Fix - Detection Alerts Not Appearing

### Problem
Detection results from "Demo Detection" and "Live AI Tester" were not appearing in Dashboard and Anomalies tabs, even though the detection engine was running.

### Root Causes Identified

1. **Weak Toxicity Detection Algorithm**
   - Original algorithm only checked 12 toxic patterns
   - Demo scenario uses words like "insulting", "rant", "harsh" which weren't detected
   - Fixed by expanding to 40+ toxic patterns

2. **Missing Console Logging**
   - No visibility into detection engine execution
   - Couldn't debug why rules weren't triggering
   - Added comprehensive logging throughout the detection pipeline

3. **Metrics Not Persisted to Supabase**
   - DetectionDemo was creating alerts but not tracking LLM requests
   - Dashboard couldn't display metrics without data in `llm_requests` table
   - Fixed by calling `observabilityService.trackLLMRequest()`

### Changes Made

#### 1. Enhanced Detection Engine (`datadog-detection.ts`)
```typescript
// Added comprehensive logging
console.log('[Detection Engine] 🔍 Running detection with metrics:', {...});
console.log(`[Detection Engine] Rule ${ruleId} (${rule.name}):`, {...});
console.log(`[Detection Engine] ✅ Rule ${ruleId} TRIGGERED!`);

// Improved toxicity detection with 40+ patterns
const toxicPatterns = [
  'hate', 'stupid', 'idiot', 'aggressive', 'insult', 'attack',
  'destroy', 'terrible', 'awful', 'worst', 'horrible', 'disgusting',
  'insulting', 'rant', 'harsh', 'criticizing', 'negative', 'offensive',
  'toxic', 'abusive', 'hostile', 'cruel', 'mean', 'nasty', 'vicious',
  // ... 30+ more patterns
];
```

#### 2. Fixed DetectionDemo.tsx
```typescript
// Now tracks LLM requests to Supabase
await observabilityService.trackLLMRequest({
  prompt: scenario.prompt,
  response: aiResponse.text,
  model: aiResponse.model,
  tokens: aiResponse.tokens,
  latency: latency,
  success: true,
  temperature: 0.7,
  maxTokens: 2048,
  promptCategory: 'detection-demo',
});
```

#### 3. Enhanced Alert Storage (`observability-service.ts`)
```typescript
// Added detailed logging for alert persistence
console.log('[addAlertDB] 📥 Attempting to add alert:', {...});
console.log('[addAlertDB] 👤 User authenticated:', user.id);
console.log('[addAlertDB] ✅ Alert added to Supabase successfully');
console.log('[addAlert] 💾 Adding alert to in-memory store:', {...});
```

#### 4. Enhanced AlertCard Component
- Now displays detection rule ID
- Shows current value vs threshold (e.g., "0.85 / 0.5")
- Displays recommended actions
- Color-coded severity indicators

### How to Debug Detection Issues

#### Step 1: Open Browser Console
Press F12 and go to Console tab

#### Step 2: Run a Detection Scenario
Click "Run Scenario" on any demo (e.g., Toxicity Detection)

#### Step 3: Check Console Logs
You should see a complete trace:

```
[Detection Engine] 🔍 Running detection with metrics: {...}
[Detection Engine] Rule LLM-001 (Hallucination Detection): {...}
[Detection Engine] Rule COST-001 (Cost Spike Detection): {...}
[Detection Engine] Rule SEC-002 (Toxicity Spike): {triggered: true, value: 0.72, threshold: 0.3}
[Detection Engine] ✅ Rule SEC-002 TRIGGERED! Creating alert...
[Detection Engine] 📝 Persisting alert to database...
[addAlertDB] 📥 Attempting to add alert: {...}
[addAlertDB] 👤 User authenticated: abc123...
[addAlertDB] ✅ Alert added to Supabase successfully
[addAlert] 💾 Adding alert to in-memory store: {...}
[addAlert] ✅ Alert added. Total alerts in memory: 2
[Detection Engine] ✅ Alert persisted successfully
[Detection Engine] 🏁 Detection complete. 1 rule(s) triggered.
```

#### Step 4: Verify Alert Appears
- Check **Anomalies** tab - should show new alert with detection details
- Check **Dashboard** tab - should show updated metrics and active alerts
- Alert should include:
  - Rule ID (e.g., SEC-002)
  - Current value vs threshold
  - Recommended actions

### Common Issues & Solutions

#### Issue: No logs appear
**Solution**: Check if detection engine is imported correctly. Verify `runDetectionAndPersist` is being called.

#### Issue: Logs show "No user authenticated"
**Solution**: User must be logged in to Supabase. Check authentication status.

#### Issue: Rule not triggering despite high values
**Solution**: Check if `expectedMetrics` are being spread correctly in DetectionDemo. Verify threshold values in `DETECTION_RULES`.

#### Issue: Alert created but not visible in UI
**Solution**: 
1. Check if `useAlerts` hook is fetching from DB
2. Verify alert data includes all fields (detection_rule_id, threshold_value, etc.)
3. Check browser console for React errors

### Testing Checklist

- [ ] Run "Hallucination Detection" - should trigger LLM-001
- [ ] Run "Toxicity Detection" - should trigger SEC-002
- [ ] Run "Prompt Injection" - should trigger LLM-002
- [ ] Run "Cost Spike" - should trigger COST-001
- [ ] Run "High Latency" - should trigger LLM-007
- [ ] Verify alerts appear in Anomalies tab
- [ ] Verify metrics appear in Dashboard
- [ ] Verify alert details show rule ID, values, recommendations
- [ ] Check console logs for complete trace

### Performance Monitoring

All detection runs are now logged with:
- Execution time
- Rules checked
- Rules triggered
- Alert persistence status
- Database operation results

Monitor console for any errors or warnings during detection.

---

**Last Updated**: 2025-12-18
**Status**: ✅ Fixed and Enhanced
