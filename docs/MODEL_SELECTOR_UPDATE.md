# Model Selector Update - Live AI Tester

## Overview
Added a comprehensive model selector UI to the Live AI Tester component, allowing users to easily switch between the 3 integrated AI models.

## Changes Made

### 1. UI Components Added

#### Model Selector Dropdown
- **Location**: `src/pages/dashboard/LLMMetrics.tsx`
- **Component**: Shadcn Select component with custom styling
- **Features**:
  - Visual model cards showing:
    - Model icon (⚡ Fast, 👑 Pro, 🖼️ Image)
    - Model name (e.g., "Gemini 2.5 Flash")
    - Rate limits (RPM, TPM/RPD)
    - Top 2 capabilities as badges
  - Full capabilities description below dropdown
  - Dynamic placeholder text based on selected model

#### Header Badge
- Shows currently selected model name in a styled badge
- Color-coded by model type:
  - **Blue**: TEXT_FAST (Gemini 2.5 Flash)
  - **Purple**: TEXT_PRO (Gemini 2.5 Pro)
  - **Pink**: IMAGE (Imagen 4.0 Fast)

#### Enhanced Stats Display
- Added "Last Model" indicator showing which model handled the last request
- Shows model name with brain icon
- Only appears after a request is made

### 2. State Management

```typescript
const [selectedModel, setSelectedModel] = useState<ModelType>(ModelType.TEXT_FAST);
const [lastModel, setLastModel] = useState<string>("");
```

- `selectedModel`: Tracks user's current model selection
- `lastModel`: Records which model was used in the last API call

### 3. Helper Functions

#### `getModelIcon(model: ModelType)`
Returns the appropriate icon component for each model:
- `Zap` - Fast text model (⚡)
- `Crown` - Pro text model (👑)
- `ImageIcon` - Image generation model (🖼️)

#### `getModelBadgeClass(model: ModelType)`
Returns Tailwind CSS classes for color-coding:
- TEXT_FAST: Blue theme
- TEXT_PRO: Purple theme
- IMAGE: Pink theme

### 4. API Integration

Updated `handleTest()` to pass the selected model:

```typescript
const result = await makeRequest(prompt, {
  model: selectedModel,
  temperature: 0.7,
  maxTokens: 1024,
});
setLastModel(result.model);
```

## Visual Layout

```
┌─────────────────────────────────────────────────┐
│ Live AI Tester              [Gemini 2.5 Flash]  │
│ Test Vertex AI Gemini models in real-time       │
├─────────────────────────────────────────────────┤
│ Select Model                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚡ Gemini 2.5 Flash                         │ │
│ │    1,000 RPM · 1M TPM         [text][fast] │ │
│ │                                             │ │
│ │ 👑 Gemini 2.5 Pro                          │ │
│ │    150 RPM · 2M TPM          [text][smart] │ │
│ │                                             │ │
│ │ 🖼️ Imagen 4.0 Fast                         │ │
│ │    10 RPM · 70 RPD         [image][quick]  │ │
│ └─────────────────────────────────────────────┘ │
│ text-generation · low-latency · multi-turn      │
│                                                 │
│ Your Prompt                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Enter your prompt here...                   │ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│ ⏱️ 234ms  ✨ 145 tokens  🧠 gemini-2.5-flash   │
│                                      [Test AI]  │
└─────────────────────────────────────────────────┘
```

## User Flow

1. **Select Model**: User opens dropdown and sees all 3 models with their specs
2. **Review Capabilities**: User can see rate limits and capabilities for each model
3. **Choose Model**: Click to select desired model
4. **Enter Prompt**: Type prompt (placeholder text changes for image models)
5. **Test**: Click "Test AI" button
6. **View Results**: See response with stats showing which model was used

## Model Information Displayed

### Gemini 2.5 Flash (TEXT_FAST) - Default
- **Icon**: ⚡ Zap
- **Rate Limits**: 1,000 RPM · 1M TPM
- **Capabilities**: text-generation · low-latency · multi-turn · JSON mode
- **Use Case**: Fast responses, high-volume requests

### Gemini 2.5 Pro (TEXT_PRO)
- **Icon**: 👑 Crown
- **Rate Limits**: 150 RPM · 2M TPM
- **Capabilities**: text-generation · complex-reasoning · multi-turn · JSON mode
- **Use Case**: Complex analysis, advanced reasoning

### Imagen 4.0 Fast (IMAGE)
- **Icon**: 🖼️ ImageIcon
- **Rate Limits**: 10 RPM · 70 RPD
- **Capabilities**: image-generation · text-to-image · quick-generation
- **Use Case**: Generate images from text descriptions

## Technical Details

### Imports Added
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ModelType, MODEL_CONFIGS } from "@/lib/vertex-ai/client";
import { Zap, Crown, Image as ImageIcon } from "lucide-react";
```

### Dependencies
- Shadcn Select component (auto-installed via HMR)
- @radix-ui/react-select (dependency of Shadcn Select)

## Testing

### Manual Test Steps
1. Navigate to Dashboard → LLM Metrics
2. Scroll to "Live AI Tester" section
3. Verify model selector appears with all 3 models
4. Select each model and verify:
   - Icon changes
   - Badge in header updates
   - Capabilities text updates
   - Placeholder text changes for image model
5. Enter a prompt and click "Test AI"
6. Verify "Last Model" stat appears showing correct model

### Expected Behavior
- ✅ Dropdown shows all 3 models with specs
- ✅ Selection updates badge in header
- ✅ API calls use selected model
- ✅ Last model name displayed after request
- ✅ Stats show correct tokens/latency for model used
- ✅ No TypeScript errors
- ✅ No runtime errors

## Benefits

1. **User Control**: Users can now test different models without code changes
2. **Transparency**: Clear visibility of which model is being used
3. **Education**: Users learn about each model's capabilities and limits
4. **Optimization**: Users can choose the right model for their task
5. **Testing**: Easy A/B testing between models

## Related Documentation

- [Multi-Model Usage Guide](./MULTI_MODEL_USAGE.md)
- [Lyra Prompt Optimizer](./LYRA_PROMPT_OPTIMIZER.md)
- [Multi-Model Upgrade Summary](./MULTI_MODEL_UPGRADE_SUMMARY.md)

## Future Enhancements

- Auto-select model based on prompt complexity
- Show cost estimate before testing
- Add model comparison feature
- Save preferred model per user
- Add streaming toggle for text models
- Add image preview for image model results
