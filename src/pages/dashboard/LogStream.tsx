import { useState } from "react";
import { LogEntry } from "@/components/dashboard/LogEntry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Filter,
  Pause,
  Play,
  Search,
  Download,
  RefreshCw,
} from "lucide-react";

const mockLogs = [
  {
    id: "1",
    timestamp: "2024-01-15T14:23:45.123Z",
    level: "info" as const,
    service: "api-gateway",
    message: "Incoming request POST /v1/chat/completions from client_id=abc123",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "2",
    timestamp: "2024-01-15T14:23:45.234Z",
    level: "debug" as const,
    service: "llm-proxy",
    message: "Routing request to model=gemini-pro, region=us-central1",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "3",
    timestamp: "2024-01-15T14:23:45.456Z",
    level: "info" as const,
    service: "vertex-ai",
    message: "Model inference started, input_tokens=128, temperature=0.7",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "4",
    timestamp: "2024-01-15T14:23:46.789Z",
    level: "info" as const,
    service: "vertex-ai",
    message: "Model inference completed, output_tokens=256, latency_ms=1333",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "5",
    timestamp: "2024-01-15T14:23:46.890Z",
    level: "warn" as const,
    service: "safety-checker",
    message: "Low confidence score detected: 0.45, threshold=0.5, flagged for review",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "6",
    timestamp: "2024-01-15T14:23:47.012Z",
    level: "error" as const,
    service: "rate-limiter",
    message: "Rate limit exceeded for client_id=xyz789, requests=1001, limit=1000/min",
    traceId: "tr-1a2b3c4d5e6f7g8h",
  },
  {
    id: "7",
    timestamp: "2024-01-15T14:23:47.234Z",
    level: "info" as const,
    service: "metrics",
    message: "Telemetry batch sent to Datadog, events=150, size_kb=45.2",
  },
  {
    id: "8",
    timestamp: "2024-01-15T14:23:48.456Z",
    level: "debug" as const,
    service: "embedding",
    message: "Computing embedding distance, baseline_dim=768, similarity=0.87",
    traceId: "tr-9h8g7f6e5d4c3b2a",
  },
  {
    id: "9",
    timestamp: "2024-01-15T14:23:49.678Z",
    level: "info" as const,
    service: "api-gateway",
    message: "Response sent to client, status=200, response_time_ms=4555",
    traceId: "tr-8f7a6b5c4d3e2f1g",
  },
  {
    id: "10",
    timestamp: "2024-01-15T14:23:50.890Z",
    level: "error" as const,
    service: "hallucination-detector",
    message: "Potential hallucination detected: factual_score=0.23, context_match=0.31",
    traceId: "tr-2b3c4d5e6f7g8h9i",
  },
];

const filters = ["All", "info", "warn", "error", "debug"];

export default function LogStream() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = mockLogs.filter((log) => {
    const matchesFilter = activeFilter === "All" || log.level === activeFilter;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
          {filteredLogs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}
