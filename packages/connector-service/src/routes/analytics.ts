import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

async function analyticsRoutes(app: FastifyInstance) {
    // Existing overview endpoint
    app.get('/analytics/overview', async (req, reply) => {
        try {
            const query = z.object({
                app_key: z.string().min(1),
                from: z.coerce.date().optional(),
                to: z.coerce.date().optional()
            }).parse((req as any).query);

            // Get repo_id from app_key
            const app = await supabase
                .from('apps')
                .select('repo_id')
                .eq('app_key', query.app_key)
                .single();
            if (app.error) return reply.code(404).send({ ok: false, error: 'app not found' });

            const fromDate = query.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const toDate = query.to || new Date();

            const { data: events, error } = await supabase
                .from('events')
                .select('verb, metadata, ts')
                .eq('repo_id', app.data.repo_id)
                .eq('app_key', query.app_key)
                .gte('ts', fromDate.toISOString())
                .lte('ts', toDate.toISOString());

            if (error) return reply.code(500).send({ ok: false, error: error.message });

            const totalEvents = events.length;
            const uniqueSessions = new Set(events.map((e: any) => e.metadata?.session_id).filter(Boolean)).size;
            const uniqueUsers = new Set(events.map((e: any) => e.metadata?.user_id).filter(Boolean)).size;

            const eventCounts = new Map<string, number>();
            events.forEach((e: any) => {
                eventCounts.set(e.verb, (eventCounts.get(e.verb) || 0) + 1);
            });

            return reply.send({
                ok: true,
                overview: {
                    app_key: query.app_key,
                    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
                    total_events: totalEvents,
                    unique_sessions: uniqueSessions,
                    unique_users: uniqueUsers,
                    events_by_type: Array.from(eventCounts.entries()).map(([verb, count]) => ({ verb, count }))
                }
            });
        } catch (error: any) {
            return reply.code(400).send({ ok: false, error: error.message });
        }
    });

    // NEW: Funnel analysis endpoint that your TopKPIs and BasicFunnel components expect
    app.post('/analytics/funnel/graph', async (req, reply) => {
        try {
            const query = z.object({
                full: z.string().min(1) // repo full name like "owner/name"
            }).parse((req as any).query);

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

            // Get events for this repo from the last 30 days
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const { data: events, error } = await supabase
                .from('events')
                .select('verb, metadata, ts, user_id')
                .eq('repo_id', repo.data.id)
                .gte('ts', thirtyDaysAgo.toISOString())
                .order('ts', { ascending: true });

            if (error) {
                return reply.code(500).send({ ok: false, error: error.message });
            }

            // Create funnel steps from events
            const eventTypes = ['page_view', 'click', 'form_view', 'form_submit', 'purchase'];
            const steps: any[] = [];

            // Group events by type and calculate funnel
            const eventsByType = new Map<string, any[]>();
            events.forEach((event: any) => {
                const verb = event.verb || 'unknown';
                if (!eventsByType.has(verb)) {
                    eventsByType.set(verb, []);
                }
                eventsByType.get(verb)!.push(event);
            });

            // Calculate conversion funnel
            const totalUsers = new Set(events.map((e: any) => e.user_id || e.metadata?.user_id).filter(Boolean)).size;
            let stepNumber = 1;

            for (const [eventType, eventList] of eventsByType.entries()) {
                const uniqueUsers = new Set(eventList.map((e: any) => e.user_id || e.metadata?.user_id).filter(Boolean)).size;
                const conversionRate = totalUsers > 0 ? (uniqueUsers / totalUsers) * 100 : 0;

                steps.push({
                    step: stepNumber++,
                    event_type: eventType,
                    count: eventList.length,
                    unique_users: uniqueUsers,
                    conversion_rate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
                    avg_time_to_next_ms: null // Could calculate this if needed
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
                    repo_id: repo.data.id,
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

    // NEW: Daily sessions endpoint that your TopKPIs component expects
    app.get('/analytics/session/daily', async (req, reply) => {
        try {
            const query = z.object({
                full: z.string().min(1), // repo full name like "owner/name"
                days: z.coerce.number().optional().default(30)
            }).parse((req as any).query);

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

            // Get events for the specified period
            const fromDate = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

            const { data: events, error } = await supabase
                .from('events')
                .select('ts, metadata, user_id')
                .eq('repo_id', repo.data.id)
                .gte('ts', fromDate.toISOString())
                .order('ts', { ascending: true });

            if (error) {
                return reply.code(500).send({ ok: false, error: error.message });
            }

            // Group events by day and calculate session metrics
            const dailyMetrics = new Map<string, { date: string; sessions: number; users: Set<string> }>();

            events.forEach((event: any) => {
                const date = new Date(event.ts).toISOString().split('T')[0]; // YYYY-MM-DD
                const userId = event.user_id || event.metadata?.user_id || event.metadata?.session_id;

                if (!dailyMetrics.has(date)) {
                    dailyMetrics.set(date, {
                        date,
                        sessions: 0,
                        users: new Set()
                    });
                }

                const dayData = dailyMetrics.get(date)!;
                if (userId) {
                    dayData.users.add(userId);
                }
                dayData.sessions++;
            });

            // Convert to array format expected by frontend
            const metrics = Array.from(dailyMetrics.values()).map(day => ({
                date: day.date,
                sessions: day.users.size, // Use unique users as session count
                events: day.sessions
            }));

            return reply.send({
                ok: true,
                daily_sessions: {
                    repo_id: repo.data.id,
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