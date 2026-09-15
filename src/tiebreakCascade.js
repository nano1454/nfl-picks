// Shared TB1 -> TB2 -> TB3 -> season-points -> split cascade for breaking a
// tie-for-1st. Used by both Leaderboard.jsx's live "Tiebreak Watch" panel and
// HallOfChampions.jsx's weekly-champion determination, so the two can never
// disagree about who won/is winning a tied week. Pure functions -- callers
// fetch whatever data they need (a live query for the current week, or
// already-batched in-memory rows for a full season) and pass it in.

// Evaluates one TB round for the given set of still-tied users.
// - guessByUser: { [user_name]: { 1: num|null, 2: num|null, 3: num|null } }
// - result: { status, home_score, away_score } | undefined, for this game
// - revealGuesses: whether raw guesses should be included in the returned
//   rows (Leaderboard.jsx hides them pre-lock; a week Hall of Champions
//   evaluates is always already fully FINAL, so it always passes true)
export function evaluateTBRound({ tbNo, gameId, currentUsers, guessByUser, result, revealGuesses }) {
  const isFinal = String(result?.status || "").toUpperCase() === "FINAL";
  const hs = isFinal ? Number(result?.home_score) : null;
  const as = isFinal ? Number(result?.away_score) : null;
  const actual = isFinal && Number.isFinite(hs) && Number.isFinite(as) ? hs + as : null;

  const rows = currentUsers.map((u) => {
    const guess = guessByUser?.[u]?.[tbNo];
    const hasGuess = Number.isFinite(guess);
    const busted = actual === null ? null : hasGuess ? guess > actual : null;
    const eligible = actual === null ? false : hasGuess ? guess <= actual : false;
    const diff = actual === null ? null : eligible ? actual - guess : null;

    return {
      user_name: u,
      guess: revealGuesses && hasGuess ? guess : null,
      hidden: !revealGuesses && hasGuess,
      eligible,
      busted: !!busted,
      diff,
    };
  });

  if (actual === null) {
    return { tbNo, gameId, isFinal: false, actual: null, rows, status: "PENDING_FINAL", bestUsers: currentUsers };
  }

  const eligibleRows = rows.filter((x) => x.eligible);
  if (eligibleRows.length === 0) {
    return { tbNo, gameId, isFinal: true, actual, rows, status: "NO_ELIGIBLE_ALL_BUSTED", bestUsers: currentUsers };
  }

  const bestDiff = Math.min(...eligibleRows.map((x) => x.diff));
  const bestUsers = eligibleRows.filter((x) => x.diff === bestDiff).map((x) => x.user_name);

  return {
    tbNo,
    gameId,
    isFinal: true,
    actual,
    rows,
    status: bestUsers.length === 1 ? "DECIDED" : "TIED_CONTINUE",
    bestDiff,
    bestUsers,
  };
}

