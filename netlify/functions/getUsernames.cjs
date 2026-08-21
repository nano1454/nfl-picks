const { createClient } = require("@supabase/supabase-js");

// Public (no admin auth) -- exposes only { full_name: username } and
// { full_name: avatar } for approved accounts, so participant-facing pages
// (Results, Leaderboard) can display usernames/avatars instead of full names
// while the actual join key in picks/bonus_picks/tiebreakers/leaderboard/
// participants stays full_name. Usernames/avatars are already visible
// in-app (login, the picker), so none of this is sensitive.
exports.handler = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rows, error } = await admin
      .from("app_users")
      .select("username, full_name, avatar")
      .eq("approved", true);
    if (error) return j(500, { ok: false, error: error.message });

    const usernames = {};
    const avatars = {};
    for (const r of rows || []) {
      const name = String(r.full_name || "").trim();
      if (!name) continue;
      usernames[name] = r.username || "";
      avatars[name] = r.avatar || null;
    }

    return j(200, { ok: true, usernames, avatars });
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
