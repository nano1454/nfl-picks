// netlify/functions/getPaymentStatus.cjs
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const week = Number(event.queryStringParameters?.week || "");
    const userName = String(event.queryStringParameters?.user_name || "").trim();

    if (!week) return j(400, { ok: false, error: "Missing week." });
    if (!userName) return j(400, { ok: false, error: "Missing user_name." });

    const admin = createClient(supabaseUrl, serviceKey);

    // week_payments has no public RLS policy -- this read-only lookup for the
    // requesting participant's own paid flag is what the picks page uses to
    // decide whether to show the "don't forget your buy-in" prompt.
    const { data, error } = await admin
      .from("week_payments")
      .select("paid")
      .eq("week", week)
      .ilike("user_name", userName)
      .maybeSingle();

    if (error) throw error;

    return j(200, { ok: true, paid: !!data?.paid });
  } catch (e) {
    return j(500, { ok: false, error: String(e?.message || e) });
  }
};

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
