// netlify/functions/getSeasonHistory.cjs
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const season = Number(event.queryStringParameters?.season || "");
    if (!season) return j(400, { ok: false, error: "Missing season." });

    const admin = createClient(supabaseUrl, serviceKey);

    // weeks has no public RLS policy, so this list can only come from a
    // service-role-backed function -- same reason getweek.cjs exists.
    const { data: weekRows, error: weeksErr } = await admin
      .from("weeks")
      .select("week, is_current")
      .eq("season", season)
      .order("week", { ascending: false });
    if (weeksErr) throw weeksErr;

    const weeks = await Promise.all(
      (weekRows || []).map(async (w) => {
        const week = Number(w.week);

        const [{ count: gamesTotal }, { count: gamesFinal }, { data: lbRows, error: lbErr }] = await Promise.all([
          admin.from("games").select("id", { count: "exact", head: true }).eq("season", season).eq("week", week),
          admin
            .from("game_results")
            .select("game_id", { count: "exact", head: true })
            .eq("season", season)
            .eq("week", week)
            .eq("status", "FINAL"),
          admin
            .from("leaderboard")
            .select("user_name, points")
            .eq("season", season)
            .eq("week", week)
            .order("points", { ascending: false })
            .limit(1),
        ]);
        if (lbErr) throw lbErr;

        const total = gamesTotal || 0;
        const final = gamesFinal || 0;
        const status = final === 0 ? "upcoming" : final < total ? "in_progress" : total > 0 ? "final" : "upcoming";

        const top = lbRows?.[0] || null;

        return {
          week,
          isCurrent: !!w.is_current,
          status,
          gamesTotal: total,
          gamesFinal: final,
          topUser: top?.user_name ?? null,
          topPoints: top ? Number(top.points) : null,
        };
      })
    );

    return j(200, { ok: true, season, weeks });
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
