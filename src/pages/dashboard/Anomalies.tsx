import { AlertCard } from "@/components/dashboard/AlertCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Filter,
  Plus,
  Settings,
} from "lucide-react";

const alerts = [
  {
    id: "1",
    title: "Potential Hallucination Detected",
    description:
      "Response confidence dropped below 0.3 for factual query. Model returned unverifiable information about current events.",
    severity: "critical" as const,
    timestamp: "5 min ago",
    source: "ObservAI Safety",
  },
  {
    id: "2",
    title: "High Latency Spike",
    description:
      "Model inference latency exceeded 2s threshold for gemini-pro endpoint. 15% of requests affected in the last 5 minutes.",
    severity: "warning" as const,
    timestamp: "12 min ago",
    source: "Vertex AI",
  },
  {
    id: "3",
    title: "Prompt Injection Attempt",
    description:
      "Detected potential prompt injection pattern in user input. Request blocked and logged for security review.",
    severity: "critical" as const,
    timestamp: "23 min ago",
    source: "Security Monitor",
  },
  {
    id: "4",
    title: "Token Quota Warning",
    description:
      "Daily token usage at 85% of allocated quota. Consider increasing limits or optimizing prompt lengths.",
    severity: "info" as const,
    timestamp: "1 hour ago",
    source: "Billing",
  },
  {
    id: "5",
    title: "Embedding Drift Detected",
    description:
      "Response embeddings showing 23% deviation from baseline. May indicate model behavior shift.",
    severity: "warning" as const,
    timestamp: "2 hours ago",
    source: "Drift Monitor",
  },
  {
    id: "6",
    title: "Rate Limit Auto-Adjusted",
    description:
      "Rate limits automatically increased for client_id=premium_001 based on usage patterns.",
    severity: "resolved" as const,
    timestamp: "3 hours ago",
    source: "Auto-Scaling",
  },
];

const anomalyTrendData = Array.from({ length: 7 }, (_, i) => ({
  name: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  value: Math.floor(Math.random() * 20) + 5,
}));

const detectionRules = [
  { name: "Hallucination Detection", triggers: 7, enabled: true },
  { name: "High Latency Alert", triggers: 23, enabled: true },
  { name: "Prompt Injection", triggers: 3, enabled: true },
  { name: "Cost Spike Monitor", triggers: 2, enabled: true },
  { name: "Data Exfiltration", triggers: 0, enabled: true },
  { name: "Model Drift", triggers: 5, enabled: false },
];

export default function Anomalies() {
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anomaly Detection</h1>
          <p className="text-muted-foreground mt-1">
            AI-specific failure modes and automated incident management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Bell className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/20">
              <CheckCircle2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">1</p>
              <p className="text-sm text-muted-foreground">Resolved Today</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">5</p>
              <p className="text-sm text-muted-foreground">Active Rules</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={(id) => console.log("Acknowledge:", id)}
                onInvestigate={(id) => console.log("Investigate:", id)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <ChartCard
            title="Anomaly Trend"
            subtitle="Last 7 days"
            data={anomalyTrendData}
            dataKey="value"
            type="bar"
            color="chart3"
            height={160}
          />

          {/* Detection Rules */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Detection Rules
            </h3>
            <div className="space-y-3">
              {detectionRules.map((rule) => (
                <div
                  key={rule.name}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        rule.enabled ? "bg-accent" : "bg-muted-foreground"
                      )}
                    />
                    <span className="text-sm text-foreground">{rule.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {rule.triggers} triggers
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
