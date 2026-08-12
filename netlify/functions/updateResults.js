import { createClient } from "@supabase/supabase-js";

const CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
const BONUS_STATS_CSV_URL = (season) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`;

function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// game_id format is "{season}_{week}_{awayAbbr}_{homeAbbr}" (nflverse convention,
// same string this app already uses as games.id -- see importSchedule.cjs).
function awayHomeAbbrFromGameId(gameId) {
  const parts = String(gameId).split("_");
  if (parts.length < 4) return null;
  return { awayAbbr: parts[parts.length - 2], homeAbbr: parts[parts.length - 1] };
}

// Returns { [gameId]: { awayPassing, homePassing, awayRushing, homeRushing,
// passingWinner, rushingWinner } } for whichever of `gameIds` already have
// both teams' rows published in nflverse's weekly team-stats file. This file
// is derived from play-by-play and typically isn't published until a few
// hours after a game goes FINAL in the score feed -- entries are simply
// absent for anything not yet available, and the caller retries next run.
async function fetchBonusStatsByGame(season, gameIds) {
  const wanted = new Set(gameIds);
  const res = await fetch(BONUS_STATS_CSV_URL(season), { headers: { "User-Agent": "netlify-function" } });
  if (!res.ok) return {};
  const rows = parseCsv(await res.text());

  const byGame = {};
  for (const r of rows) {
    const gid = String(r.game_id || "").trim();
    if (!wanted.has(gid)) continue;
    const team = String(r.team || "").trim();
    (byGame[gid] ||= {})[team] = r;
  }

  const out = {};
  for (const gid of gameIds) {
    const pair = awayHomeAbbrFromGameId(gid);
    const rowsForGame = byGame[gid];
    if (!pair || !rowsForGame) continue;
    const awayRow = rowsForGame[pair.awayAbbr];
    const homeRow = rowsForGame[pair.homeAbbr];
    if (!awayRow || !homeRow) continue; // not published yet, or abbr mismatch -- retry next run

    const awayPassing = toNum(awayRow.passing_yards);
    const homePassing = toNum(homeRow.passing_yards);
    const awayRushing = toNum(awayRow.rushing_yards);
    const homeRushing = toNum(homeRow.rushing_yards);
    if ([awayPassing, homePassing, awayRushing, homeRushing].some((v) => v === null)) continue;

    out[gid] = {
      awayPassing,
      homePassing,
      awayRushing,
      homeRushing,
      passingWinner: awayPassing === homePassing ? "PUSH" : awayPassing > homePassing ? "AWAY" : "HOME",
      rushingWinner: awayRushing === homeRushing ? "PUSH" : awayRushing > homeRushing ? "AWAY" : "HOME",
    };
  }
  return out;
}

// No auth check here on purpose: this function is invoked automatically every
// 2 minutes by the schedule in netlify.toml, and Netlify's scheduler has no
// way to supply a PIN/token (a static ADMIN_PIN check here previously made
// every scheduled run fail with 401, silently, forever). That's an acceptable
// tradeoff because this only recomputes the leaderboard from public game
// scores -- it can't corrupt picks, expose private data, or do anything a
// participant couldn't already see by refreshing the Leaderboard page.
export default async (req) => {
  try {
    const url = new URL(req.url);

    const seasonParam = url.searchParams.get("season");
    const weekParam = url.searchParams.get("week");

    if (!process.env.SUPABASE_URL) return json(500, { ok: false, error: "Missing SUPABASE_URL on server env." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server env." });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1) Determine season/week: explicit params > weeks.is_current
    let season = seasonParam ? Number(seasonParam) : null;
    let week = weekParam ? Number(weekParam) : null;

    if (!season || !week) {
      const { data: current, error: curErr } = await admin
        .from("weeks")
        .select("season, week")
        .eq("is_current", true)
        .limit(1)
        .maybeSingle();

      if (curErr) throw curErr;
      if (!current?.season || !current?.week) {
        return json(200, { ok: true, warning: "No current week set (weeks.is_current=true not found)." });
      }
      season = Number(current.season);
      week = Number(current.week);
    }

    // 2) Pull FINALs from *your* game_results first (simulation writes here)
    const { data: finals, error: finalsErr } = await admin
      .from("game_results")
      .select("game_id, status, home_score, away_score, passing_winner, rushing_winner")
      .eq("season", season)
      .eq("week", week)
      .eq("status", "FINAL");

    if (finalsErr) throw finalsErr;

    // If none found, fall back to nflverse CSV finals (real season use)
    let finalRows = finals || [];
    let source = "game_results";

    if (finalRows.length === 0) {
      const csvRes = await fetch(CSV_URL, { headers: { "User-Agent": "netlify-function" } });
      if (!csvRes.ok) return json(500, { ok: false, error: `Failed to fetch games.csv (${csvRes.status})` });

      const text = await csvRes.text();
      const rows = parseCsv(text);

      const filtered = rows.filter((r) => {
        const rSeason = Number(r.season);
        const rWeek = Number(r.week);
        const isREG = String(r.game_type || "").toUpperCase() === "REG";
        return rSeason === season && rWeek === week && isREG;
      });

      const finalsFromCsv = [];
      for (const r of filtered) {
        const gameId = String(r.game_id || "").trim();
        if (!gameId) continue;

        const awayScore = toInt(r.away_score);
        const homeScore = toInt(r.home_score);
        if (awayScore === null || homeScore === null) continue;

        finalsFromCsv.push({
          game_id: gameId,
          status: "FINAL",
          away_score: awayScore,
          home_score: homeScore,
        });
      }

      finalRows = finalsFromCsv;
      source = "nflverse_csv";

      // Also upsert into game_results so the rest of the system is consistent
      if (finalRows.length > 0) {
        const upRows = finalRows.map((x) => ({
          season,
          week,
          game_id: x.game_id,
          status: "FINAL",
          away_score: x.away_score,
          home_score: x.home_score,
          updated_at: new Date().toISOString(),
        }));
        const { error: upErr } = await admin.from("game_results").upsert(upRows, { onConflict: "season,week,game_id" });
        if (upErr) throw upErr;
      }
    }

    if (finalRows.length === 0) {
      return json(200, { ok: true, season, week, finals: 0, message: "No FINAL games yet." });
    }

    // 3) Build winnerByGame as TEAM NAME (matches your picks UI)
    // picks are storing actual team names (e.g. "Carolina Panthers"), not "HOME/AWAY"
    const { data: games, error: gamesErr } = await admin
      .from("games")
      .select("id, away, home")
      .eq("season", season)
      .eq("week", week)
      .in("id", finalRows.map((x) => x.game_id));

    if (gamesErr) throw gamesErr;

    const gameMap = {};
    for (const g of games || []) gameMap[g.id] = g;

    const winnerByGame = {}; // team NAME (legacy picks compare against this)
    const winnerSideByGame = {}; // AWAY/HOME/TIE (current picks compare against this)
    const finalGameIds = [];

    for (const f of finalRows) {
      const gid = f.game_id;
      const g = gameMap[gid];
      if (!g) continue;

      const awayName = String(g.away || "").trim();
      const homeName = String(g.home || "").trim();

      const awayScore = Number(f.away_score);
      const homeScore = Number(f.home_score);

      let winnerName = "TIE";
      let winnerSide = "TIE";
      if (homeScore > awayScore) { winnerName = homeName; winnerSide = "HOME"; }
      else if (awayScore > homeScore) { winnerName = awayName; winnerSide = "AWAY"; }

      winnerByGame[gid] = winnerName;
      winnerSideByGame[gid] = winnerSide;
      finalGameIds.push(gid);
    }

    if (finalGameIds.length === 0) {
      return json(200, { ok: true, season, week, finals: 0, message: "FINAL rows found but no matching games rows." });
    }

    // 4) Load picks (NOTE: your picks table is week-only; also picks are team names)
    const { data: picks, error: picksErr } = await admin
      .from("picks")
      .select("user_name, game_id, pick")
      .eq("week", week)
      .in("game_id", finalGameIds);

    if (picksErr) throw picksErr;

    // 5) Score: 1 point per correct pick. Picks are stored as AWAY/HOME/TIE
    // (see App.jsx's submitEmail), but this fell back to comparing against a
    // literal team name -- a stale assumption from before the app switched to
    // AWAY/HOME, which meant this always scored 0 correct for every current
    // pick. Support both, same as recalcLeaderboard.js.
    const totals = {}; // user -> { points, correct }
    for (const p of picks || []) {
      const name = String(p.user_name || "").trim();
      const gid = p.game_id;
      const pickRaw = String(p.pick || "").trim();
      const pickUpper = pickRaw.toUpperCase();

      if (!name || !gid || !pickRaw) continue;

      const winnerSide = winnerSideByGame[gid];
      if (!winnerSide) continue;

      let correct = false;
      if (pickUpper === "AWAY" || pickUpper === "HOME" || pickUpper === "TIE") {
        correct = pickUpper === winnerSide;
      } else {
        // Legacy case: pick stored as a literal team name
        correct = pickRaw.toLowerCase() === String(winnerByGame[gid] || "").toLowerCase();
      }

      if (!totals[name]) totals[name] = { points: 0, correct: 0 };
      if (correct) {
        totals[name].points += 1;
        totals[name].correct += 1;
      }
    }

    // 5b) Fetch + merge passing/rushing bonus stats for any FINAL game that
    // doesn't have them yet, then score bonus_picks (+0.5 per category per
    // correct pick, push on an exact tie). Kept in sync with recalcLeaderboard.js.
    const needBonusGameIds = finalRows
      .filter((f) => f.passing_winner == null || f.rushing_winner == null)
      .map((f) => f.game_id);

    const bonusStatsByGame = needBonusGameIds.length
      ? await fetchBonusStatsByGame(season, needBonusGameIds)
      : {};

    const bonusUpsertRows = Object.entries(bonusStatsByGame).map(([gid, s]) => ({
      season,
      week,
      game_id: gid,
      away_passing_yards: s.awayPassing,
      home_passing_yards: s.homePassing,
      away_rushing_yards: s.awayRushing,
      home_rushing_yards: s.homeRushing,
      passing_winner: s.passingWinner,
      rushing_winner: s.rushingWinner,
      updated_at: new Date().toISOString(),
    }));
    if (bonusUpsertRows.length > 0) {
      const { error: bonusUpErr } = await admin
        .from("game_results")
        .upsert(bonusUpsertRows, { onConflict: "season,week,game_id" });
      if (bonusUpErr) throw bonusUpErr;
    }

    const passingWinnerByGame = {};
    const rushingWinnerByGame = {};
    for (const f of finalRows) {
      const pw = String(f.passing_winner || "").toUpperCase();
      const rw = String(f.rushing_winner || "").toUpperCase();
      if (pw === "AWAY" || pw === "HOME") passingWinnerByGame[f.game_id] = pw;
      if (rw === "AWAY" || rw === "HOME") rushingWinnerByGame[f.game_id] = rw;
    }
    for (const [gid, s] of Object.entries(bonusStatsByGame)) {
      if (s.passingWinner === "AWAY" || s.passingWinner === "HOME") passingWinnerByGame[gid] = s.passingWinner;
      if (s.rushingWinner === "AWAY" || s.rushingWinner === "HOME") rushingWinnerByGame[gid] = s.rushingWinner;
    }

    const { data: bonusPicksRows, error: bonusPicksErr } = await admin
      .from("bonus_picks")
      .select("user_name, game_id, category, pick")
      .eq("week", week)
      .in("game_id", finalGameIds);
    if (bonusPicksErr) throw bonusPicksErr;

    for (const bp of bonusPicksRows || []) {
      const name = String(bp.user_name || "").trim();
      const gid = bp.game_id;
      if (!name || !gid) continue;

      const pickUpper = String(bp.pick || "").trim().toUpperCase();
      if (pickUpper !== "AWAY" && pickUpper !== "HOME") continue;

      const winnerSide =
        bp.category === "passing_yards" ? passingWinnerByGame[gid] :
        bp.category === "rushing_yards" ? rushingWinnerByGame[gid] : null;
      if (!winnerSide) continue; // not FINAL/published yet, or a push

      if (!totals[name]) totals[name] = { points: 0, correct: 0 };
      if (pickUpper === winnerSide) totals[name].points += 0.5;
    }

    const lbRows = Object.entries(totals).map(([user_name, t]) => ({
      season,
      week,
      user_name,
      points: t.points,
      correct_picks: t.correct,
      games_final_count: finalGameIds.length,
      updated_at: new Date().toISOString(),
    }));

    if (lbRows.length > 0) {
      const { error: lbErr } = await admin
        .from("leaderboard")
        .upsert(lbRows, { onConflict: "season,week,user_name" });

      if (lbErr) throw lbErr;
    }

    return json(200, {
      ok: true,
      season,
      week,
      finals: finalGameIds.length,
      leaderboard_rows: lbRows.length,
      source,
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

function toInt(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Simple CSV parser (same style you already use)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cols[j];
    out.push(row);
  }
  return out;
}

function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}