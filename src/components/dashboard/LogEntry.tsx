import { cn } from "@/lib/utils";

type LogLevel = "info" | "warn" | "error" | "debug";

interface Log {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
}

interface LogEntryProps {
  log: Log;
  className?: string;
}

const levelConfig = {
  info: {
    color: "text-primary",
    bg: "bg-primary/10",
  },
  warn: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  error: {
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  debug: {
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export function LogEntry({ log, className }: LogEntryProps) {
  const config = levelConfig[log.level];

  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors font-mono text-sm group",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {log.timestamp}
        </span>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded uppercase shrink-0",
            config.color,
            config.bg
          )}
        >
          {log.level}
        </span>
        <span className="text-xs text-accent font-medium shrink-0">
          [{log.service}]
        </span>
        <span className="text-foreground/90 flex-1 break-all">
          {log.message}
        </span>
        {log.traceId && (
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            trace:{log.traceId.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}
