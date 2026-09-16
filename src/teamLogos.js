// Shared team-logo map + helpers -- originally module-scoped only in
// Results.jsx, extracted so other pages (e.g. HallOfChampions/ChampionWeekDetail)
// needing the same logos don't duplicate the 32-team mapping.
export const teamLogoSlug = {
  "Arizona Cardinals": "cardinals",
  "Atlanta Falcons": "falcons",
  "Baltimore Ravens": "ravens",
  "Buffalo Bills": "bills",
  "Carolina Panthers": "panthers",
  "Chicago Bears": "bears",
  "Cincinnati Bengals": "bengals",
  "Cleveland Browns": "browns",
  "Dallas Cowboys": "cowboys",
  "Denver Broncos": "broncos",
  "Detroit Lions": "lions",
  "Green Bay Packers": "packers",
  "Houston Texans": "texans",
  "Indianapolis Colts": "colts",
  "Jacksonville Jaguars": "jaguars",
  "Kansas City Chiefs": "chiefs",
  "Las Vegas Raiders": "raiders",
  "Los Angeles Chargers": "chargers",
  "Los Angeles Rams": "rams",
  "Miami Dolphins": "dolphins",
  "Minnesota Vikings": "vikings",
  "New England Patriots": "patriots",
  "New Orleans Saints": "saints",
  "New York Giants": "giants",
  "New York Jets": "jets",
  "Philadelphia Eagles": "eagles",
  "Pittsburgh Steelers": "steelers",
  "San Francisco 49ers": "49ers",
  "Seattle Seahawks": "seahawks",
  "Tampa Bay Buccaneers": "buccaneers",
  "Tennessee Titans": "titans",
  "Washington Commanders": "commanders",
};

export function logoSrc(team) {
  const slug = teamLogoSlug[team];
  return slug ? `/logos/${slug}.png` : null;
}

export function fmtMatchup(g) {
  const away = String(g?.away || "").trim();
  const home = String(g?.home || "").trim();
  return away && home ? `${away} @ ${home}` : String(g?.id || "");
}

// Compact "AWAY@HOME" form using the team abbreviations already embedded in
// the game_id (nflverse convention: "{season}_{week}_{awayAbbr}_{homeAbbr}",
// e.g. "2026_01_DAL_TB" -> "DAL@TB") -- same TV-scoreboard-style codes this
// app's own data already uses, so no separate abbreviation map to maintain.
export function fmtMatchupAbbr(g) {
  const parts = String(g?.id || "").split("_");
  if (parts.length >= 4) {
    const awayAbbr = parts[parts.length - 2];
    const homeAbbr = parts[parts.length - 1];
    if (awayAbbr && homeAbbr) return `${awayAbbr}@${homeAbbr}`;
  }
  return fmtMatchup(g);
}
