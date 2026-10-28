const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

// The on/off switch. Dormant by default (preseason_tracker_settings.enabled
// defaults to false in add_preseason_tracker.sql) -- this is the only way
// it ever flips to true, so the Season Fund page/nav link stay hidden from
// participants until the admin calls this explicitly.
exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const season = Number(event.queryStringParameters?.season);
    const enabled = String(event.queryStringParameters?.enabled || "") === "true";
    const targetAmountParam = event.queryStringParameters?.target_amount;

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!season) return j(400, { ok: false, error: "Missing season." });

    const row = { season, enabled };
    if (targetAmountParam !== undefined && targetAmountParam !== "") {
      const targetAmount = Number(targetAmountParam);
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) return j(400, { ok: false, error: "target_amount must be a positive number." });
      row.target_amount = targetAmount;
    }

    const { error: upsertErr } = await admin.from("preseason_tracker_settings").upsert([row], { onConflict: "season" });
    if (upsertErr) return j(500, { ok: false, error: upsertErr.message });

    return j(200, { ok: true, season, enabled });
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
