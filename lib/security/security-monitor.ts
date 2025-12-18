/**
 * Security Monitoring & Alerting
 * Tracks security events and triggers alerts
 */

import { observabilityService, LogLevel } from '../../lib/observability-service';

export type SecurityEventType =
  | 'prompt_injection'
  | 'rate_limit_exceeded'
  | 'auth_failure'
  | 'pii_detected'
  | 'suspicious_activity'
  | 'replay_attack'
  | 'invalid_signature'
  | 'excessive_errors';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface SecurityAlert {
  id: string;
  events: SecurityEvent[];
  threshold: number;
  windowMs: number;
  action: 'log' | 'alert' | 'block';
}

/**
 * Security Monitor Class
 */
class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 10000;
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

  constructor() {
    // Cleanup old events periodically
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Log a security event
   */
  async logEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Add to in-memory store
    this.events.push(securityEvent);

    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log to observability system
    await observabilityService.addLog({
      level: this.getSeverityLevel(event.severity),
      service: 'security-monitor',
      message: `Security event: ${event.type}`,
      metadata: {
        ...event.details,
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
      },
    });

    // Check if we need to trigger an alert
    await this.checkAlertThresholds(securityEvent);

    // Take immediate action for critical events
    if (event.severity === 'critical') {
      await this.handleCriticalEvent(securityEvent);
    }
  }

  /**
   * Get events for a user
   */
  getEventsForUser(userId: string, limit: number = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.userId === userId)
      .slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEventType, limit: number = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Check if user has suspicious activity
   */
  hasSuspiciousActivity(userId: string, windowMs: number = 3600000): boolean {
    const cutoff = Date.now() - windowMs;
    const recentEvents = this.events.filter(
      e => e.userId === userId && e.timestamp.getTime() > cutoff
    );

    // Suspicious if more than 5 security events in the window
    return recentEvents.length > 5;
  }

  /**
   * Get security score for user (0-100, higher is better)
   */
  getSecurityScore(userId: string, windowMs: number = 86400000): number {
    const cutoff = Date.now() - windowMs;
    const recentEvents = this.events.filter(
      e => e.userId === userId && e.timestamp.getTime() > cutoff
    );

    if (recentEvents.length === 0) return 100;

    // Deduct points based on severity
    let score = 100;
    for (const event of recentEvents) {
      switch (event.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(event: SecurityEvent): Promise<void> {
    const windowMs = 300000; // 5 minutes
    const cutoff = Date.now() - windowMs;

    // Count similar events in window
    const similarEvents = this.events.filter(
      e =>
        e.type === event.type &&
        e.timestamp.getTime() > cutoff &&
        (event.userId ? e.userId === event.userId : true)
    );

    // Alert thresholds
    const thresholds: Record<SecurityEventType, number> = {
      prompt_injection: 3,
      rate_limit_exceeded: 5,
      auth_failure: 5,
      pii_detected: 2,
      suspicious_activity: 3,
      replay_attack: 2,
      invalid_signature: 3,
      excessive_errors: 10,
    };

    const threshold = thresholds[event.type] || 5;

    if (similarEvents.length >= threshold) {
      await this.triggerAlert(event, similarEvents);
    }
  }

  /**
   * Trigger security alert
   */
  private async triggerAlert(
    event: SecurityEvent,
    relatedEvents: SecurityEvent[]
  ): Promise<void> {
    console.warn('[Security Alert]', {
      type: event.type,
      severity: event.severity,
      count: relatedEvents.length,
      userId: event.userId,
      ip: event.ip,
    });

    // Create alert in observability system
    await observabilityService.addAlertDB({
      title: `Security Alert: ${event.type}`,
      description: `Detected ${relatedEvents.length} ${event.type} events in the last 5 minutes`,
      severity: event.severity === 'critical' ? 'critical' : 'warning',
      source: 'security-monitor',
      metadata: {
        eventType: event.type,
        count: relatedEvents.length,
        userId: event.userId,
        ip: event.ip,
      },
    });
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalEvent(event: SecurityEvent): Promise<void> {
    console.error('[CRITICAL SECURITY EVENT]', {
      type: event.type,
      userId: event.userId,
      ip: event.ip,
      details: event.details,
    });

    // In production, you might:
    // 1. Send email/SMS to security team
    // 2. Temporarily block the user/IP
    // 3. Trigger incident response workflow
    // 4. Send to SIEM system

    // For now, just create a critical alert
    await observabilityService.addAlertDB({
      title: `🚨 CRITICAL: ${event.type}`,
      description: `Critical security event detected. Immediate action required.`,
      severity: 'critical',
      source: 'security-monitor',
      metadata: {
        eventType: event.type,
        userId: event.userId,
        ip: event.ip,
        details: event.details,
      },
    });
  }

  /**
   * Cleanup old events
   */
  private cleanup(): void {
    const cutoff = Date.now() - 86400000; // Keep last 24 hours
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);
  }

  /**
   * Get severity level for logging
   */
  private getSeverityLevel(severity: SecurityEvent['severity']): LogLevel {
    switch (severity) {
      case 'low':
        return LogLevel.INFO;
      case 'medium':
        return LogLevel.WARNING;
      case 'high':
        return LogLevel.ERROR;
      case 'critical':
        return LogLevel.CRITICAL;
      default:
        return LogLevel.INFO;
    }
  }
}

// Global security monitor instance
export const securityMonitor = new SecurityMonitor();

/**
 * Helper functions for common security checks
 */

export async function logPromptInjection(userId: string, prompt: string, ip?: string): Promise<void> {
  await securityMonitor.logEvent({
    type: 'prompt_injection',
    severity: 'high',
    userId,
    ip,
    details: {
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 100),
    },
  });
}

export async function logRateLimitExceeded(userId: string, ip?: string): Promise<void> {
  await securityMonitor.logEvent({
    type: 'rate_limit_exceeded',
    severity: 'medium',
    userId,
    ip,
    details: {},
  });
}

export async function logAuthFailure(userId?: string, ip?: string, reason?: string): Promise<void> {
  await securityMonitor.logEvent({
    type: 'auth_failure',
    severity: 'medium',
    userId,
    ip,
    details: { reason },
  });
}

export async function logPIIDetected(userId: string, piiTypes: string[], ip?: string): Promise<void> {
  await securityMonitor.logEvent({
    type: 'pii_detected',
    severity: 'high',
    userId,
    ip,
    details: { piiTypes },
  });
}

export async function logReplayAttack(userId: string, ip?: string): Promise<void> {
  await securityMonitor.logEvent({
    type: 'replay_attack',
    severity: 'critical',
    userId,
    ip,
    details: {},
  });
}
