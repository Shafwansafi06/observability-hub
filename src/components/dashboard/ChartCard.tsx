import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: any[];
  dataKey: string;
  xAxisKey?: string;
  type?: "area" | "bar" | "line";
  color?: "primary" | "accent" | "chart1" | "chart2" | "chart3";
  className?: string;
  height?: number;
}

const colorMap = {
  primary: "hsl(262, 83%, 58%)",
  accent: "hsl(174, 72%, 46%)",
  chart1: "hsl(262, 83%, 58%)",
  chart2: "hsl(174, 72%, 46%)",
  chart3: "hsl(280, 70%, 55%)",
};

export function ChartCard({
  title,
  subtitle,
  data,
  dataKey,
  xAxisKey = "name",
  type = "area",
  color = "primary",
  className,
  height = 200,
}: ChartCardProps) {
  const chartColor = colorMap[color];

  // Ensure we always have valid data array
  const chartData = Array.isArray(data) && data.length > 0 ? data : [{ name: 'No data', value: 0 }];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-lg",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#gradient-${color})`}
              />
            </AreaChart>
          ) : type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey={dataKey} fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={xAxisKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
