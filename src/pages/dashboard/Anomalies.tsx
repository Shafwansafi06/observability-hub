import { AlertCard } from "@/components/dashboard/AlertCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAlerts, useTimeSeriesData } from "@/hooks/use-observability";
import { observabilityService } from "@/lib/observability-service";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Filter,
  Plus,
  Settings,
} from "lucide-react";

const detectionRules = [
  { name: "Hallucination Detection", triggers: 7, enabled: true },
  { name: "High Latency Alert", triggers: 23, enabled: true },
  { name: "Prompt Injection", triggers: 3, enabled: true },
  { name: "Cost Spike Monitor", triggers: 2, enabled: true },
  { name: "Data Exfiltration", triggers: 0, enabled: true },
  { name: "Model Drift", triggers: 5, enabled: false },
];

export default function Anomalies() {
  const { alerts, activeCount, acknowledge, resolve } = useAlerts(5000);
  const { data: errorsData } = useTimeSeriesData('errors', '24h', 30000);
  
  // Calculate counts
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;
  const warningCount = alerts.filter((a) => a.severity === "warning" && a.status === "active").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;

  // Transform alerts for AlertCard
  const alertCards = alerts.slice(0, 10).map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    severity: a.severity as 'critical' | 'warning' | 'resolved' | 'info',
    timestamp: formatTimeAgo(new Date(a.timestamp)),
    source: a.source,
    status: a.status,
  }));

  // Chart data
  const anomalyTrendData = errorsData.map(d => ({
    name: d.timestamp.toLocaleDateString([], { weekday: 'short' }),
    value: d.value,
  }));

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const handleCreateDemoAlert = () => {
    observabilityService.addAlert({
      title: 'High Latency Detected',
      description: 'Model inference latency exceeded 1000ms threshold',
      severity: 'warning',
      source: 'Performance Monitor',
    });
  };

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
              <p className="text-2xl font-bold text-accent">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Total Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Alerts</h3>
          <div className="space-y-3">
            {alertCards.length > 0 ? (
              alertCards.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={(id) => acknowledge(id)}
                  onInvestigate={(id) => console.log("Investigate:", id)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-3" />
                <p className="text-foreground font-medium">No alerts</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All systems are operating normally
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleCreateDemoAlert}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Demo Alert
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <ChartCard
            title="Error Trend"
            subtitle="Last 24 hours"
            data={anomalyTrendData.length > 0 ? anomalyTrendData : [{ name: 'Now', value: 0 }]}
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
