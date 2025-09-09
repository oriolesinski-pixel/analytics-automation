import type { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { createClient } from "@supabase/supabase-js";

export default async function selfcheck(app: FastifyInstance) {
  app.get("/selfcheck", async () => {
    const start = Date.now();
    const res: any = { ok: false, checks: {}, duration_ms: 0 };

    // ---- ENV presence
    const required = [
      "PORT",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GITHUB_APP_ID",
      "GITHUB_WEBHOOK_SECRET",
      "GH_APP_SLUG",
    ];
    res.checks.env = {
      required_present: required.filter((k) => !!process.env[k]),
      required_missing: required.filter((k) => !process.env[k]),
      provided_private_key: !!process.env.GITHUB_PRIVATE_KEY,
      provided_private_key_path: !!process.env.GITHUB_PRIVATE_KEY_PATH,
    };

    // ---- GitHub private key load
    let privateKey: string | null = null;
    try {
      if (process.env.GITHUB_PRIVATE_KEY) {
        let k = process.env.GITHUB_PRIVATE_KEY.trim();
        if (
          (k.startsWith('"') && k.endsWith('"')) ||
          (k.startsWith("'") && k.endsWith("'"))
        ) {
          k = k.slice(1, -1);
        }
        privateKey = k.replace(/\\n/g, "\n").trim();
      } else if (process.env.GITHUB_PRIVATE_KEY_PATH) {
        const p = process.env.GITHUB_PRIVATE_KEY_PATH;
        const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
        privateKey = fs.readFileSync(abs, "utf8").trim();
      }
      res.checks.github_private_key = { ok: true };
    } catch (err: any) {
      res.checks.github_private_key = { ok: false, error: err.message };
    }

    // ---- GitHub App auth check
    try {
      if (!privateKey) throw new Error("No private key loaded");
      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: { appId: process.env.GITHUB_APP_ID!, privateKey },
      });

      const appInfo = await appOctokit.request("GET /app");
      const installs = await appOctokit.request("GET /app/installations");

      res.checks.github_app = {
        ok: true,
        app_slug: appInfo.data?.slug,
        app_name: appInfo.data?.name,
        installation_ids: installs.data.map((i: any) => i.id),
        installation_accounts: installs.data.map((i: any) => i.account?.login),
      };

      if (installs.data.length > 0) {
        const installationId = installs.data[0].id;
        const auth = (await appOctokit.auth({
          type: "installation",
          installationId,
        })) as any;
        res.checks.github_installation_token = {
          ok: !!auth?.token,
          installation_id: installationId,
          token_preview: auth?.token
            ? auth.token.slice(0, 6) + "…"
            : null,
        };
      } else {
        res.checks.github_installation_token = {
          ok: false,
          error: "No installations found",
        };
      }
    } catch (err: any) {
      res.checks.github_app = { ok: false, error: err.message };
    }

    // ---- Supabase check
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const note = `hello-${Date.now()}`;

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
      (res.checks.github_private_key?.ok ?? false) &&
      (res.checks.github_app?.ok ?? false) &&
      (res.checks.supabase?.ok ?? false);

    res.duration_ms = Date.now() - start;
    return res;
  });
}
