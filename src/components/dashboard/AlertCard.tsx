import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AlertSeverity = "critical" | "warning" | "info" | "resolved";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  source: string;
}

interface AlertCardProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onInvestigate?: (id: string) => void;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    iconBg: "bg-destructive/20",
    iconColor: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-500",
    badge: "bg-yellow-500 text-yellow-950",
  },
  info: {
    icon: Info,
    bg: "bg-primary/10",
    border: "border-primary/30",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    badge: "bg-primary text-primary-foreground",
  },
  resolved: {
    icon: CheckCircle,
    bg: "bg-accent/10",
    border: "border-accent/30",
    iconBg: "bg-accent/20",
    iconColor: "text-accent",
    badge: "bg-accent text-accent-foreground",
  },
};

export function AlertCard({
  alert,
  onAcknowledge,
  onInvestigate,
  className,
}: AlertCardProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  const handleAcknowledge = async () => {
    if (!onAcknowledge || acknowledging) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(alert.id);
    } finally {
      setTimeout(() => setAcknowledging(false), 500);
    }
  };

  const handleInvestigate = async () => {
    if (!onInvestigate || investigating) return;
    setInvestigating(true);
    try {
      await onInvestigate(alert.id);
    } finally {
      setTimeout(() => setInvestigating(false), 500);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01]",
        config.bg,
        config.border,
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("p-2 rounded-lg shrink-0", config.iconBg)}>
          <Icon className={cn("h-5 w-5", config.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full uppercase",
                    config.badge
                  )}
                >
                  {alert.severity}
                </span>
                <span className="text-xs text-muted-foreground">{alert.source}</span>
              </div>
              <h4 className="font-semibold text-foreground">{alert.title}</h4>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {alert.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {alert.timestamp}
            </div>
            <div className="flex gap-2">
              {onAcknowledge && alert.severity !== "resolved" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="text-xs h-8 transition-all"
                >
                  {acknowledging ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Acknowledging...
                    </>
                  ) : (
                    "Acknowledge"
                  )}
                </Button>
              )}
              {onInvestigate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleInvestigate}
                  disabled={investigating}
                  className="text-xs h-8 transition-all"
                >
                  {investigating ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    "Investigate"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
