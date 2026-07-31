// netlify/functions/getweek.js
const { createClient } = require("@supabase/supabase-js");

const RECORDS_CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

const TEAM_ABBR_TO_FULL = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens", BUF: "Buffalo Bills",
  CAR: "Carolina Panthers", CHI: "Chicago Bears", CIN: "Cincinnati Bengals", CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys", DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars", KC: "Kansas City Chiefs",
  LV: "Las Vegas Raiders", LA: "Los Angeles Rams", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams",
  MIA: "Miami Dolphins", MIN: "Minnesota Vikings", NE: "New England Patriots", NO: "New Orleans Saints",
  NYG: "New York Giants", NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks", SF: "San Francisco 49ers", STL: "Los Angeles Rams", TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans", WAS: "Washington Commanders",
};

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
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(cur); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// Team W-L(-T) records entering `week` (i.e. from every completed REG game in
// earlier weeks of the season), sourced directly from nflverse so it doesn't
// depend on our own game_results table ever being populated.
async function fetchTeamRecords(season, week) {
  const res = await fetch(RECORDS_CSV_URL, { headers: { "User-Agent": "netlify-function" } });
  if (!res.ok) return {};

  const rows = parseCsv(await res.text());
  const tally = {};
  const bump = (team, key) => {
    if (!tally[team]) tally[team] = { w: 0, l: 0, t: 0 };
    tally[team][key]++;
  };

  for (const r of rows) {
    if (Number(r.season) !== season) continue;
    if (r.game_type !== "REG") continue;
    if (Number(r.week) >= week) continue;

    const awayScore = r.away_score === "" ? null : Number(r.away_score);
    const homeScore = r.home_score === "" ? null : Number(r.home_score);
    if (awayScore === null || homeScore === null || Number.isNaN(awayScore) || Number.isNaN(homeScore)) continue;

    const away = TEAM_ABBR_TO_FULL[r.away_team] || r.away_team;
    const home = TEAM_ABBR_TO_FULL[r.home_team] || r.home_team;

    if (homeScore > awayScore) { bump(home, "w"); bump(away, "l"); }
    else if (awayScore > homeScore) { bump(away, "w"); bump(home, "l"); }
    else { bump(home, "t"); bump(away, "t"); }
  }

  const records = {};
  for (const [team, t] of Object.entries(tally)) {
    records[team] = t.t > 0 ? `${t.w}-${t.l}-${t.t}` : `${t.w}-${t.l}`;
  }
  return records;
}

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
      .select("id, season, week, away, home, kickoff, spread_line")
      .eq("season", season)
      .eq("week", week)
      .order("kickoff", { ascending: true });

    if (gamesErr) throw gamesErr;

    // 4) Team records entering this week (best-effort -- never fail the whole
    // request if nflverse is unreachable, just omit records).
    let records = {};
    try {
      records = await fetchTeamRecords(season, week);
    } catch (e) {
      console.error("fetchTeamRecords failed:", e);
    }

    const gamesWithRecords = (games || []).map((g) => {
      const line = g.spread_line === null || g.spread_line === undefined ? null : Number(g.spread_line);
      return {
        ...g,
        awayRecord: records[g.away] || null,
        homeRecord: records[g.home] || null,
        // spread_line is the home team's number (negative = home favored)
        awaySpread: formatSpread(line === null ? null : -line),
        homeSpread: formatSpread(line),
      };
    });

    return j(200, {
      ok: true,
      season,
      week,
      deadline, // ✅ now exposed
      byes,
      tiebreakers: (tiebreakers || []).slice(0, 3),
      games: gamesWithRecords,
    });
  } catch (e) {
    return j(500, { ok: false, error: String(e?.message || e) });
  }
};

function formatSpread(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  if (n === 0) return "PK";
  return n > 0 ? `+${n}` : `${n}`;
}

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}