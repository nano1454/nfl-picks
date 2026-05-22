// netlify/functions/importSchedule.cjs
const { createClient } = require("@supabase/supabase-js");

const CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

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
  LA: "Los Angeles Rams",
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
  STL: "Los Angeles Rams",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
  WSH: "Washington Commanders",
};

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminPin = process.env.ADMIN_PIN;

    if (!supabaseUrl) return json(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });
    if (!adminPin) return json(500, { ok: false, error: "Missing ADMIN_PIN." });

    const pin = String(event.queryStringParameters?.pin || "");
    const season = Number(event.queryStringParameters?.season);
    const week = Number(event.queryStringParameters?.week);

    if (pin !== String(adminPin)) return json(401, { ok: false, error: "Unauthorized (bad pin)." });
    if (!season || !week) return json(400, { ok: false, error: "Missing season/week." });

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Fetch NFLverse CSV
    const csvRes = await fetch(CSV_URL, { headers: { "User-Agent": "netlify-function" } });
    if (!csvRes.ok) return json(500, { ok: false, error: `Failed to fetch CSV (${csvRes.status}).` });

    const csvText = await csvRes.text();
    const rows = parseCsv(csvText);
    if (!rows.length) return json(500, { ok: false, error: "CSV parsed to 0 rows." });

    // 2) Filter to REG for season/week
    const filtered = rows.filter((r) => {
      const rSeason = Number(r.season);
      const rWeek = Number(r.week);
      const gt = String(r.game_type || "").toUpperCase();
      return rSeason === season && rWeek === week && gt === "REG";
    });

    // 3) Build games payload for your existing "games" table
    // Your getweek() function reads from "games" and "week_meta"
    const games = filtered
      .map((r) => {
        const awayAbbr = String(r.away_team || "").trim();
        const homeAbbr = String(r.home_team || "").trim();

        const away = TEAM_ABBR_TO_FULL[awayAbbr] || awayAbbr || "Unknown";
        const home = TEAM_ABBR_TO_FULL[homeAbbr] || homeAbbr || "Unknown";

        const id = String(r.game_id || "").trim();
        if (!id) return null;

        // kickoff: nflverse can have various date fields; gameday is usually present
        // If you later want exact kickoff time, we can upgrade to a datetime field from nflverse
        const kickoff = pickKickoffIso(r);

        return { id, season, week, away, home, kickoff };
      })
      .filter(Boolean);

    if (games.length === 0) return json(404, { ok: false, error: "No REG games found for that season/week." });

    // 4) Upsert games into "games"
    const { error: gamesErr } = await admin.from("games").upsert(games, { onConflict: "id" });
    if (gamesErr) return json(500, { ok: false, error: `games upsert: ${gamesErr.message}` });

    // 5) Assign TBs: last Thursday game (TB1), last Sunday game (TB2), last Monday game (TB3)
    //    Falls back to games[0/1/2] (sorted by kickoff) when that day has no games.
    const sortedGames = [...games].sort((a, b) => {
      const aTime = a.kickoff ? new Date(a.kickoff).getTime() : 0;
      const bTime = b.kickoff ? new Date(b.kickoff).getTime() : 0;
      return aTime - bTime;
    });

    // Build weekday map from raw CSV rows (nflverse "weekday" field, or derived from "gameday")
    const weekdayById = {};
    for (const r of filtered) {
      const id = String(r.game_id || "").trim();
      if (!id) continue;
      let day = String(r.weekday || "").trim();
      if (!day && r.gameday) {
        const d = new Date(String(r.gameday));
        if (!Number.isNaN(d.getTime())) {
          day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
        }
      }
      if (day) weekdayById[id] = day;
    }

    function lastOnDay(dayName) {
      const matches = sortedGames.filter(
        (g) => (weekdayById[g.id] || "").toLowerCase() === dayName.toLowerCase()
      );
      return matches.length > 0 ? matches[matches.length - 1].id : null;
    }

    const tb1 = lastOnDay("Thursday") ?? sortedGames[0]?.id ?? null;
    const tb2 = lastOnDay("Sunday")   ?? sortedGames[1]?.id ?? null;
    const tb3 = lastOnDay("Monday")   ?? sortedGames[2]?.id ?? null;

    const tiebreakers = [tb1, tb2, tb3].filter(Boolean);

    // 6) Week meta (tiebreakers/byes/deadline)
    const { error: metaErr } = await admin
      .from("week_meta")
      .upsert(
        [
          {
            season,
            week,
            tiebreakers,
            byes: [],
            deadline: null,
          },
        ],
        { onConflict: "season,week" }
      );
    if (metaErr) return json(500, { ok: false, error: `week_meta upsert: ${metaErr.message}` });

    // 7) ✅ SET CURRENT WEEK AUTOMATICALLY
    // Turn off any previous current week for this season
    const { error: offErr } = await admin.from("weeks").update({ is_current: false }).eq("season", season);
    if (offErr) return json(500, { ok: false, error: `weeks clear current: ${offErr.message}` });

    // Upsert the current week row
    const { error: wkErr } = await admin
      .from("weeks")
      .upsert(
        [
          {
            season,
            week,
            is_current: true,
            deadline: null,
            byes: [],
            tiebreakers,
          },
        ],
        { onConflict: "season,week" }
      );
    if (wkErr) return json(500, { ok: false, error: `weeks upsert current: ${wkErr.message}` });

    return json(200, { ok: true, season, week, imported_games: games.length, tiebreakers });
  } catch (e) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
};

function pickKickoffIso(r) {
  // 1) Try explicit UTC fields first (future-proofing)
  for (const c of [r.start_time_utc, r.start_time, r.game_datetime]) {
    if (!c) continue;
    const d = new Date(String(c));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // 2) Best source: gameday (YYYY-MM-DD) + gametime (HH:MM Eastern Time)
  if (r.gameday && r.gametime) {
    const iso = easternToUtcIso(String(r.gameday).trim(), String(r.gametime).trim());
    if (iso) return iso;
  }

  // 3) Last resort: gameday only (midnight UTC — avoid if gametime is available)
  if (r.gameday) {
    const d = new Date(String(r.gameday));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

// Convert a gameday (YYYY-MM-DD) + gametime (HH:MM, US Eastern) to UTC ISO string.
// Handles EDT (-04:00) and EST (-05:00) automatically via Intl.
function easternToUtcIso(gameday, gametime) {
  try {
    const [hStr, mStr] = gametime.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || "0", 10);
    if (isNaN(h) || isNaN(m)) return null;

    const pad2 = (n) => String(n).padStart(2, "0");

    // Try EDT (-04:00) then EST (-05:00); pick whichever gives the matching NY hour
    for (const offset of ["-04:00", "-05:00"]) {
      const candidate = new Date(`${gameday}T${pad2(h)}:${pad2(m)}:00${offset}`);
      if (isNaN(candidate.getTime())) continue;

      const nyHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          hour12: false,
        }).format(candidate),
        10
      );

      if (nyHour === h) return candidate.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

// Simple CSV parser
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
