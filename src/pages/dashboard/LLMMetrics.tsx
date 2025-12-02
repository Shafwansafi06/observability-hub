import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { cn } from "@/lib/utils";
import {
  Brain,
  Cpu,
  Gauge,
  MessageSquare,
  Sparkles,
  Target,
  Thermometer,
  Timer,
} from "lucide-react";

// Mock data
const confidenceData = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.random() * 0.3 + 0.7,
}));

const tokenLatencyData = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.floor(Math.random() * 50) + 10,
}));

const embeddingDistanceData = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.random() * 0.5 + 0.3,
}));

const modelUsageData = [
  { name: "gemini-pro", value: 45000 },
  { name: "gemini-1.5-pro", value: 32000 },
  { name: "text-bison", value: 18000 },
  { name: "chat-bison", value: 12000 },
];

const modelMetrics = [
  {
    model: "gemini-pro",
    requests: "45.2K",
    avgLatency: "89ms",
    confidence: "0.92",
    errorRate: "0.02%",
    status: "healthy",
  },
  {
    model: "gemini-1.5-pro",
    requests: "32.1K",
    avgLatency: "156ms",
    confidence: "0.95",
    errorRate: "0.01%",
    status: "healthy",
  },
  {
    model: "text-bison",
    requests: "18.5K",
    avgLatency: "67ms",
    confidence: "0.88",
    errorRate: "0.05%",
    status: "degraded",
  },
  {
    model: "chat-bison",
    requests: "12.3K",
    avgLatency: "112ms",
    confidence: "0.91",
    errorRate: "0.03%",
    status: "healthy",
  },
];

export default function LLMMetrics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">LLM Metrics</h1>
        <p className="text-muted-foreground mt-1">
          Deep observability into your language model performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Confidence"
          value="0.91"
          change={2.3}
          changeLabel="vs baseline"
          icon={Target}
          variant="primary"
        />
        <MetricCard
          title="Token/sec"
          value="847"
          change={15.2}
          changeLabel="vs last hour"
          icon={Sparkles}
          variant="accent"
        />
        <MetricCard
          title="Embedding Drift"
          value="0.12"
          change={-5.1}
          changeLabel="vs baseline"
          icon={Gauge}
          variant="default"
        />
        <MetricCard
          title="Inference Temp"
          value="0.7"
          icon={Thermometer}
          variant="default"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Model Confidence Score"
          subtitle="Average confidence over time"
          data={confidenceData}
          dataKey="value"
          type="area"
          color="primary"
          height={220}
        />
        <ChartCard
          title="Token Streaming Latency"
          subtitle="Time to first token (ms)"
          data={tokenLatencyData}
          dataKey="value"
          type="line"
          color="accent"
          height={220}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Embedding Distance"
          subtitle="Cosine similarity to baseline"
          data={embeddingDistanceData}
          dataKey="value"
          type="area"
          color="chart3"
          height={180}
        />
        <ChartCard
          title="Model Usage Distribution"
          subtitle="Requests by model"
          data={modelUsageData}
          dataKey="value"
          type="bar"
          color="primary"
          height={180}
        />

        {/* Quick Stats */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Prompts</span>
              <span className="font-mono text-sm text-foreground">2.4M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Prompt Length</span>
              <span className="font-mono text-sm text-foreground">128 tokens</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Response Length</span>
              <span className="font-mono text-sm text-foreground">256 tokens</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Safety Flags</span>
              <span className="font-mono text-sm text-destructive">23</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Hallucination Detections</span>
              <span className="font-mono text-sm text-yellow-500">7</span>
            </div>
          </div>
        </div>
      </div>

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
