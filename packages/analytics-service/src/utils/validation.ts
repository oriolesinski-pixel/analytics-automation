import { z } from 'zod';

/**
 * Schema for a single analytics event
 */
export const AnalyticsEventSchema = z.object({
  id: z.string().uuid().optional().or(z.string()), // Allow any string for id, or generate UUID
  event_type: z.string().min(1, 'event_type is required'),
  app_key: z.string().min(1, 'app_key is required'),
  user_id: z.string().min(1, 'user_id is required'),
  session_id: z.string().min(1, 'session_id is required'),
  ts: z.number().int().positive().or(z.number().positive()), // milliseconds timestamp
  data: z.record(z.any()).default({}),
});

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

/**
 * Schema for the ingest request
 */
export const IngestRequestSchema = z.object({
  app_key: z.string().min(1, 'app_key is required'),
  events: z.array(AnalyticsEventSchema).min(1, 'events array must contain at least one event'),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

/**
 * Validate and parse an ingest request
 */
export function validateIngestRequest(data: unknown): {
  success: boolean;
  data?: IngestRequest;
  errors?: z.ZodIssue[];
} {
  const result = IngestRequestSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate stream query parameters
 */
export const StreamQuerySchema = z.object({
  app_key: z.string().min(1, 'app_key is required'),
  session_id: z.string().optional(),
});

export type StreamQuery = z.infer<typeof StreamQuerySchema>;
