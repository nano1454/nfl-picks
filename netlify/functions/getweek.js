// netlify/functions/getweek.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Find current week row
    const { data: cur, error: curErr } = await admin
      .from("weeks")
      .select("season, week, deadline, byes, tiebreakers, is_current")
      .eq("is_current", true)
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (curErr) throw curErr;
    if (!cur) return j(200, { ok: true, season: null, week: null, games: [], tiebreakers: [], deadline: null });

    const season = Number(cur.season);
    const week = Number(cur.week);

    // 2) Week meta (deadline/tiebreakers) as fallback / source of truth if you prefer
    const { data: meta, error: metaErr } = await admin
      .from("week_meta")
      .select("deadline, tiebreakers, byes")
      .eq("season", season)
      .eq("week", week)
      .maybeSingle();

    if (metaErr) throw metaErr;

    // prefer week_meta.deadline if set; else weeks.deadline
    const deadline = meta?.deadline ?? cur?.deadline ?? null;
    const tiebreakers = Array.isArray(meta?.tiebreakers)
      ? meta.tiebreakers
      : Array.isArray(cur?.tiebreakers)
      ? cur.tiebreakers
      : [];
    const byes = Array.isArray(meta?.byes) ? meta.byes : Array.isArray(cur?.byes) ? cur.byes : [];

    // 3) Load games for that season/week
    const { data: games, error: gamesErr } = await admin
      .from("games")
      .select("id, season, week, away, home, kickoff")
      .eq("season", season)
      .eq("week", week)
      .order("kickoff", { ascending: true });

    if (gamesErr) throw gamesErr;

    return j(200, {
      ok: true,
      season,
      week,
      deadline, // ✅ now exposed
      byes,
      tiebreakers: (tiebreakers || []).slice(0, 3),
      games: games || [],
    });
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