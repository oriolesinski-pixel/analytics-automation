// src/utils/event-processor.ts
import { getSupabaseClient } from './supabase';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  app_key: string;
  user_id: string;
  session_id: string;
  ts: number; // milliseconds
  data: Record<string, any>;
}

interface ProcessResult {
  status: 'success' | 'deduplicated';
  eventId?: string;
  originalEventId?: string;
  correctionCount?: number;
}

/**
 * Process incoming event with deduplication
 * 
 * Uses PostgreSQL to detect duplicates within 5-second window.
 * No Redis, no external services - just the database you already have.
 * 
 * Deduplication key: user_id + event_type + element_id + 5-second time bucket
 */
export async function processEvent(event: AnalyticsEvent): Promise<ProcessResult> {
  const client = getSupabaseClient();
  
  // Calculate 5-second time bucket (groups events within same 5-second window)
  const fiveSecondsAgo = event.ts - 5000;
  const elementId = event.data?.element_id || null;
  
  try {
    // 1. Check for duplicate in last 5 seconds
    // Uses index: idx_events_dedup on (user_id, event_type, ts DESC)
    const { data: existingEvents, error: selectError } = await client
      .from('analytics_product_events')
      .select('id, data')
      .eq('user_id', event.user_id)
      .eq('event_type', event.event_type)
      .gte('ts', fiveSecondsAgo)
      .lte('ts', event.ts)
      .order('ts', { ascending: false })
      .limit(10);
    
    if (selectError) {
      console.error('Error checking for duplicates:', selectError);
      // On error, insert anyway (fail open)
      await insertEvent(event);
      return { status: 'success', eventId: event.id };
    }
    
    // 2. Find exact duplicate (same element_id)
    if (existingEvents && existingEvents.length > 0) {
      const duplicate = existingEvents.find(e => {
        // Match on element_id if both exist
        if (elementId && e.data?.element_id) {
          return e.data.element_id === elementId;
        }
        // For events without element_id (e.g., PAGE_VIEW), match on path or url
        if (event.event_type === 'PAGE_VIEW') {
          const samePath = e.data?.path && event.data?.path && e.data.path === event.data.path;
          const sameUrl = e.data?.url && event.data?.url && e.data.url === event.data.url;
          return samePath || sameUrl;
        }
        return false;
      });
      
      if (duplicate) {
        // 3. Duplicate found - increment correction count
        const currentCount = parseInt(duplicate.data?.field_correction_count || '0', 10);
        const newCount = currentCount + 1;
        
        const { error: updateError } = await client
          .from('analytics_product_events')
          .update({
            data: {
              ...duplicate.data,
              field_correction_count: newCount,
              last_correction_ts: event.ts
            }
          })
          .eq('id', duplicate.id);
        
        if (updateError) {
          console.error('Error updating correction count:', updateError);
        }
        
        console.log(`✓ Deduplicated event ${event.id} (duplicate of ${duplicate.id}, count: ${newCount})`);
        
        return {
          status: 'deduplicated',
          originalEventId: duplicate.id,
          correctionCount: newCount
        };
      }
    }
    
    // 4. Not a duplicate - insert normally
    await insertEvent(event);
    
    return {
      status: 'success',
      eventId: event.id
    };
    
  } catch (error: any) {
    console.error('Event processing error:', error);
    // On error, try to insert anyway
    try {
      await insertEvent(event);
      return { status: 'success', eventId: event.id };
    } catch (insertError) {
      throw insertError;
    }
  }
}

/**
 * Process batch of events with deduplication
 */
export async function processEvents(events: AnalyticsEvent[]): Promise<{
  success: boolean;
  inserted: number;
  deduplicated: number;
  errors: any[];
  details: ProcessResult[];
}> {
  const results: ProcessResult[] = [];
  const errors: any[] = [];
  let inserted = 0;
  let deduplicated = 0;
  
  // Process events sequentially to maintain deduplication accuracy
  for (const event of events) {
    try {
      const result = await processEvent(event);
      results.push(result);
      
      if (result.status === 'success') {
        inserted++;
      } else if (result.status === 'deduplicated') {
        deduplicated++;
      }
    } catch (error: any) {
      console.error(`Failed to process event ${event.id}:`, error);
      errors.push({
        eventId: event.id,
        error: error.message || 'Unknown error'
      });
    }
  }
  
  return {
    success: errors.length === 0,
    inserted,
    deduplicated,
    errors,
    details: results
  };
}

/**
 * Simple event insertion (used internally)
 */
async function insertEvent(event: AnalyticsEvent): Promise<void> {
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('analytics_product_events')
    .insert([event]);
  
  if (error) {
    throw new Error(`Failed to insert event: ${error.message}`);
  }
}

/**
 * Get deduplication statistics for monitoring
 */
export async function getDeduplicationStats(appKey: string, since: number): Promise<{
  totalEvents: number;
  eventsWithCorrections: number;
  totalCorrections: number;
  avgCorrectionsPerEvent: number;
}> {
  const client = getSupabaseClient();
  
  const { data: events, error } = await client
    .from('analytics_product_events')
    .select('data')
    .eq('app_key', appKey)
    .gte('ts', since);
  
  if (error || !events) {
    return {
      totalEvents: 0,
      eventsWithCorrections: 0,
      totalCorrections: 0,
      avgCorrectionsPerEvent: 0
    };
  }
  
  let eventsWithCorrections = 0;
  let totalCorrections = 0;
  
  events.forEach(event => {
    const correctionCount = parseInt(event.data?.field_correction_count || '0', 10);
    if (correctionCount > 0) {
      eventsWithCorrections++;
      totalCorrections += correctionCount;
    }
  });
  
  return {
    totalEvents: events.length,
    eventsWithCorrections,
    totalCorrections,
    avgCorrectionsPerEvent: eventsWithCorrections > 0 
      ? totalCorrections / eventsWithCorrections 
      : 0
  };
}

