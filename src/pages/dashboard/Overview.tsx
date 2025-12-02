import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import {
  Activity,
  Brain,
  Zap,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";

// Mock data
const requestsData = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.floor(Math.random() * 500) + 200,
}));

const latencyData = Array.from({ length: 24 }, (_, i) => ({
  name: `${i}:00`,
  value: Math.floor(Math.random() * 200) + 50,
}));

const tokenData = Array.from({ length: 7 }, (_, i) => ({
  name: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  value: Math.floor(Math.random() * 100000) + 50000,
}));

const alerts = [
  {
    id: "1",
    title: "High Latency Detected",
    description: "Model inference latency exceeded 2s threshold for gemini-pro endpoint",
    severity: "warning" as const,
    timestamp: "2 min ago",
    source: "Vertex AI",
  },
  {
    id: "2",
    title: "Potential Hallucination Detected",
    description: "Response confidence dropped below 0.3 for factual query in production",
    severity: "critical" as const,
    timestamp: "5 min ago",
    source: "ObservAI Safety",
  },
  {
    id: "3",
    title: "Token Quota Warning",
    description: "Daily token usage at 85% of allocated quota",
    severity: "info" as const,
    timestamp: "15 min ago",
    source: "Billing",
  },
];

export default function Overview() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your LLM applications in real-time
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value="1.2M"
          change={12.5}
          changeLabel="vs last week"
          icon={Activity}
          variant="primary"
        />
        <MetricCard
          title="Avg Latency"
          value="127ms"
          change={-8.3}
          changeLabel="vs last week"
          icon={Clock}
          variant="accent"
        />
        <MetricCard
          title="Tokens Used"
          value="4.8B"
          change={23.1}
          changeLabel="vs last week"
          icon={Brain}
          variant="default"
        />
        <MetricCard
          title="Active Alerts"
          value="3"
          change={50}
          changeLabel="vs yesterday"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Request Volume"
          subtitle="Requests per hour (last 24h)"
          data={requestsData}
          dataKey="value"
          type="area"
          color="primary"
          height={250}
        />
        <ChartCard
          title="Response Latency"
          subtitle="P95 latency in ms (last 24h)"
          data={latencyData}
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
            subtitle="Daily token consumption"
            data={tokenData}
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
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onInvestigate={(id) => console.log("Investigate:", id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