// Runs the full TB1 -> TB2 -> TB3 -> season-points -> split cascade for a
// tied-for-1st group. Returns { decidedBy, winners, perTB, seasonTotals }.
// - tbGameIds: exactly 3 game ids, in TB1/TB2/TB3 order
// - resultByGame: { [gameId]: { status, home_score, away_score } }
// - guessByUser: { [user_name]: { 1, 2, 3 } }
// - seasonPointsByUser: { [user_name]: number } -- each tied user's total
//   points for the season through (and including) the week being resolved;
//   only consulted if still tied after all 3 TB rounds are FINAL
// - revealGuesses: boolean (uniform for all 3 rounds) or (gameId) => boolean
//   (per-round, e.g. gated on that specific game's own lock time)
export function resolveCascade({ tiedUsers, tbGameIds, resultByGame, guessByUser, seasonPointsByUser, revealGuesses = true }) {
  if (!Array.isArray(tiedUsers) || tiedUsers.length <= 1) {
    return { decidedBy: null, winners: tiedUsers || [], perTB: [], seasonTotals: null };
  }
  if (!Array.isArray(tbGameIds) || tbGameIds.length < 3) {
    return {
      decidedBy: "ERROR",
      winners: tiedUsers,
      perTB: [],
      seasonTotals: null,
      error: "tbGameIds missing/invalid (need 3 game_ids).",
    };
  }

  let remaining = [...tiedUsers];
  const perTB = [];
  let decidedBy = "PENDING";
  let winners = remaining;

  for (let i = 0; i < 3; i++) {
    const tbNo = i + 1;
    const gid = tbGameIds[i];
    // Each TB round has its own game, so its lock time (and thus whether
    // guesses are safe to reveal) can genuinely differ round to round --
    // revealGuesses may be a plain boolean (uniform) or a per-game function.
    const reveal = typeof revealGuesses === "function" ? !!revealGuesses(gid) : !!revealGuesses;
    const res = evaluateTBRound({
      tbNo,
      gameId: gid,
      currentUsers: remaining,
      guessByUser,
      result: resultByGame?.[String(gid)],
      revealGuesses: reveal,
    });
    perTB.push(res);

    if (res.status === "PENDING_FINAL") {
      decidedBy = "PENDING";
      winners = remaining;
      break;
    }
    if (res.status === "DECIDED") {
      decidedBy = `TB${tbNo}`;
      winners = res.bestUsers;
      break;
    }
    if (res.status === "TIED_CONTINUE") {
      remaining = res.bestUsers;
      winners = remaining;
      continue;
    }
    // NO_ELIGIBLE_ALL_BUSTED -- everyone in the current group busted this
    // round; the group carries over unchanged into the next TB round.
  }

  // Gated on allTBFinal (all 3 rounds genuinely evaluated as FINAL), not on
  // decidedBy still being "PENDING" -- a group that's still tied after all
  // 3 real tiebreakers never actually reassigns decidedBy away from its
  // "PENDING" initial value (that only happens in the DECIDED/PENDING_FINAL
  // branches above), so gating on decidedBy here would incorrectly report
  // "still pending a future game" forever instead of falling through to the
  // season-points tiebreak. allTBFinal alone is both necessary and
  // sufficient: it's only true when the loop ran all 3 iterations without
  // an early break, which only happens when every round was FINAL.
  const allTBFinal = perTB.length === 3 && perTB.every((x) => x.isFinal);
  if (allTBFinal && winners.length > 1 && seasonPointsByUser) {
    const seasonTotals = {};
    for (const u of winners) seasonTotals[u] = Number(seasonPointsByUser[u] || 0);

    const maxSeasonPts = Math.max(...Object.values(seasonTotals));
    const bestSeason = winners.filter((u) => seasonTotals[u] === maxSeasonPts);

    decidedBy = bestSeason.length === 1 ? "SEASON_POINTS" : "SPLIT";
    winners = bestSeason;
    return { decidedBy, winners, perTB, seasonTotals };
  }

  return { decidedBy, winners, perTB, seasonTotals: null };
}

// One-week champion resolution: finds who's tied for that week's max points,
// then runs resolveCascade if more than one person is tied. Shared by
// HallOfChampions.jsx (looping over every week) and ChampionWeekDetail.jsx
// (a single week), so both agree on the same result for the same week.
// - weekLeaderboardRows: leaderboard rows for exactly this one week
//   ({ user_name, points, correct_picks })
// - guessRows: tiebreakers rows for this week (any user -- filtered to the
//   tied set internally)
export function resolveWeekChampion({ weekLeaderboardRows, tbGameIds, resultByGame, guessRows, seasonPointsByUser }) {
  const rows = weekLeaderboardRows || [];
  if (rows.length === 0) return null;

  const maxPoints = Math.max(...rows.map((r) => Number(r.points || 0)));
  const tiedUsers = rows.filter((r) => Number(r.points || 0) === maxPoints).map((r) => r.user_name);
  const correctPicksByUser = {};
  for (const r of rows) correctPicksByUser[r.user_name] = r.correct_picks;

  if (tiedUsers.length <= 1) {
    return { winners: tiedUsers, points: maxPoints, decidedBy: "OUTRIGHT", tiedUsers, correctPicksByUser, perTB: [] };
  }

  const guessByUser = {};
  for (const u of tiedUsers) guessByUser[u] = { 1: null, 2: null, 3: null };
  for (const g of guessRows || []) {
    const u = String(g.user_name || "").trim();
    if (!guessByUser[u]) continue;
    const n = Number(g.tb_no);
    if (![1, 2, 3].includes(n)) continue;
    const val = g.total === null || g.total === undefined ? null : Number(g.total);
    guessByUser[u][n] = Number.isFinite(val) ? val : null;
  }

  const { decidedBy, winners, perTB } = resolveCascade({
    tiedUsers,
    tbGameIds,
    resultByGame,
    guessByUser,
    seasonPointsByUser,
    revealGuesses: true,
  });

  return { winners, points: maxPoints, decidedBy, tiedUsers, correctPicksByUser, perTB };
}
