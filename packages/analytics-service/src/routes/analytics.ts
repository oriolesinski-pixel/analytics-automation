import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { logAnalyticsEvent } from '../utils/event-logger';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

async function analyticsRoutes(app: FastifyInstance) {

    // REMOVED: /analytics/overview endpoint - now handled by ingest.ts
    // The overview endpoint is in ingest.ts to work with the new table structure

    // Funnel analysis endpoint
    app.post('/analytics/funnel/graph', async (req, reply) => {
        try {
            const query = z.object({
                app_key: z.string().min(1).optional(),
                full: z.string().min(1).optional()
            }).parse((req as any).query);

            // Support both app_key and full format
            let repo_id: string | null = null;

            if (query.app_key) {
                // Get repo_id from app_key
                const app = await supabase
                    .from('apps')
                    .select('repo_id')
                    .eq('app_key', query.app_key)
                    .single();

                if (app.error) {
                    return reply.code(404).send({ ok: false, error: 'App not found' });
                }
                repo_id = app.data.repo_id;
            } else if (query.full) {
                // Parse owner/name from full parameter
                const [owner, name] = query.full.split('/');
                if (!owner || !name) {
                    return reply.code(400).send({ ok: false, error: 'Invalid repo format. Use owner/name' });
                }

                // Get repo_id from owner/name
                const repo = await supabase
                    .from('repos')
                    .select('id')
                    .eq('provider', 'github')
                    .eq('owner', owner)
                    .eq('name', name)
                    .single();

                if (repo.error) {
                    return reply.code(404).send({ ok: false, error: 'Repository not found' });
                }
                repo_id = repo.data.id;
            } else {
                return reply.code(400).send({ ok: false, error: 'Provide either app_key or full parameter' });
            }

            // Get events from analytics_product_events table
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const { data: events, error } = await supabase
                .from('analytics_product_events')
                .select('event_type, user_id, ts')
                .gte('ts', thirtyDaysAgo.getTime())
                .order('ts', { ascending: true });

            if (error) {
                return reply.code(500).send({ ok: false, error: error.message });
            }

            // Create funnel steps from events
            const steps: any[] = [];

            // Group events by type and calculate funnel
            const eventsByType = new Map<string, any[]>();
            events.forEach((event: any) => {
                const eventType = event.event_type || 'UNKNOWN';
                if (!eventsByType.has(eventType)) {
                    eventsByType.set(eventType, []);
                }
                eventsByType.get(eventType)!.push(event);
            });

            // Calculate conversion funnel
            const totalUsers = new Set(events.map((e: any) => e.user_id).filter(Boolean)).size;
            let stepNumber = 1;

            for (const [eventType, eventList] of eventsByType.entries()) {
                const uniqueUsers = new Set(eventList.map((e: any) => e.user_id).filter(Boolean)).size;
                const conversionRate = totalUsers > 0 ? (uniqueUsers / totalUsers) * 100 : 0;

                steps.push({
                    step: stepNumber++,
                    event_type: eventType,
                    count: eventList.length,
                    unique_users: uniqueUsers,
                    conversion_rate: Math.round(conversionRate * 10) / 10
                });
            }

            // Sort by count descending to create a proper funnel
            steps.sort((a, b) => b.count - a.count);

            // Recalculate step numbers and conversion rates based on funnel order
            steps.forEach((step, index) => {
                step.step = index + 1;
                if (index === 0) {
                    step.conversion_rate = 100;
                } else {
                    step.conversion_rate = Math.round((step.count / steps[0].count) * 100 * 10) / 10;
                }
            });

            return reply.send({
                ok: true,
                funnel: {
                    repo_id: repo_id,
                    period: {
                        from: thirtyDaysAgo.toISOString(),
                        to: new Date().toISOString()
                    },
                    total_events: events.length,
                    unique_users: totalUsers,
                    steps: steps
                }
            });

        } catch (error: any) {
            return reply.code(400).send({ ok: false, error: error.message });
        }
    });

    // Daily sessions endpoint
    app.get('/analytics/session/daily', async (req, reply) => {
        try {
            const query = z.object({
                app_key: z.string().min(1).optional(),
                full: z.string().min(1).optional(),
                days: z.coerce.number().optional().default(30)
            }).parse((req as any).query);

            let app_key: string | null = null;

            if (query.app_key) {
                app_key = query.app_key;
            } else if (query.full) {
                // For backward compatibility with full format
                const [owner, name] = query.full.split('/');
                if (!owner || !name) {
                    return reply.code(400).send({ ok: false, error: 'Invalid repo format. Use owner/name' });
                }
                // Use full as a pseudo app_key
                app_key = `${owner}-${name}`;
            } else {
                return reply.code(400).send({ ok: false, error: 'Provide either app_key or full parameter' });
            }

            // Get events from analytics_product_events for the specified period
            const fromDate = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

            const { data: events, error } = await supabase
                .from('analytics_product_events')
                .select('ts, user_id, session_id')
                .eq('app_key', app_key)
                .gte('ts', fromDate.getTime())
                .order('ts', { ascending: true });

            if (error) {
                return reply.code(500).send({ ok: false, error: error.message });
            }

            // Group events by day and calculate session metrics
            const dailyMetrics = new Map<string, { date: string; sessions: Set<string>; users: Set<string>; events: number }>();

            events.forEach((event: any) => {
                const date = new Date(event.ts).toISOString().split('T')[0]; // YYYY-MM-DD
                const userId = event.user_id;
                const sessionId = event.session_id;

                if (!dailyMetrics.has(date)) {
                    dailyMetrics.set(date, {
                        date,
                        sessions: new Set(),
                        users: new Set(),
                        events: 0
                    });
                }

                const dayData = dailyMetrics.get(date)!;
                if (userId) dayData.users.add(userId);
                if (sessionId) dayData.sessions.add(sessionId);
                dayData.events++;
            });

            // Convert to array format expected by frontend
            const metrics = Array.from(dailyMetrics.values()).map(day => ({
                date: day.date,
                sessions: day.sessions.size,
                unique_users: day.users.size,
                events: day.events
            }));

            return reply.send({
                ok: true,
                daily_sessions: {
                    app_key: app_key,
                    period: {
                        from: fromDate.toISOString(),
                        to: new Date().toISOString()
                    },
                    metrics: metrics
                }
            });

        } catch (error: any) {
            return reply.code(400).send({ ok: false, error: error.message });
        }
    });

    // Simple ping endpoint
    app.get('/analytics/ping', async () => ({ ok: true }));
}

export default fp(analyticsRoutes, { name: 'analytics-routes' });