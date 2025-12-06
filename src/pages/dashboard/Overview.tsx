import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import {
  useMetricsSummary,
  useLLMMetrics,
  useTimeSeriesData,
  useAlerts,
  useServiceHealth,
} from "@/hooks/use-observability";
import {
  Activity,
  Brain,
  Clock,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Overview() {
  const { metrics, loading: metricsLoading } = useMetricsSummary(5000);
  const { metrics: llmMetrics } = useLLMMetrics(5000);
  const { data: requestsData } = useTimeSeriesData('requests', '1h', 10000);
  const { data: latencyData } = useTimeSeriesData('latency', '1h', 10000);
  const { data: tokensData } = useTimeSeriesData('tokens', '1h', 10000);
  const { alerts, activeCount, acknowledge } = useAlerts(5000);
  const { services } = useServiceHealth(30000);

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  function formatTokens(tokens: number): string {
    if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)}B`;
    if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
    if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`;
    return tokens.toString();
  }

  // Transform time series for charts
  const requestsChartData = requestsData.map((d) => ({
    name: d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }));

  const latencyChartData = latencyData.map((d) => ({
    name: d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(d.value),
  }));

  const tokensChartData = tokensData.map((d) => ({
    name: d.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }));

  // Transform alerts for AlertCard component
  const alertCards = alerts
    .filter(a => a.status === 'active')
    .slice(0, 3)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      severity: a.severity as 'critical' | 'warning',
      timestamp: formatTimeAgo(new Date(a.timestamp)),
      source: a.source,
    }));

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Real-time LLM observability metrics
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={metricsLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests > 0 ? metrics.totalRequests.toString() : "—"}
          change={metrics.successRate > 95 ? 5.2 : -3.1}
          changeLabel="success rate"
          icon={Activity}
          variant="primary"
        />
        <MetricCard
          title="Avg Latency"
          value={metrics.avgLatency > 0 ? `${metrics.avgLatency}ms` : "—"}
          change={llmMetrics.p95Latency > 500 ? 12.5 : -8.3}
          changeLabel="p95 impact"
          icon={Clock}
          variant="accent"
        />
        <MetricCard
          title="Tokens Used"
          value={metrics.tokensUsed > 0 ? formatTokens(metrics.tokensUsed) : "—"}
          change={23.1}
          changeLabel="this hour"
          icon={Brain}
          variant="default"
        />
        <MetricCard
          title="Active Alerts"
          value={activeCount.toString()}
          change={activeCount > 0 ? 50 : -100}
          changeLabel="status"
          icon={AlertTriangle}
          variant={activeCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* Service Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.length > 0 ? services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  {service.status === 'operational' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : service.status === 'degraded' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.latency}ms latency
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    service.status === 'operational' ? 'default' :
                    service.status === 'degraded' ? 'secondary' : 'destructive'
                  }
                >
                  {service.status}
                </Badge>
              </div>
            )) : (
              <div className="col-span-3 text-center py-4 text-muted-foreground">
                Checking service health...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Request Volume"
          subtitle="Requests per minute (last hour)"
          data={requestsChartData.length > 0 ? requestsChartData : [{ name: 'Now', value: 0 }]}
          dataKey="value"
          type="area"
          color="primary"
          height={250}
        />
        <ChartCard
          title="Response Latency"
          subtitle="Average latency in ms (last hour)"
          data={latencyChartData.length > 0 ? latencyChartData : [{ name: 'Now', value: 0 }]}
          dataKey="value"
          type="line"
          color="accent"
          height={250}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Token Usage"
            subtitle="Tokens consumed per minute"
            data={tokensChartData.length > 0 ? tokensChartData : [{ name: 'Now', value: 0 }]}
            dataKey="value"
            type="bar"
            color="chart3"
            height={200}
          />
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Alerts</h3>
            <a
              href="/dashboard/anomalies"
              className="text-sm text-primary hover:underline"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {alertCards.length > 0 ? (
              alertCards.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onInvestigate={(id) => {
                    acknowledge(id);
                    console.log("Investigating:", id);
                  }}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-6 text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No active alerts
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* LLM Model Performance */}
      {llmMetrics.modelBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {llmMetrics.modelBreakdown.map((model) => (
                <div
                  key={model.model}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{model.model}</span>
                    <Badge variant={model.errorRate < 5 ? "default" : "destructive"}>
                      {model.errorRate.toFixed(1)}% error
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-foreground font-medium">
                        {model.requests}
                      </span>
                      requests
                    </div>
                    <div>
                      <span className="block text-foreground font-medium">
                        {model.avgLatency}ms
                      </span>
                      avg latency
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
