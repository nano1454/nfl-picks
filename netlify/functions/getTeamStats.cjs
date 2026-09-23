// netlify/functions/getTeamStats.cjs
// Public (no admin token) -- powers the NFL Team Stats page. For every one
// of the 32 real NFL teams, at a given season/week: their W-L(-T) record
// entering that week (same "entering, not through" semantics already used
// for each matchup's awayRecord/homeRecord in getweek.cjs) plus that week's
// own offensive passing/rushing yards. No Supabase involved -- this is a
// pure read-through of nflverse's public CSVs, so it works for any
// season/week regardless of whether this app's own schedule has been
// imported for it yet.
//
// Small helpers below are duplicated from getweek.cjs/updateResults.js
// rather than required from them, matching this project's established
// convention of keeping each Netlify function's data logic self-contained.

const GAMES_CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
const STATS_CSV_URL = (season) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`;

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

function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

exports.handler = async (event) => {
  try {
    const season = Number(event.queryStringParameters?.season || "");
    const week = Number(event.queryStringParameters?.week || "");
    if (!season || !week) return j(400, { ok: false, error: "Missing season/week." });

    const gamesRes = await fetch(GAMES_CSV_URL, { headers: { "User-Agent": "netlify-function" } });
    if (!gamesRes.ok) return j(500, { ok: false, error: `Failed to fetch games.csv (${gamesRes.status})` });
    const gameRows = parseCsv(await gamesRes.text());

    // Records entering `week` (every completed REG game in earlier weeks),
    // and which teams actually have a game this week (for bye detection).
    const tally = {};
    for (const abbr of Object.keys(TEAM_ABBR_TO_FULL)) tally[abbr] = { w: 0, l: 0, t: 0 };
    const bump = (abbr, key) => {
      if (!tally[abbr]) tally[abbr] = { w: 0, l: 0, t: 0 };
      tally[abbr][key]++;
    };

    // Abbreviations actually used by THIS season's rows (some teams have
    // switched abbreviations historically -- e.g. the Rams as LA/LAR/STL --
    // so deriving the canonical abbr from the season's own data instead of
    // guessing avoids depending on which alias happens to be "current").
    const abbrsThisSeason = new Set();
    const gameIdThisWeekByAbbr = {};
    const opponentThisWeekByAbbr = {};
    for (const r of gameRows) {
      if (Number(r.season) !== season) continue;
      if (r.game_type !== "REG") continue;
      const rWeek = Number(r.week);

      abbrsThisSeason.add(r.away_team);
      abbrsThisSeason.add(r.home_team);

      if (rWeek === week) {
        gameIdThisWeekByAbbr[r.away_team] = r.game_id;
        gameIdThisWeekByAbbr[r.home_team] = r.game_id;
        opponentThisWeekByAbbr[r.away_team] = r.home_team;
        opponentThisWeekByAbbr[r.home_team] = r.away_team;
      }

      if (rWeek >= week) continue;

      const awayScore = r.away_score === "" ? null : Number(r.away_score);
      const homeScore = r.home_score === "" ? null : Number(r.home_score);
      if (awayScore === null || homeScore === null || Number.isNaN(awayScore) || Number.isNaN(homeScore)) continue;

      if (homeScore > awayScore) { bump(r.home_team, "w"); bump(r.away_team, "l"); }
      else if (awayScore > homeScore) { bump(r.away_team, "w"); bump(r.home_team, "l"); }
      else { bump(r.home_team, "t"); bump(r.away_team, "t"); }
    }

    // This week's offensive passing/rushing yards, keyed by team abbr. Best
    // effort -- this file is derived from play-by-play and typically isn't
    // published until a few hours after games go FINAL (same lag already
    // documented for the bonus-picks feature), and may not exist at all yet
    // for a season with no games played. Teams just show "pending" until then.
    let statsByAbbr = {};
    try {
      const statsRes = await fetch(STATS_CSV_URL(season), { headers: { "User-Agent": "netlify-function" } });
      if (statsRes.ok) {
        const statsRows = parseCsv(await statsRes.text());
        for (const r of statsRows) {
          if (Number(r.week) !== week) continue;
          const abbr = String(r.team || "").trim();
          if (!abbr) continue;
          statsByAbbr[abbr] = { passing_yards: toNum(r.passing_yards), rushing_yards: toNum(r.rushing_yards) };
        }
      }
    } catch {
      // leave statsByAbbr empty -- every team just shows as pending below
    }

    // One row per real team (32), keyed by whichever abbreviation this
    // season's own data actually uses -- resolves the LA/LAR/STL-style
    // historical-alias duplicates in TEAM_ABBR_TO_FULL automatically instead
    // of guessing which alias is "current."
    const abbrsToUse =
      abbrsThisSeason.size > 0 ? [...abbrsThisSeason].filter((a) => TEAM_ABBR_TO_FULL[a]) : Object.keys(TEAM_ABBR_TO_FULL);

    const teams = abbrsToUse
      .map((abbr) => [abbr, TEAM_ABBR_TO_FULL[abbr]])
      .map(([abbr, full]) => {
        const t = tally[abbr] || { w: 0, l: 0, t: 0 };
        const record = t.t > 0 ? `${t.w}-${t.l}-${t.t}` : `${t.w}-${t.l}`;
        const hasGame = !!gameIdThisWeekByAbbr[abbr];
        const stats = statsByAbbr[abbr];
        const passing_yards = stats?.passing_yards ?? null;
        const rushing_yards = stats?.rushing_yards ?? null;

        return {
          abbr,
          team: full,
          record,
          wins: t.w,
          total_yards: passing_yards !== null && rushing_yards !== null ? passing_yards + rushing_yards : null,
          opponent: opponentThisWeekByAbbr[abbr] || null,
          bye: !hasGame,
          passing_yards,
          rushing_yards,
          stats_pending: hasGame && !stats,
        };
      })
      // Most wins first, ties broken by most combined yards this week (byes
      // and teams still awaiting published stats sort last within their win
      // tier, then alphabetically as a final stable tiebreak).
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const ay = a.total_yards ?? -1;
        const by = b.total_yards ?? -1;
        if (by !== ay) return by - ay;
        return a.team.localeCompare(b.team);
      });

    return j(200, { ok: true, season, week, teams });
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
