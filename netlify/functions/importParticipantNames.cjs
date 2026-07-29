const { createClient } = require("@supabase/supabase-js");

function normalizeName(s) {
  return (s || "").trim();
}

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

    const { data: pickRows, error: pickErr } = await admin.from("picks").select("user_name").eq("week", week);
    if (pickErr) return j(500, { ok: false, error: `picks: ${pickErr.message}` });

    const { data: tbRows, error: tbErr } = await admin.from("tiebreakers").select("user_name").eq("week", week);
    if (tbErr) return j(500, { ok: false, error: `tiebreakers: ${tbErr.message}` });

    const names = new Set();
    for (const r of pickRows || []) names.add(normalizeName(r.user_name));
    for (const r of tbRows || []) names.add(normalizeName(r.user_name));
    names.delete("");

    const { data: existingRows, error: existingErr } = await admin
      .from("participants")
      .select("user_name")
      .eq("active", true);
    if (existingErr) return j(500, { ok: false, error: `participants: ${existingErr.message}` });

    const existing = new Set((existingRows || []).map((p) => normalizeName(p.user_name)));
    const toAdd = [...names].filter((n) => n && !existing.has(n));

    if (toAdd.length === 0) return j(200, { ok: true, added: [] });

    const rows = toAdd.map((user_name) => ({ user_name, buy_in: 0, active: true }));
    const { error: upsertErr } = await admin.from("participants").upsert(rows, { onConflict: "user_name" });
    if (upsertErr) return j(500, { ok: false, error: upsertErr.message });

    return j(200, { ok: true, added: toAdd });
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
