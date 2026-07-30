const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const user_name = String(event.queryStringParameters?.user_name || "").trim();
    const active = String(event.queryStringParameters?.active || "") === "true";

    const admin = createClient(supabaseUrl, serviceKey);

    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!user_name) return j(400, { ok: false, error: "Missing user_name." });

    const { error } = await admin.from("participants").update({ active }).eq("user_name", user_name);
    if (error) return j(500, { ok: false, error: error.message });

    return j(200, { ok: true, user_name, active });
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
