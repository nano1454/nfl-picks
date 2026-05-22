import { createClient } from "@supabase/supabase-js";

/**
 * /.netlify/functions/simulateGameFinal?season=2025&week=10&game_id=2025_10_LV_DEN&home_score=25&away_score=21&pin=0287
 *
 * Requires env:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - ADMIN_PIN
 */
export default async (req) => {
  try {
    const url = new URL(req.url);

    const pin = String(url.searchParams.get("pin") || "");
    const season = Number(url.searchParams.get("season") || "");
    const week = Number(url.searchParams.get("week") || "");
    const gameId = String(url.searchParams.get("game_id") || "").trim();

    const homeScore = Number(url.searchParams.get("home_score"));
    const awayScore = Number(url.searchParams.get("away_score"));

    if (!process.env.ADMIN_PIN) return json(500, { ok: false, error: "Missing ADMIN_PIN on server env." });
    if (!process.env.SUPABASE_URL) return json(500, { ok: false, error: "Missing SUPABASE_URL on server env." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server env." });

    if (pin !== String(process.env.ADMIN_PIN)) return json(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!season || !week || !gameId) return json(400, { ok: false, error: "Missing season/week/game_id." });
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore))
      return json(400, { ok: false, error: "home_score and away_score must be numbers." });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1) Get game info (away/home names) so winner matches UI picks
    const { data: game, error: gameErr } = await admin
      .from("games")
      .select("id, season, week, away, home")
      .eq("id", gameId)
      .maybeSingle();

    if (gameErr) throw gameErr;
    if (!game) return json(404, { ok: false, error: `Game not found in games table: ${gameId}` });

    const awayName = String(game.away || "").trim();
    const homeName = String(game.home || "").trim();

let winner_team = "TIE";
let winner = "TIE";

if (homeScore > awayScore) {
  winner_team = homeName;
  winner = "HOME";
} else if (awayScore > homeScore) {
  winner_team = awayName;
  winner = "AWAY";
}

    // 2) Upsert into game_results (ONLY columns that are very likely to exist)
    // IMPORTANT: We intentionally do NOT write winner_team because your table doesn't have it.
 const grRow = {
  season,
  week,
  game_id: gameId,
  status: "FINAL",
  home_score: homeScore,
  away_score: awayScore,
  winner, // <-- AWAY/HOME/TIE
  updated_at: new Date().toISOString(),
};

const winnerLabel =
  winner === "AWAY" ? awayName : winner === "HOME" ? homeName : "TIE";


    const { error: grErr } = await admin
      .from("game_results")
      .upsert([grRow], { onConflict: "season,week,game_id" });

    if (grErr) throw grErr;

    // 3) Best-effort update games table (only if those columns exist)
    // We don't want a schema mismatch here to break the function.
    try {
      await admin
        .from("games")
        .update({
          status: "FINAL",
          home_score: homeScore,
          away_score: awayScore,
          // winner_team intentionally omitted
        })
        .eq("id", gameId);
    } catch {
      // ignore if games table doesn't have these columns
    }

    return json(200, {
      ok: true,
      season,
      week,
      game_id: gameId,
      away: awayName,
      home: homeName,
      away_score: awayScore,
      home_score: homeScore,
      winner_team, // returned to UI even if not stored in DB
      wrote_to: ["game_results", "games (best-effort)"],
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}