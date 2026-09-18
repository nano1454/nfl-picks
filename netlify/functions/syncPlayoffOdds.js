// Playoffs pool (weeks 19-22): keeps games.underdog_side in sync with real
// moneylines from the same nflverse feed already used for the schedule, up
// until each game locks (1hr before kickoff), then leaves it frozen -- that
// frozen value is what scoring uses. Runs on a schedule (see netlify.toml)
// and can also be triggered manually from Admin.
//
// Playoffs structure is fixed/hardcoded deliberately (see src/playoffsConfig.js
// for why); ESM functions in this project can't require() a .cjs helper (see
// the existing comment on that in recalcLeaderboard.js), so this is its own
// duplicated copy of the small round-points table, same as
// updateResults.js/recalcLeaderboard.js/importSchedule.cjs each keep.
const PLAYOFFS_FIRST_WEEK = 19;
const PLAYOFFS_LAST_WEEK = 22;
const ROUND_GAME_TYPE = { 19: "WC", 20: "DIV", 21: "CON", 22: "SB" };
function isPlayoffWeek(week) {
  return week >= PLAYOFFS_FIRST_WEEK && week <= PLAYOFFS_LAST_WEEK;
}

const CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  try {
    if (!process.env.SUPABASE_URL) return json(500, { ok: false, error: "Missing SUPABASE_URL on server env." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server env." });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const seasonParam = url.searchParams.get("season");
    const weekParam = url.searchParams.get("week");

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
      season = current?.season ?? null;
      week = current?.week ?? null;
    }

    // Primary safety gate: this function is a complete no-op for anything
    // other than an actual playoff week, checked before any other logic
    // (including before the CSV fetch) -- regular season is never touched.
    if (!season || !week || !isPlayoffWeek(week)) {
      return json(200, { ok: true, skipped: true, reason: "Current week is not a playoff round.", season, week });
    }

    const { data: games, error: gamesErr } = await admin
      .from("games")
      .select("id, away, home, kickoff, underdog_side")
      .eq("season", season)
      .eq("week", week);
    if (gamesErr) throw gamesErr;
    if (!games || games.length === 0) {
      return json(200, { ok: true, season, week, updated: 0, message: "No games imported for this round yet." });
    }

    const nowMs = Date.now();
    const unlockedGames = games.filter((g) => {
      if (!g.kickoff) return true; // no kickoff yet -- treat as not locked
      const kickoffMs = new Date(g.kickoff).getTime();
      return !Number.isFinite(kickoffMs) || nowMs < kickoffMs - 60 * 60 * 1000;
    });
    if (unlockedGames.length === 0) {
      return json(200, { ok: true, season, week, updated: 0, message: "All games this round are already locked." });
    }

    const csvRes = await fetch(CSV_URL, { headers: { "User-Agent": "netlify-function" } });
    if (!csvRes.ok) return json(500, { ok: false, error: `Failed to fetch games.csv (${csvRes.status})` });
    const rows = parseCsv(await csvRes.text());

    const gameType = ROUND_GAME_TYPE[week];
    const oddsByGameId = {};
    for (const r of rows) {
      if (Number(r.season) !== season || String(r.game_type || "").toUpperCase() !== gameType) continue;
      const id = String(r.game_id || "").trim();
      if (!id) continue;
      const awayML = toNum(r.away_moneyline);
      const homeML = toNum(r.home_moneyline);
      if (awayML === null || homeML === null) continue;
      oddsByGameId[id] = awayML > homeML ? "AWAY" : "HOME";
    }

    const updates = [];
    for (const g of unlockedGames) {
      const derived = oddsByGameId[g.id];
      if (!derived) continue; // odds not published yet for this game -- retry next run
      if (derived !== g.underdog_side) {
        updates.push({ id: g.id, underdog_side: derived, underdog_side_updated_at: new Date().toISOString() });
      }
    }

    for (const u of updates) {
      const { error: upErr } = await admin
        .from("games")
        .update({ underdog_side: u.underdog_side, underdog_side_updated_at: u.underdog_side_updated_at })
        .eq("id", u.id);
      if (upErr) throw upErr;
    }

    return json(200, { ok: true, season, week, checked: unlockedGames.length, updated: updates.length, changes: updates });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};

function toNum(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Simple CSV parser (same style already used by updateResults.js / importSchedule.cjs)
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
