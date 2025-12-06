/**
 * Logging Middleware
 * 
 * Structured logging utilities for the application.
 * Sends logs to the backend when configured.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
}

interface LoggerConfig {
  minLevel: LogLevel;
  sendToBackend: boolean;
  backendUrl?: string;
  batchSize: number;
  flushInterval: number;
  includeStackTrace: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: import.meta.env.DEV ? 'debug' : 'info',
  sendToBackend: !import.meta.env.DEV,
  backendUrl: import.meta.env.VITE_LOG_ENDPOINT,
  batchSize: 10,
  flushInterval: 5000,
  includeStackTrace: true,
};

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private traceId?: string;
  
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateId();
    
    if (this.config.sendToBackend) {
      this.startFlushTimer();
    }
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }
  
  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    let msg = `[${timestamp}] ${level} ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      msg += ` ${JSON.stringify(entry.context)}`;
    }
    
    return msg;
  }
  
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      sessionId: this.sessionId,
      traceId: this.traceId,
    };
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined,
      };
    }
    
    // Console output
    const consoleMethod = level === 'fatal' ? 'error' : level;
    if (console[consoleMethod as keyof Console]) {
      const formatted = this.formatMessage(entry);
      (console[consoleMethod as keyof Console] as (...args: unknown[]) => void)(formatted, context || '', error || '');
    }
    
    // Buffer for backend
    if (this.config.sendToBackend) {
      this.buffer.push(entry);
      
      if (this.buffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }
  
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
  
  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.backendUrl) return;
    
    const logs = [...this.buffer];
    this.buffer = [];
    
    try {
      await fetch(this.config.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
        keepalive: true,
      });
    } catch (err) {
      // Re-add to buffer on failure
      this.buffer = [...logs, ...this.buffer];
      console.error('Failed to flush logs:', err);
    }
  }
  
  public setTraceId(traceId: string): void {
    this.traceId = traceId;
  }
  
  public clearTraceId(): void {
    this.traceId = undefined;
  }
  
  public trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }
  
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }
  
  public info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }
  
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }
  
  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }
  
  public fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', message, context, error);
    this.flush(); // Immediately flush fatal errors
  }
  
  public child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
  
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}
  
  private mergeContext(additionalContext?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...additionalContext };
  }
  
  public trace(message: string, context?: Record<string, unknown>): void {
    this.parent.trace(message, this.mergeContext(context));
  }
  
  public debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }
  
  public info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }
  
  public warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeContext(context));
  }
  
  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
  
  public fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.fatal(message, error, this.mergeContext(context));
  }
}

// Singleton logger instance
export const logger = new Logger();

// Performance logging utilities
export function logPerformance(name: string, duration: number, context?: Record<string, unknown>): void {
  logger.info(`Performance: ${name}`, {
    duration_ms: duration,
    ...context,
  });
}

export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    logPerformance(name, duration, context);
  });
}

export default logger;
