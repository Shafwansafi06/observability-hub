/**
 * Real-time Subscriptions
 * 
 * Supabase Realtime integration for live data updates.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient, QueryKey } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { queryKeys } from './query-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 
  | 'metrics'
  | 'llm_metrics'
  | 'logs'
  | 'alerts'
  | 'incidents'
  | 'anomalies'
  | 'notification_history';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimePayload {
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  eventType: ChangeEvent;
}

interface SubscriptionOptions {
  table: TableName;
  event?: ChangeEvent;
  filter?: string;
  onData?: (payload: RealtimePayload) => void;
  invalidateQueries?: readonly QueryKey[];
}

/**
 * Subscribe to real-time changes on a table
 */
export function useRealtimeSubscription(
  projectId: string,
  options: SubscriptionOptions
): void {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const handleChange = useCallback(
    (payload: RealtimePayload) => {
      // Call custom handler if provided
      if (options.onData) {
        options.onData(payload);
      }
      
      // Invalidate specified queries
      if (options.invalidateQueries) {
        for (const queryKey of options.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }
      }
    },
    [options, queryClient]
  );
  
  useEffect(() => {
    if (!projectId) return;
    
    const channelName = `${options.table}-${projectId}`;
    
    // Create subscription using the Realtime channel API
    const channel = supabase.channel(channelName);
    
    // Subscribe to postgres changes
    channel.on(
      'postgres_changes' as 'system',  // Type assertion needed for Supabase v2
      {
        event: options.event || '*',
        schema: 'public',
        table: options.table,
        filter: options.filter || `project_id=eq.${projectId}`,
      } as Record<string, unknown>,
      (payload: unknown) => handleChange(payload as RealtimePayload)
    );
    
    channel.subscribe();
    channelRef.current = channel;
    
    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, options.table, options.event, options.filter, handleChange]);
}

/**
 * Subscribe to real-time metrics updates
 */
export function useRealtimeMetrics(projectId: string): void {
  useRealtimeSubscription(projectId, {
    table: 'metrics',
    event: 'INSERT',
    invalidateQueries: [
      queryKeys.metrics.overview(projectId, '1h'),
      queryKeys.metrics.overview(projectId, '24h'),
    ],
  });
}

/**
 * Subscribe to real-time LLM metrics updates
 */
export function useRealtimeLLMMetrics(projectId: string): void {
  useRealtimeSubscription(projectId, {
    table: 'llm_metrics',
    event: 'INSERT',
    invalidateQueries: [
      queryKeys.llmMetrics.overview(projectId, '1h'),
      queryKeys.llmMetrics.overview(projectId, '24h'),
    ],
  });
}

/**
 * Subscribe to real-time log updates
 */
export function useRealtimeLogs(
  projectId: string,
  onNewLog?: (log: Record<string, unknown>) => void
): void {
  useRealtimeSubscription(projectId, {
    table: 'logs',
    event: 'INSERT',
    onData: (payload) => {
      if (payload.new && onNewLog) {
        onNewLog(payload.new);
      }
    },
    invalidateQueries: [
      queryKeys.logs.stream(projectId, {}),
    ],
  });
}

/**
 * Subscribe to real-time alert updates
 */
export function useRealtimeAlerts(projectId: string): void {
  useRealtimeSubscription(projectId, {
    table: 'alerts',
    invalidateQueries: [
      queryKeys.alerts.active(projectId),
    ],
  });
}

/**
 * Subscribe to real-time incident updates
 */
export function useRealtimeIncidents(projectId: string): void {
  useRealtimeSubscription(projectId, {
    table: 'incidents',
    invalidateQueries: [
      queryKeys.incidents.open(projectId),
    ],
  });
}

/**
 * Subscribe to real-time anomaly updates
 */
export function useRealtimeAnomalies(projectId: string): void {
  useRealtimeSubscription(projectId, {
    table: 'anomalies',
    event: 'INSERT',
    invalidateQueries: [
      queryKeys.anomalies.recent(projectId),
    ],
  });
}

/**
 * Subscribe to user notifications
 */
export function useRealtimeNotifications(userId: string): void {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!userId) return;
    
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.user.notifications,
          });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Presence tracking for collaborative features
 */
export function usePresence(
  projectId: string,
  userData: { userId: string; name: string; avatar?: string }
): {
  onlineUsers: Array<{ userId: string; name: string; avatar?: string }>;
} {
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ userId: string; name: string; avatar?: string }>
  >([]);
  
  useEffect(() => {
    if (!projectId || !userData.userId) return;
    
    const channel = supabase.channel(`presence-${projectId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((presence: unknown) => {
            const p = presence as { userId: string; name: string; avatar?: string };
            return {
              userId: p.userId,
              name: p.name,
              avatar: p.avatar,
            };
          });
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userData);
        }
      });
    
    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [projectId, userData]);
  
  return { onlineUsers };
}

// Import useState for usePresence
import { useState } from 'react';

/**
 * Broadcast custom events
 */
export function useBroadcast(channelName: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    channelRef.current = supabase.channel(channelName);
    channelRef.current.subscribe();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channelName]);
  
  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    },
    []
  );
  
  const subscribe = useCallback(
    (event: string, callback: (payload: Record<string, unknown>) => void) => {
      if (channelRef.current) {
        channelRef.current.on('broadcast', { event }, ({ payload }) => {
          callback(payload);
        });
      }
    },
    []
  );
  
  return { broadcast, subscribe };
}
