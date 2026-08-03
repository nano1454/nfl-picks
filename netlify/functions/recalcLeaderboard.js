import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * /.netlify/functions/recalcLeaderboard?season=2025&week=10&token=<adminToken>
 *
 * Computes leaderboard rows using:
 * - game_results.winner  ("AWAY" | "HOME" | "TIE")
 * - picks.pick           ("AWAY" | "HOME" | "TIE")  (and supports legacy team-string picks)
 *
 * Tie-break (only when 1st place is tied):
 * TB1 -> TB2 -> TB3:
 * - actual = home_score + away_score (must be FINAL)
 * - eligible if guess <= actual
 * - winner = closest (min diff = actual - guess)
 * - if nobody eligible -> move to next TB
 * - if still tied after TB3 -> fall back to season accumulated points
 * - if still tied -> split
 *
 * Env required:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - ADMIN_SESSION_SECRET
 */

// Kept in sync with netlify/functions/_adminAuth.cjs's requireAdmin -- this
// function uses Netlify's ESM/V2 handler style so it can't require() that
// CommonJS helper, hence the small duplicated copy here.
async function verifyAdminToken(admin, token) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return null;

  let username, issuedAtStr, sig;
  try {
    const decoded = Buffer.from(String(token), "base64url").toString("utf8");
    [username, issuedAtStr, sig] = decoded.split("|");
  } catch {
    return null;
  }
  if (!username || !issuedAtStr || !sig) return null;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > 24 * 60 * 60 * 1000) return null;

  const expected = crypto.createHmac("sha256", secret).update(`${username}|${issuedAt}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const { data, error } = await admin.from("app_users").select("username, is_admin").ilike("username", username).maybeSingle();
  if (error || !data || !data.is_admin) return null;
  return { username: data.username };
}

export default async (req) => {
  try {
    const url = new URL(req.url);

    const token = String(url.searchParams.get("token") || "");
    const season = Number(url.searchParams.get("season") || "");
    const week = Number(url.searchParams.get("week") || "");

    if (!process.env.ADMIN_SESSION_SECRET)
      return j(500, { ok: false, error: "Missing ADMIN_SESSION_SECRET on server env." });
    if (!process.env.SUPABASE_URL) return j(500, { ok: false, error: "Missing SUPABASE_URL on server env." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server env." });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!(await verifyAdminToken(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!season || !week) return j(400, { ok: false, error: "Missing season/week." });

    // 1) Get FINAL results for this week
    const { data: finals, error: finalsErr } = await admin
      .from("game_results")
      .select("game_id, winner, status, home_score, away_score")
      .eq("season", season)
      .eq("week", week)
      .eq("status", "FINAL");

    if (finalsErr) throw finalsErr;

    if (!finals || finals.length === 0) {
      return j(200, { ok: true, season, week, finals: 0, leaderboard_rows: 0, message: "No FINAL games yet." });
    }

    const finalGameIds = finals.map((f) => String(f.game_id)).filter(Boolean);

    // 2) Load games (for legacy pick support if pick stored as team name, and
    //    spread_line for scoring beat-the-spread bonus picks)
    const { data: games, error: gamesErr } = await admin
      .from("games")
      .select("id, away, home, spread_line")
      .eq("season", season)
      .eq("week", week)
      .in("id", finalGameIds);

    if (gamesErr) throw gamesErr;

    const gameById = {};
    for (const g of games || []) gameById[String(g.id)] = g;

    // 3) Load picks (try with season column; fallback if your picks table has no season)
    let picks = [];
    {
      const q1 = await admin.from("picks").select("user_name, game_id, pick").eq("week", week).eq("season", season);
      if (!q1.error) {
        picks = q1.data || [];
      } else {
        const q2 = await admin.from("picks").select("user_name, game_id, pick").eq("week", week);
        if (q2.error) throw q2.error;
        picks = q2.data || [];
      }
    }

    // 4) Winner map
    const winnerSideByGame = {};
    for (const f of finals) {
      const gid = String(f.game_id || "").trim();
      const w = String(f.winner || "").trim().toUpperCase();
      if (!gid || !w) continue;
      winnerSideByGame[gid] = w; // AWAY/HOME/TIE
    }

    // 4b) Spread cover map -- who covered the frozen spread_line for each
    // FINAL game. spread_line is the home team's number (negative = home
    // favored); home covers if their margin beats -spread_line. An exact
    // push (only possible on a non-.5 line) leaves the game unset, so
    // nobody's bonus pick can be scored for it either way.
    const coverSideByGame = {};
    for (const f of finals) {
      const gid = String(f.game_id || "").trim();
      const g = gameById[gid];
      if (!gid || !g || g.spread_line === null || g.spread_line === undefined) continue;

      const homeScore = Number(f.home_score);
      const awayScore = Number(f.away_score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

      const margin = homeScore - awayScore;
      const threshold = -Number(g.spread_line);

      if (margin > threshold) coverSideByGame[gid] = "HOME";
      else if (margin < threshold) coverSideByGame[gid] = "AWAY";
      // else: push -- leave unset
    }

    // 5) Score picks (only FINAL games)
    const totals = {}; // user -> { points, correct }
    for (const p of picks || []) {
      const name = String(p.user_name || "").trim();
      const gid = String(p.game_id || "").trim();
      if (!name || !gid) continue;

      const winnerSide = winnerSideByGame[gid];
      if (!winnerSide) continue;

      const pickRaw = String(p.pick || "").trim();
      const pickUpper = pickRaw.toUpperCase();

      let correct = false;

      // Normal case: pick is AWAY/HOME/TIE
      if (pickUpper === "AWAY" || pickUpper === "HOME" || pickUpper === "TIE") {
        correct = pickUpper === winnerSide;
      } else {
        // Legacy case: pick stored as team name string
        const g = gameById[gid];
        const away = String(g?.away || "").trim();
        const home = String(g?.home || "").trim();

        if (winnerSide === "TIE") correct = pickUpper === "TIE";
        else if (winnerSide === "AWAY") correct = pickRaw === away;
        else if (winnerSide === "HOME") correct = pickRaw === home;
      }

      if (!totals[name]) totals[name] = { points: 0, correct: 0 };
      if (correct) {
        totals[name].points += 1;
        totals[name].correct += 1;
      }
    }

    // 5b) Load and score spread (bonus) picks: +0.5 for each correct cover
    // pick on a FINAL game that didn't push.
    const { data: spreadPicksRows, error: spreadPicksErr } = await admin
      .from("spread_picks")
      .select("user_name, game_id, pick")
      .eq("week", week);
    if (spreadPicksErr) throw spreadPicksErr;

    let spreadCorrect = 0;
    for (const sp of spreadPicksRows || []) {
      const name = String(sp.user_name || "").trim();
      const gid = String(sp.game_id || "").trim();
      if (!name || !gid) continue;

      const coverSide = coverSideByGame[gid];
      if (!coverSide) continue; // not FINAL yet, no spread on file, or a push

      const pickUpper = String(sp.pick || "").trim().toUpperCase();
      if (pickUpper !== "AWAY" && pickUpper !== "HOME") continue;

      if (!totals[name]) totals[name] = { points: 0, correct: 0 };
      if (pickUpper === coverSide) {
        totals[name].points += 0.5;
        spreadCorrect += 1;
      }
    }

    // 6) Upsert leaderboard (same as you already do)
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
      const { error: lbErr } = await admin.from("leaderboard").upsert(lbRows, { onConflict: "season,week,user_name" });
      if (lbErr) throw lbErr;
    }

    // 7) Tie-break analysis (only if 1st place is tied)
    const tiebreak = await computeTiebreakSnapshot({
      admin,
      season,
      week,
      lbRows,
      finals,
      gameById,
    });

    return j(200, {
      ok: true,
      season,
      week,
      finals: finalGameIds.length,
      picks_seen: picks.length,
      spread_picks_seen: (spreadPicksRows || []).length,
      spread_correct: spreadCorrect,
      leaderboard_rows: lbRows.length,
      tiebreak, // <-- UI can display this
    });
  } catch (e) {
    return j(500, { ok: false, error: String(e?.message || e) });
  }
};

async function computeTiebreakSnapshot({ admin, season, week, lbRows, finals, gameById }) {
  // If no leaderboard rows yet, nothing to do
  if (!lbRows || lbRows.length === 0) {
    return { applicable: false, reason: "No leaderboard rows yet." };
  }

  const maxPoints = Math.max(...lbRows.map((r) => Number(r.points || 0)));
  const tied = lbRows.filter((r) => Number(r.points || 0) === maxPoints).map((r) => r.user_name);

  if (tied.length <= 1) {
    return { applicable: false, reason: "No tie for first.", maxPoints, tied_count: tied.length };
  }

  // Load which games are TB1/TB2/TB3 from week_meta (array of 3 game_ids)
  const { data: meta, error: metaErr } = await admin
    .from("week_meta")
    .select("tiebreakers")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  if (metaErr) {
    return { applicable: true, maxPoints, tied_users: tied, error: `week_meta read: ${metaErr.message}` };
  }

  const tbGameIds = Array.isArray(meta?.tiebreakers) ? meta.tiebreakers.slice(0, 3).map(String) : [];
  if (tbGameIds.length < 3) {
    return {
      applicable: true,
      maxPoints,
      tied_users: tied,
      error: "week_meta.tiebreakers missing/invalid (need 3 game_ids).",
      tbGameIds,
    };
  }

  // Load TB guesses for tied users (from tiebreakers table)
  const { data: tbRows, error: tbErr } = await admin
    .from("tiebreakers")
    .select("user_name, tb_no, total, game_id")
    .eq("week", week)
    .in("user_name", tied);

  if (tbErr) {
    return { applicable: true, maxPoints, tied_users: tied, error: `tiebreakers read: ${tbErr.message}` };
  }

  // Build user -> tb_no -> guess
  const guessByUser = {};
  for (const u of tied) guessByUser[u] = { 1: null, 2: null, 3: null };

  for (const r of tbRows || []) {
    const u = String(r.user_name || "").trim();
    const n = Number(r.tb_no);
    if (!u || !guessByUser[u] || ![1, 2, 3].includes(n)) continue;
    const val = r.total === null || r.total === undefined ? null : Number(r.total);
    guessByUser[u][n] = Number.isFinite(val) ? val : null;
  }

  // Map FINAL totals for TB games (only if that TB game is FINAL)
  const finalById = {};
  for (const f of finals || []) finalById[String(f.game_id)] = f;

  const tbGames = tbGameIds.map((gid, idx) => {
    const f = finalById[gid];
    const g = gameById?.[gid];
    const label = g ? `${g.away} @ ${g.home}` : gid;

    const isFinal = !!f && String(f.status).toUpperCase() === "FINAL";
    const home = isFinal ? Number(f.home_score) : null;
    const away = isFinal ? Number(f.away_score) : null;
    const actualTotal = isFinal && Number.isFinite(home) && Number.isFinite(away) ? home + away : null;

    return {
      tb_no: idx + 1,
      game_id: gid,
      label,
      is_final: isFinal,
      actual_total: actualTotal,
      home_score: isFinal ? home : null,
      away_score: isFinal ? away : null,
    };
  });

  // Apply tie-break rules in order; only consider TB if that TB game is FINAL
  let remaining = [...tied];
  let decidedBy = null;
  let winnerUsers = null;

  const perTB = [];

  for (const tb of tbGames) {
    const tb_no = tb.tb_no;

    if (!tb.is_final || tb.actual_total === null) {
      perTB.push({
        tb_no,
        game_id: tb.game_id,
        label: tb.label,
        status: "PENDING_FINAL",
        actual_total: tb.actual_total,
        remaining_users: remaining,
      });
      // Can't decide yet; stop here (we're doing realtime as games finalize)
      decidedBy = "PENDING";
      winnerUsers = remaining;
      break;
    }

    const actual = tb.actual_total;

    // Evaluate remaining users on this TB
    const evalRows = remaining.map((u) => {
      const guess = guessByUser?.[u]?.[tb_no];
      const hasGuess = Number.isFinite(guess);
      const busted = !hasGuess ? null : guess > actual;
      const diff = !hasGuess || busted ? null : actual - guess;
      const eligible = hasGuess && !busted;

      return { user_name: u, guess: hasGuess ? guess : null, eligible, busted: !!busted, diff };
    });

    const eligible = evalRows.filter((r) => r.eligible);
    if (eligible.length === 0) {
      // everyone busted (or missing guesses) -> move to next TB
      perTB.push({
        tb_no,
        game_id: tb.game_id,
        label: tb.label,
        status: "NO_ELIGIBLE_ALL_BUSTED",
        actual_total: actual,
        rows: evalRows,
        remaining_users: remaining,
      });
      continue;
    }

    const bestDiff = Math.min(...eligible.map((r) => r.diff));
    const best = eligible.filter((r) => r.diff === bestDiff).map((r) => r.user_name);

    perTB.push({
      tb_no,
      game_id: tb.game_id,
      label: tb.label,
      status: best.length === 1 ? "DECIDED" : "TIED_CONTINUE",
      actual_total: actual,
      rows: evalRows,
      bestDiff,
      bestUsers: best,
    });

    if (best.length === 1) {
      decidedBy = `TB${tb_no}`;
      winnerUsers = best;
      break;
    } else {
      // still tied -> only these move on
      remaining = best;
    }
  }

  // If not decided by TB1-3, fall back to season accumulated points (only if all TB games are FINAL OR TBs couldn't decide)
  let seasonTotals = null;
  if (!decidedBy || decidedBy === "PENDING") {
    // If pending, don't run season fallback yet (you said you want realtime while games finalize)
    // We'll only do season fallback after TBs are fully usable AND still tied.
  } else if (winnerUsers && winnerUsers.length > 1) {
    // still tied after TBs -> compute season totals up through current week
    seasonTotals = await getSeasonTotalsUpToWeek(admin, season, week, winnerUsers);

    const maxSeasonPts = Math.max(...Object.values(seasonTotals).map((n) => Number(n || 0)));
    const bestSeason = winnerUsers.filter((u) => Number(seasonTotals[u] || 0) === maxSeasonPts);

    if (bestSeason.length === 1) {
      decidedBy = "SEASON_POINTS";
      winnerUsers = bestSeason;
    } else {
      decidedBy = "SPLIT";
      winnerUsers = bestSeason;
    }
  } else if (!winnerUsers) {
    // if loop never set it, keep remaining
    winnerUsers = remaining;
    decidedBy = "UNKNOWN";
  }

  return {
    applicable: true,
    maxPoints,
    tied_users: tied,
    decidedBy,
    winners: winnerUsers,
    tb_game_ids: tbGameIds,
    tb_games: tbGames,
    perTB,
    seasonTotals: seasonTotals || null,
  };
}

async function getSeasonTotalsUpToWeek(admin, season, week, users) {
  // We compute from leaderboard table: sum(points) where season=season and week<=week and user_name in users
  // If leaderboard is large, this is still fine for typical pick pools.
  const { data, error } = await admin
    .from("leaderboard")
    .select("user_name, week, points")
    .eq("season", season)
    .lte("week", week)
    .in("user_name", users);

  if (error) {
    // If this fails, return zeros (don’t crash the function)
    const z = {};
    for (const u of users) z[u] = 0;
    return z;
  }

  const totals = {};
  for (const u of users) totals[u] = 0;

  for (const r of data || []) {
    const u = String(r.user_name || "").trim();
    const pts = Number(r.points || 0);
    if (!u || !Number.isFinite(pts)) continue;
    if (totals[u] === undefined) totals[u] = 0;
    totals[u] += pts;
  }

  return totals;
}

function j(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}