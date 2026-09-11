// netlify/functions/setCurrentWeek.js
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return json(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const season = Number(event.queryStringParameters?.season);
    const week = Number(event.queryStringParameters?.week);

    const admin = createClient(supabaseUrl, serviceKey);

    if (!(await requireAdmin(admin, token))) return json(401, { ok: false, error: "Unauthorized." });
    if (!season || !week) return json(400, { ok: false, error: "Missing season/week." });

    // Turn off current for EVERY week, not just this season -- is_current is
    // meant to be a singleton across the whole table (exactly one current
    // week, ever), not one-per-season. Scoping this to `.eq("season", season)`
    // let a season-rollover leave the old season's week stuck at
    // is_current=true forever, which silently pointed the scheduled scoring
    // job at a stale week (see 2026-09-10 incident).
    const { error: offErr } = await admin
      .from("weeks")
      .update({ is_current: false })
      .eq("is_current", true);

    if (offErr) return json(500, { ok: false, error: offErr.message });

    // ✅ set target week as current
    const { error: wkErr } = await admin
      .from("weeks")
      .upsert([{ season, week, is_current: true }], { onConflict: "season,week" });

    if (wkErr) return json(500, { ok: false, error: wkErr.message });

    return json(200, { ok: true, season, week, is_current: true });
  } catch (e) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
