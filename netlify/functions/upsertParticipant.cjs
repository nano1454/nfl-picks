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
    const user_name = String(event.queryStringParameters?.user_name || "").trim();
    const buyInRaw = event.queryStringParameters?.buy_in;
    const activeRaw = event.queryStringParameters?.active;

    if (pin !== String(adminPin)) return j(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!user_name) return j(400, { ok: false, error: "Missing user_name." });

    const row = { user_name };
    if (buyInRaw !== undefined) {
      const buyIn = Number(buyInRaw);
      if (Number.isNaN(buyIn) || buyIn < 0) return j(400, { ok: false, error: "Invalid buy_in." });
      row.buy_in = buyIn;
    }
    if (activeRaw !== undefined) row.active = activeRaw === "true";

    const admin = createClient(supabaseUrl, serviceKey);

    const { error } = await admin.from("participants").upsert([row], { onConflict: "user_name" });
    if (error) return j(500, { ok: false, error: error.message });

    return j(200, { ok: true, participant: row });
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
