const { createClient } = require("@supabase/supabase-js");

// Public (no admin token) -- playoffs_participants has no public RLS policy
// (same lockdown as participants), so this is the only way pages like
// WhosIn.jsx or the pot calculators can see who's active for playoffs.
// Mirrors getweek.cjs's own activeParticipants sub-purpose, but for the
// independent playoffs roster instead of the regular-season one.
exports.handler = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin
      .from("playoffs_participants")
      .select("user_name")
      .eq("active", true)
      .order("user_name", { ascending: true });
    if (error) return j(500, { ok: false, error: error.message });

    return j(200, { ok: true, activeParticipants: (data || []).map((r) => r.user_name) });
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
