import { createClient } from "@supabase/supabase-js";

/**
 * Netlify Function: /api/importSchedule?season=2025&week=1&pin=0287
 * Requires Netlify env vars:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - ADMIN_PIN
 */
export default async (req) => {
  try {
    const url = new URL(req.url);
    const season = Number(url.searchParams.get("season"));
    const week = Number(url.searchParams.get("week"));
    const pin = String(url.searchParams.get("pin") || "");

    if (!process.env.ADMIN_PIN) {
      return json(500, { ok: false, error: "Missing ADMIN_PIN on server env." });
    }
    if (pin !== String(process.env.ADMIN_PIN)) {
      return json(401, { ok: false, error: "Unauthorized (bad pin)." });
    }
    if (!season || !week) {
      return json(400, { ok: false, error: "Missing season/week." });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // nflverse schedule data is maintained by Lee Sharpe and distributed by nflverse/nflverse-data
    // We'll use the nfldata raw games.csv as a stable CSV source.
    const csvUrl = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
    const csvRes = await fetch(csvUrl, { headers: { "User-Agent": "netlify-function" } });
    if (!csvRes.ok) {
      return json(500, { ok: false, error: `Failed to fetch schedules CSV (${csvRes.status}).` });
    }
    const csvText = await csvRes.text();

    const rows = parseCsv(csvText);
    if (!rows.length) return json(500, { ok: false, error: "CSV parsed to 0 rows." });

    // nflverse uses team abbreviations; map to full names used by your UI
    const abbrToFull = TEAM_ABBR_TO_FULL;

    // Filter to regular season games for that season/week
    const filtered = rows.filter((r) => {
      const rSeason = Number(r.season);
      const rWeek = Number(r.week);
      const gt = String(r.game_type || "");
      return rSeason === season && rWeek === week && gt === "REG";
    });

    // Build week_games payload
    const games = filtered
      .map((r) => {
        const awayAbbr = String(r.away_team || "").trim();
        const homeAbbr = String(r.home_team || "").trim();

        const away = abbrToFull[awayAbbr] || awayAbbr || "Unknown";
        const home = abbrToFull[homeAbbr] || homeAbbr || "Unknown";

        return {
          season,
          week,
          game_id: String(r.game_id || "").trim(),
          game_type: "REG",
          away,
          home,
          kickoff: r.gameday ? new Date(r.gameday).toISOString() : null,
        };
      })
      .filter((g) => g.game_id);

    if (games.length === 0) {
      return json(404, { ok: false, error: "No REG games found for that season/week." });
    }

    // Upsert games
    const { error: upErr } = await supabase
      .from("week_games")
      .upsert(games, { onConflict: "season,week,game_id" });

    if (upErr) return json(500, { ok: false, error: upErr.message });

    // Choose default tiebreakers: first 3 games by CSV order
    const tb = games.slice(0, 3).map((g) => g.game_id);

    // Set current week (turn off previous current for this season)
    await supabase.from("weeks").update({ is_current: false }).eq("season", season);

    const { error: wkErr } = await supabase
      .from("weeks")
      .upsert(
        [
          {
            season,
            week,
            is_current: true,
            deadline: null,
            byes: [],
            tiebreakers: tb,
          },
        ],
        { onConflict: "season,week" }
      );

    if (wkErr) return json(500, { ok: false, error: wkErr.message });

    return json(200, { ok: true, season, week, imported_games: games.length, tiebreakers: tb });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

// Simple CSV parser that handles quotes
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

// Abbreviation -> Full names (matches your UI keys/teamLogoSlug)
const TEAM_ABBR_TO_FULL = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LV: "Las Vegas Raiders",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};
