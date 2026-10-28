const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const season = Number(event.queryStringParameters?.season);

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!season) return j(400, { ok: false, error: "Missing season." });

    const { data: settings, error: settingsErr } = await admin
      .from("preseason_tracker_settings")
      .select("season, enabled, target_amount")
      .eq("season", season)
      .maybeSingle();
    if (settingsErr) return j(500, { ok: false, error: settingsErr.message });

    const { data: deposits, error: depositsErr } = await admin
      .from("preseason_deposits")
      .select("id, season, user_name, amount, status, note, submitted_at, reviewed_at, reviewed_by")
      .eq("season", season)
      .order("submitted_at", { ascending: true });
    if (depositsErr) return j(500, { ok: false, error: depositsErr.message });

    return j(200, {
      ok: true,
      season,
      settings: settings || { season, enabled: false, target_amount: 540 },
      deposits: deposits || [],
    });
  } catch (e) {
    return j(500, { ok: false, error: e?.message || String(e) });
  }
};

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
