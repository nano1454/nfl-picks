// netlify/functions/setWeekDeadline.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminPin = process.env.ADMIN_PIN;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });
    if (!adminPin) return j(500, { ok: false, error: "Missing ADMIN_PIN." });

    const pin = String(event.queryStringParameters?.pin || "");
    const season = Number(event.queryStringParameters?.season || "");
    const week = Number(event.queryStringParameters?.week || "");
    const deadlineRaw = String(event.queryStringParameters?.deadline || "").trim();

    if (pin !== String(adminPin)) return j(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!season || !week) return j(400, { ok: false, error: "Missing season/week." });
    if (!deadlineRaw) return j(400, { ok: false, error: "Missing deadline." });

    const deadlineIso = new Date(deadlineRaw).toISOString();
    if (!deadlineIso || deadlineIso === "Invalid Date") {
      return j(400, { ok: false, error: "Invalid deadline date. Use ISO format." });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // week_meta
    const { error: metaErr } = await admin
      .from("week_meta")
      .upsert([{ season, week, deadline: deadlineIso }], { onConflict: "season,week" });

    if (metaErr) return j(500, { ok: false, error: `week_meta upsert: ${metaErr.message}` });

    // weeks (keep in sync)
    const { error: weeksErr } = await admin
      .from("weeks")
      .upsert([{ season, week, deadline: deadlineIso }], { onConflict: "season,week" });

    if (weeksErr) return j(500, { ok: false, error: `weeks upsert: ${weeksErr.message}` });

    return j(200, { ok: true, season, week, deadline: deadlineIso });
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