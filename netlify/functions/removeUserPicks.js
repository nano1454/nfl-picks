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

    if (pin !== String(adminPin)) return j(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!week) return j(400, { ok: false, error: "Missing week." });
    if (!user_name) return j(400, { ok: false, error: "Missing user_name." });

    const admin = createClient(supabaseUrl, serviceKey);

    const { error: pickErr } = await admin.from("picks").delete().eq("week", week).eq("user_name", user_name);
    if (pickErr) return j(500, { ok: false, error: `picks delete: ${pickErr.message}` });

    const { error: tbErr } = await admin.from("tiebreakers").delete().eq("week", week).eq("user_name", user_name);
    if (tbErr) return j(500, { ok: false, error: `tiebreakers delete: ${tbErr.message}` });

    return j(200, { ok: true, week, user_name });
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
