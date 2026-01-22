/**
 * Event Quality Processor
 * 
 * Server-side event processing for quality enforcement.
 * Handles deduplication, aggregation, and enrichment at ingestion time.
 * 
 * This complements the client-side simplified tracker by performing
 * operations that require a complete view across all sessions/devices.
 */

import Redis from 'ioredis';

interface EventPayload {
  id: string;
  ts: number;
  app_key: string;
  session_id: string;
  user_id: string;
  event_type: string;
  data: Record<string, any>;
}

interface ProcessedEvent extends EventPayload {
  data: Record<string, any> & {
    field_correction_count?: number;
    session_event_count?: number;
    is_correction?: boolean;
  };
}

export class EventQualityProcessor {
  private redis: Redis;
  private deduplicationWindowSeconds: number;

  constructor(redis: Redis, options: { deduplicationWindowSeconds?: number } = {}) {
    this.redis = redis;
    this.deduplicationWindowSeconds = options.deduplicationWindowSeconds || 5;
  }

  /**
   * Process incoming event with quality rules.
   * Returns processed event or null if deduplicated.
   */
  async processEvent(event: EventPayload): Promise<ProcessedEvent | null> {
    // 1. Deduplication Check
    if (await this.isDuplicate(event)) {
      await this.incrementCorrectionCount(event);
      return null; // Don't store duplicate
    }

    // 2. Enrichment - Add computed fields
    const enrichedEvent = await this.enrichEvent(event);

    // 3. Cache event for deduplication window
    await this.cacheEvent(event);

    return enrichedEvent;
  }

  /**
   * Check if event is a duplicate within time window.
   * Based on: user_id + element_id + event_type + time_bucket
   */
  private async isDuplicate(event: EventPayload): Promise<boolean> {
    const dedupKey = this.getDeduplicationKey(event);
    const exists = await this.redis.exists(dedupKey);
    return exists === 1;
  }

  /**
   * Generate deduplication key for an event.
   * Groups events within time buckets to detect rapid repeated actions.
   */
  private getDeduplicationKey(event: EventPayload): string {
    // Time bucket: group events within dedup window
    const timeBucket = Math.floor(event.ts / this.deduplicationWindowSeconds);

    const components = [
      event.user_id,
      event.event_type,
      event.data.element_id || 'no-element',
      event.data.page_path || 'no-path',
      timeBucket.toString()
    ];

    return `dedup:${components.join(':')}`;
  }

  /**
   * Track that user made a correction/repeated action.
   * This increments a counter that will be attached to the first event.
   */
  private async incrementCorrectionCount(event: EventPayload): Promise<void> {
    const correctionKey = `corrections:${this.getDeduplicationKey(event)}`;
    await this.redis.incr(correctionKey);
    await this.redis.expire(correctionKey, this.deduplicationWindowSeconds);
  }

  /**
   * Cache event for deduplication checking.
   */
  private async cacheEvent(event: EventPayload): Promise<void> {
    const dedupKey = this.getDeduplicationKey(event);
    await this.redis.setex(dedupKey, this.deduplicationWindowSeconds, '1');
  }

  /**
   * Enrich event with computed fields that require historical data.
   * Schema already has semantic_action, conversion_relevance, etc.
   * This adds server-only context like session counts and correction metadata.
   */
  private async enrichEvent(event: EventPayload): Promise<ProcessedEvent> {
    const enrichedData = { ...event.data };

    // Add session event count
    enrichedData.session_event_count = await this.getSessionEventCount(event.session_id);

    // Add correction count if this event had corrections
    const correctionKey = `corrections:${this.getDeduplicationKey(event)}`;
    const correctionCount = await this.redis.get(correctionKey);
    
    if (correctionCount && parseInt(correctionCount) > 0) {
      enrichedData.field_correction_count = parseInt(correctionCount);
      enrichedData.is_correction = true;
    }

    return {
      ...event,
      data: enrichedData
    };
  }

  /**
   * Get number of events in this session.
   */
  private async getSessionEventCount(sessionId: string): Promise<number> {
    const countKey = `session:${sessionId}:count`;
    const count = await this.redis.incr(countKey);
    
    // Expire after 1 hour of inactivity
    await this.redis.expire(countKey, 3600);
    
    return count;
  }

  /**
   * Batch process multiple events.
   * More efficient than processing one at a time.
   */
  async processBatch(events: EventPayload[]): Promise<ProcessedEvent[]> {
    const results = await Promise.all(
      events.map(event => this.processEvent(event))
    );
    
    // Filter out null (deduplicated) events
    return results.filter((event): event is ProcessedEvent => event !== null);
  }

  /**
   * Get deduplication statistics for monitoring.
   */
  async getStats(): Promise<{
    deduplicationWindowSeconds: number;
    activeSessions: number;
    cachedEvents: number;
  }> {
    // Count active session keys
    const sessionKeys = await this.redis.keys('session:*:count');
    
    // Count active dedup keys
    const dedupKeys = await this.redis.keys('dedup:*');

    return {
      deduplicationWindowSeconds: this.deduplicationWindowSeconds,
      activeSessions: sessionKeys.length,
      cachedEvents: dedupKeys.length
    };
  }

  /**
   * Clear all cached deduplication data.
   * Useful for testing or maintenance.
   */
  async clearCache(): Promise<void> {
    const dedupKeys = await this.redis.keys('dedup:*');
    const correctionKeys = await this.redis.keys('corrections:*');
    const sessionKeys = await this.redis.keys('session:*:count');

    const allKeys = [...dedupKeys, ...correctionKeys, ...sessionKeys];

    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }
  }
}

/**
 * Factory function to create processor with default Redis connection
 */
export function createEventQualityProcessor(
  redisUrl?: string,
  options?: { deduplicationWindowSeconds?: number }
): EventQualityProcessor {
  const redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  return new EventQualityProcessor(redis, options);
}

