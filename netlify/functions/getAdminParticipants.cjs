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

    if (pin !== String(adminPin)) return j(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!week) return j(400, { ok: false, error: "Missing week." });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: participants, error: partErr } = await admin
      .from("participants")
      .select("user_name, buy_in, active")
      .eq("active", true)
      .order("user_name", { ascending: true });
    if (partErr) return j(500, { ok: false, error: `participants: ${partErr.message}` });

    const { data: payRows, error: payErr } = await admin
      .from("week_payments")
      .select("user_name, paid")
      .eq("week", week);
    if (payErr) return j(500, { ok: false, error: `week_payments: ${payErr.message}` });

    const payments = {};
    for (const r of payRows || []) payments[String(r.user_name || "").trim()] = !!r.paid;

    return j(200, { ok: true, participants: participants || [], payments });
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
