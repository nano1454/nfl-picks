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
    const week = Number(event.queryStringParameters?.week || "");
    const user_name = String(event.queryStringParameters?.user_name || "").trim();
    const paid = String(event.queryStringParameters?.paid || "") === "true";

    if (pin !== String(adminPin)) return j(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!week) return j(400, { ok: false, error: "Missing week." });
    if (!user_name) return j(400, { ok: false, error: "Missing user_name." });

    const admin = createClient(supabaseUrl, serviceKey);

    // Make sure the participant row exists (mirrors the old client-side behavior).
    const { error: partErr } = await admin.from("participants").upsert([{ user_name }], { onConflict: "user_name" });
    if (partErr) return j(500, { ok: false, error: `participants: ${partErr.message}` });

    const { error: payErr } = await admin
      .from("week_payments")
      .upsert([{ week, user_name, paid }], { onConflict: "week,user_name" });
    if (payErr) return j(500, { ok: false, error: `week_payments: ${payErr.message}` });

    return j(200, { ok: true, week, user_name, paid });
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
