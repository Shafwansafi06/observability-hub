import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent" | "warning" | "danger";
  className?: string;
}

const variantStyles = {
  default: "border-border bg-card",
  primary: "border-primary/30 bg-primary/5",
  accent: "border-accent/30 bg-accent/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  danger: "border-destructive/30 bg-destructive/5",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/20 text-primary",
  accent: "bg-accent/20 text-accent",
  warning: "bg-yellow-500/20 text-yellow-500",
  danger: "bg-destructive/20 text-destructive",
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  variant = "default",
  className,
}: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
        </div>
        <div className={cn("p-3 rounded-xl", iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-accent" : "text-destructive"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {Math.abs(change)}%
          </span>
          {changeLabel && (
            <span className="text-sm text-muted-foreground">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
