/**
 * Observability Service
 * Centralized logging and monitoring for the application
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Log levels for observability
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

/**
 * Metrics interface
 */
export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

/**
 * Observability Service Class
 */
class ObservabilityService {
  /**
   * Log a message with the specified level
   */
  async log(entry: LogEntry): Promise<void> {
    const timestamp = new Date();
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const { level, message, context, ...rest } = entry;
      const logMethod = this.getConsoleMethod(level);
      const logContext = context ? `\n${JSON.stringify(context, null, 2)}` : '';
      console[logMethod](`[${level.toUpperCase()}] ${timestamp.toISOString()} - ${message}${logContext}`, rest);
    }

    try {
      // Store in Supabase
      const { error } = await supabase
        .from('logs')
        .insert([{
          level: entry.level,
          message: entry.message,
          context: entry.context || {},
          user_id: entry.userId,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          created_at: timestamp.toISOString(),
        }]);

      if (error) {
        console.error('Failed to save log to Supabase:', error);
      }
    } catch (error) {
      console.error('Error in observability service:', error);
    }
  }

  /**
   * Record a metric
   */
  async recordMetric(metric: Metric): Promise<void> {
    const timestamp = metric.timestamp || new Date();
    
    try {
      // Store in Supabase
      const { error } = await supabase
        .from('metrics')
        .insert([{
          name: metric.name,
          value: metric.value,
          tags: metric.tags || {},
          created_at: timestamp.toISOString(),
        }]);

      if (error) {
        console.error('Failed to save metric to Supabase:', error);
      }
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }

  /**
   * Get console method based on log level
   */
  private getConsoleMethod(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARNING:
        return 'warn';
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        return 'error';
      default:
        return 'debug';
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      context,
    });
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      context,
    });
  }

  /**
   * Log a warning message
   */
  warning(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.WARNING,
      message,
      context,
    });
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.ERROR,
      message: `${message}${error ? `: ${error.message}` : ''}`,
      context: {
        ...context,
        ...(error ? { 
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } 
        } : {}),
      },
    });
  }

  /**
   * Log a critical message
   */
  critical(message: string, error?: Error, context: Record<string, any> = {}): void {
    this.log({
      level: LogLevel.CRITICAL,
      message: `CRITICAL: ${message}${error ? `: ${error.message}` : ''}`,
      context: {
        ...context,
        ...(error ? { 
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } 
        } : {}),
      },
    });
  }

  /**
   * Add a log entry with additional metadata
   */
  async addLog(data: LogData): Promise<void> {
    try {
      const { level, service, message, metadata } = data;
      const logEntry: LogEntry = {
        level,
        message,
        context: metadata,
        timestamp: new Date(),
      };
      
      // Log to console
      const consoleMethod = this.getConsoleMethod(level);
      console[consoleMethod](`[${service}] ${message}`, metadata);
      
      // Here you can add code to send logs to your logging service
      // For example, to Supabase or another logging service
      if (process.env.NODE_ENV === 'production') {
        // Example: await this.sendToLoggingService(logEntry);
      }
    } catch (error) {
      console.error('Failed to add log:', error);
    }
  }

  /**
   * Add an alert to the database
   */
  async addAlertDB(alert: AlertData): Promise<void> {
    try {
      const { title, description, severity, source, metadata } = alert;
      
      // Log the alert
      this[severity === 'critical' ? 'critical' : 'warning'](
        `Alert: ${title} - ${description}`,
        undefined,
        { source, ...metadata }
      );
      
      // Here you can add code to store the alert in your database
      // For example, to Supabase
      if (process.env.NODE_ENV === 'production' && supabase) {
        const { error } = await supabase
          .from('alerts')
          .insert([
            {
              title,
              description,
              severity,
              source,
              status: 'open',
              metadata,
              created_at: new Date().toISOString(),
            },
          ]);
          
        if (error) {
          console.error('Failed to save alert to database:', error);
        }
      }
    } catch (error) {
      console.error('Failed to process alert:', error);
    }
  }
}

interface AlertData {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
  source: string;
  metadata: Record<string, any>;
}

interface LogData {
  level: LogLevel;
  service: string;
  message: string;
  metadata: Record<string, any>;
}

// Export a singleton instance
export const observabilityService = new ObservabilityService();

export default observabilityService;
