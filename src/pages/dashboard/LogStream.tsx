import { useState, useEffect } from "react";
import { LogEntry } from "@/components/dashboard/LogEntry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLogs } from "@/hooks/use-observability";
import { observabilityService } from "@/lib/observability-service";
import {
  Filter,
  Pause,
  Play,
  Search,
  Download,
  RefreshCw,
} from "lucide-react";

const filters = ["All", "info", "warning", "error", "critical"];

export default function LogStream() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const { logs, loading } = useLogs(100, isStreaming ? 2000 : 60000);

  // Generate some sample logs on first load if empty
  useEffect(() => {
    if (logs.length === 0) {
      observabilityService.addLog({
        level: 'info',
        service: 'observability-hub',
        message: 'ObservAI Hub initialized successfully',
        metadata: { version: '1.0.0' },
      });
      observabilityService.addLog({
        level: 'info',
        service: 'datadog-rum',
        message: 'Real User Monitoring connected',
        metadata: { site: 'us5.datadoghq.com' },
      });
      observabilityService.addLog({
        level: 'info',
        service: 'vertex-ai',
        message: 'Gemini API client ready',
        metadata: { model: 'gemini-2.0-flash' },
      });
    }
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = activeFilter === "All" || log.level === activeFilter;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Transform logs for LogEntry component
  const displayLogs = filteredLogs.map(log => ({
    id: log.id,
    timestamp: new Date(log.timestamp).toISOString(),
    level: log.level === 'warning' ? 'warn' as const : log.level === 'critical' ? 'error' as const : log.level as 'info' | 'debug' | 'warn' | 'error',
    service: log.service,
    message: log.message,
    traceId: log.metadata?.traceId as string | undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Log Stream</h1>
          <p className="text-muted-foreground mt-1">
            Real-time logs from your LLM infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? "default" : "secondary"}
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Resume
              </>
            )}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs by message or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                activeFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isStreaming ? "bg-accent animate-pulse" : "bg-muted-foreground"
              )}
            />
            <span className="text-sm text-muted-foreground">
              {isStreaming ? "Live streaming" : "Paused"}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} logs
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Log entries */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {displayLogs.length > 0 ? (
            displayLogs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No logs yet. Make some AI requests to see live logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
