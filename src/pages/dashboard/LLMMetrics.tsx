import { useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { PromptOptimizerPanel } from "@/components/dashboard/PromptOptimizerPanel";
import { cn } from "@/lib/utils";
import { useLLMMetrics, useTrackedLLMRequest, useTimeSeriesData, TimeRangeOption } from "@/hooks/use-observability";
import { TimeRangeSelector } from "@/components/dashboard/TimeRangeSelector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ModelType, MODEL_CONFIGS } from "@/lib/vertex-ai/client";
import {
  Brain,
  Gauge,
  MessageSquare,
  Sparkles,
  Target,
  Thermometer,
  Timer,
  Send,
  Loader2,
  Zap,
  Crown,
} from "lucide-react";

export default function LLMMetrics() {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('1h');
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>(ModelType.TEXT_FAST);
  const [response, setResponse] = useState("");
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [lastTokens, setLastTokens] = useState<number | null>(null);
  const [lastModel, setLastModel] = useState<string>("");
  const [lastCost, setLastCost] = useState<number>(0);
  const [lastPromptAnalysis, setLastPromptAnalysis] = useState<any>(null);
  const { makeRequest, loading, error } = useTrackedLLMRequest();
  const { metrics } = useLLMMetrics(5000, timeRange);
  const { data: latencyData } = useTimeSeriesData('latency', timeRange, 10000);
  const { data: requestsData } = useTimeSeriesData('requests', timeRange, 10000);

  // Simple cost calculation helper
  const calculateCost = (model: string, tokensIn: number, tokensOut: number): number => {
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-flash': { input: 0.075, output: 0.30 },
      'gemini-2.5-pro': { input: 1.25, output: 5.00 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    };
    const modelPricing = pricing[model] || pricing['gemini-2.5-flash'];
    const costIn = (tokensIn / 1_000_000) * modelPricing.input;
    const costOut = (tokensOut / 1_000_000) * modelPricing.output;
    return parseFloat((costIn + costOut).toFixed(6));
  };

  const handleTest = async () => {
    if (!prompt.trim()) return;
    
    try {
      const result = await makeRequest(prompt, {
        model: selectedModel,
        temperature: 0.7,
        maxTokens: 8192,  // Increased from 1024 to get fuller responses
      });
      
      const responseText = result.text || result.imageUrl || 'No response';
      setResponse(responseText);
      setLastLatency(result.latency);
      setLastTokens(result.tokens);
      setLastModel(result.model);
      
      // Calculate cost (rough estimate based on tokens)
      const estimatedInputTokens = Math.ceil(prompt.length / 4); // Rough estimate: 4 chars = 1 token
      const estimatedOutputTokens = result.tokens || 0;
      const cost = calculateCost(result.model, estimatedInputTokens, estimatedOutputTokens);
      setLastCost(cost);
      
      // Create PromptAnalysis for Lyra
      const analysis = {
        originalPrompt: prompt,
        model: result.model,
        tokensIn: estimatedInputTokens,
        tokensOut: estimatedOutputTokens,
        latency: result.latency,
        cost: cost,
        response: responseText,
      };
      setLastPromptAnalysis(analysis);
      
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Failed to get response'}`);
    }
  };

  // Get model icon
  const getModelIcon = (model: ModelType) => {
    if (model === ModelType.TEXT_PRO) return Crown;
    return Zap;
  };

  // Get model badge color
  const getModelBadgeClass = (model: ModelType) => {
    if (model === ModelType.TEXT_PRO) return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  // Format chart data
  const latencyChartData = latencyData.map(d => ({
    name: d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(d.value),
  }));

  const requestsChartData = requestsData.map(d => ({
    name: d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }));

  // Model usage from real metrics
  const modelUsageData = metrics.modelBreakdown.length > 0
    ? metrics.modelBreakdown.map(m => ({ name: m.model, value: m.requests }))
    : [{ name: "gemini-2.0-flash", value: 0 }];

  // Transform model breakdown to table format
  const modelMetrics = metrics.modelBreakdown.length > 0
    ? metrics.modelBreakdown.map(m => ({
        model: m.model,
        requests: m.requests.toString(),
        avgLatency: `${m.avgLatency}ms`,
        confidence: "0.92",
        errorRate: `${m.errorRate.toFixed(2)}%`,
        status: m.errorRate < 5 ? "healthy" as const : "degraded" as const,
      }))
    : [{
        model: "gemini-2.0-flash",
        requests: "—",
        avgLatency: "—",
        confidence: "—",
        errorRate: "—",
        status: "healthy" as const,
      }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">LLM Metrics</h1>
          <p className="text-muted-foreground mt-1">
            Deep observability into your language model performance
          </p>
        </div>
        <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests > 0 ? metrics.totalRequests.toString() : "—"}
          change={metrics.successfulRequests > 0 ? 5.2 : 0}
          changeLabel="this hour"
          icon={Target}
          variant="primary"
        />
        <MetricCard
          title="Token/sec"
          value={metrics.tokensPerSecond > 0 ? metrics.tokensPerSecond.toFixed(1) : "—"}
          change={15.2}
          changeLabel="vs last hour"
          icon={Sparkles}
          variant="accent"
        />
        <MetricCard
          title="P95 Latency"
          value={metrics.p95Latency > 0 ? `${metrics.p95Latency}ms` : "—"}
          change={-5.1}
          changeLabel="vs avg"
          icon={Gauge}
          variant="default"
        />
        <MetricCard
          title="Error Rate"
          value={metrics.totalRequests > 0 
            ? `${((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2)}%` 
            : "0%"}
          icon={Thermometer}
          variant={metrics.failedRequests > 0 ? "warning" : "default"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Request Latency"
          subtitle="Average latency over time (ms)"
          data={latencyChartData.length > 0 ? latencyChartData : [{ name: 'Now', value: 0 }]}
          dataKey="value"
          type="area"
          color="primary"
          height={220}
        />
        <ChartCard
          title="Request Volume"
          subtitle="Requests per minute"
          data={requestsChartData.length > 0 ? requestsChartData : [{ name: 'Now', value: 0 }]}
          dataKey="value"
          type="line"
          color="accent"
          height={220}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Model Usage Distribution"
          subtitle="Requests by model"
          data={modelUsageData}
          dataKey="value"
          type="bar"
          color="primary"
          height={180}
        />
        <ChartCard
          title="Token Usage"
          subtitle="Tokens used over time"
          data={requestsChartData.map(d => ({ ...d, value: d.value * 150 }))}
          dataKey="value"
          type="area"
          color="chart3"
          height={180}
        />

        {/* Quick Stats */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Requests</span>
              <span className="font-mono text-sm text-foreground">
                {metrics.totalRequests > 0 ? metrics.totalRequests : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Latency</span>
              <span className="font-mono text-sm text-foreground">
                {metrics.avgLatency > 0 ? `${metrics.avgLatency}ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tokens Used</span>
              <span className="font-mono text-sm text-foreground">
                {metrics.tokensUsed > 0 ? metrics.tokensUsed.toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Successful</span>
              <span className="font-mono text-sm text-accent">
                {metrics.successfulRequests}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Failed</span>
              <span className={cn(
                "font-mono text-sm",
                metrics.failedRequests > 0 ? "text-destructive" : "text-foreground"
              )}>
                {metrics.failedRequests}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Prompt Tester */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Live AI Tester
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Test Vertex AI Gemini models in real-time
              </p>
            </div>
            <Badge variant="outline" className={cn("font-mono", getModelBadgeClass(selectedModel))}>
              {MODEL_CONFIGS[selectedModel].name}
            </Badge>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Model</label>
            <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as ModelType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODEL_CONFIGS).map(([key, config]) => {
                  const ModelIcon = getModelIcon(key as ModelType);
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-3 py-1">
                        <ModelIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{config.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {config.rpm.toLocaleString()} RPM · {config.type === 'text' ? `${(config.tpm / 1000000).toFixed(1)}M TPM` : `${config.rpd} RPD`}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {config.capabilities.slice(0, 2).map((cap, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
                              {cap.split('-')[0]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MODEL_CONFIGS[selectedModel].capabilities.join(' · ')}
            </p>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your Prompt</label>
            <Textarea
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {lastLatency && (
                  <span className="flex items-center gap-1">
                    <Timer className="h-4 w-4" />
                    {lastLatency}ms
                  </span>
                )}
                {lastTokens !== null && lastTokens > 0 && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    {lastTokens} tokens
                  </span>
                )}
                {lastModel && (
                  <span className="flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    {lastModel}
                  </span>
                )}
              </div>
              <Button onClick={handleTest} disabled={loading || !prompt.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Test AI
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          
          {response && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm font-medium text-muted-foreground mb-2">Response:</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lyra Prompt Optimizer */}
      <PromptOptimizerPanel initialAnalysis={lastPromptAnalysis} />

      {/* Model Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Model Performance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed metrics for each deployed model
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Model
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Requests
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Avg Latency
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Confidence
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Error Rate
                </th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {modelMetrics.map((model, index) => (
                <tr
                  key={model.model}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Brain className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground font-mono text-sm">
                        {model.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground font-mono">
                    {model.requests}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground font-mono">
                    {model.avgLatency}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground font-mono">
                    {model.confidence}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground font-mono">
                    {model.errorRate}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        model.status === "healthy"
                          ? "bg-accent/20 text-accent"
                          : "bg-yellow-500/20 text-yellow-500"
                      )}
                    >
                      {model.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
