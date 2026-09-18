// Shared, fixed playoffs-pool structure -- weeks 19-22, one round each.
// Hardcoded deliberately (not admin-configurable): the structure is fixed
// and identical every year, confirmed with Adrian. This is the single
// frontend source of truth for point values/round names, mirrored (not
// imported, see backend files' own comments on why) by the equivalent
// constants duplicated in updateResults.js/recalcLeaderboard.js/
// importSchedule.cjs/syncPlayoffOdds.js.
//
// Regular season (week <= 18) never reads from this file -- every call site
// that uses it is reached only via an explicit `week >= 19` branch.

export const PLAYOFFS_FIRST_WEEK = 19;
export const PLAYOFFS_LAST_WEEK = 22;

export const ROUND_NAMES = {
  19: "Wild Card Round",
  20: "Divisional Round",
  21: "Conference Championships",
  22: "Super Bowl",
};

// [base points if you picked the favorite, bonus points if you picked the
// underdog] -- favorite/underdog set automatically from real moneylines,
// see game.underdog_side.
export const ROUND_POINTS = {
  19: [1.0, 1.1],
  20: [3.0, 3.3],
  21: [7.0, 7.7],
  22: [8.0, 8.8],
};

export function isPlayoffWeek(week) {
  const w = Number(week);
  return w >= PLAYOFFS_FIRST_WEEK && w <= PLAYOFFS_LAST_WEEK;
}

export function roundNameForWeek(week) {
  return ROUND_NAMES[Number(week)] || `Week ${week}`;
}

// Points for a correct pick on this game, given which side (AWAY/HOME) was
// picked. Regular season (week < 19) always returns 1.
export function pointsForPick(week, game, pickSide) {
  if (!isPlayoffWeek(week)) return 1;
  const round = ROUND_POINTS[Number(week)];
  if (!round) return 1;
  const [base, underdogBonus] = round;
  const underdogSide = String(game?.underdog_side || "").toUpperCase();
  return pickSide && underdogSide && pickSide === underdogSide ? underdogBonus : base;
}

// Max points a single FINAL game is worth this round (the underdog value,
// since that's the ceiling) -- used for the Leaderboard's "% of points
// available" math.
export function maxPointsForRound(week) {
  const round = ROUND_POINTS[Number(week)];
  return round ? round[1] : 0;
}
