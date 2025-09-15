import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";

export default async function selfcheck(app: FastifyInstance) {
    app.get("/selfcheck", async () => {
        const start = Date.now();
        const res: any = { ok: false, checks: {}, duration_ms: 0 };

        // ---- ENV presence (only what analytics-service needs)
        const required = [
            "ANALYTICS_PORT",
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY"
        ];

        res.checks.env = {
            required_present: required.filter((k) => !!process.env[k]),
            required_missing: required.filter((k) => !process.env[k])
        };

        // ---- Supabase check
        try {
            const supabase = createClient(
                process.env.SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            const note = `analytics-service-${Date.now()}`;

            const ins = await supabase
                .from("connector_ping")
                .insert({ note })
                .select()
                .single();
            if (ins.error) throw new Error(ins.error.message);

            const sel = await supabase
                .from("connector_ping")
                .select("*")
                .order("id", { ascending: false })
                .limit(1);
            if (sel.error) throw new Error(sel.error.message);

            res.checks.supabase = {
                ok: true,
                inserted_note: note,
                last_row: sel.data?.[0] ?? null,
            };
        } catch (err: any) {
            res.checks.supabase = { ok: false, error: err.message };
        }

        // ---- Health
        res.checks.healthz = { ok: true };

        res.ok =
            res.checks.env.required_missing.length === 0 &&
            (res.checks.supabase?.ok ?? false);

        res.duration_ms = Date.now() - start;
        return res;
    });
}