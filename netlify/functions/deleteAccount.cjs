const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const username = String(event.queryStringParameters?.username || "").trim();

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!username) return j(400, { ok: false, error: "Missing username." });

    const { data: found, error: findErr } = await admin
      .from("app_users")
      .select("username, full_name, is_admin, approved")
      .ilike("username", username)
      .maybeSingle();
    if (findErr) return j(500, { ok: false, error: findErr.message });
    if (!found) return j(404, { ok: false, error: "No account with that username." });
    if (found.is_admin) return j(400, { ok: false, error: "Refusing to delete an admin account through this tool." });

    const { error: delErr } = await admin.from("app_users").delete().ilike("username", username);
    if (delErr) return j(500, { ok: false, error: delErr.message });

    // Only touch participants if this account was ever approved -- a still-
    // pending signup never got a participants row, and skipping this avoids
    // deactivating an unrelated real participant who happens to share the
    // same full_name text (participants has no FK back to app_users).
    if (found.approved && found.full_name) {
      const { error: updErr } = await admin.from("participants").update({ active: false }).eq("user_name", found.full_name);
      if (updErr) return j(500, { ok: false, error: updErr.message });
    }

    return j(200, { ok: true, username: found.username });
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
