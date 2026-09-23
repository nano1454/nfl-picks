import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";
import Avatar from "./Avatar";
import { calcPot, countPickParticipants, calcPlayoffsPot, countPlayoffsParticipants } from "./potCalc";
import { logoSrc, fmtMatchupAbbr } from "./teamLogos";
import { resolveCascade } from "./tiebreakCascade";
import { isPlayoffWeek, PLAYOFFS_FIRST_WEEK, roundNameForWeek } from "./playoffsConfig";
import PageBanner from "./PageBanner";

function PillButton({ children, onClick, primary }) {
  return (
    <Button variant={primary ? "dark" : "secondary"} size="sm" pill onClick={onClick}>
      {children}
    </Button>
  );
}

export default function Leaderboard() {
  const [searchParams] = useSearchParams();
  const requestedSeason = searchParams.get("season");
  const requestedWeek = searchParams.get("week");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({ season: null, week: null, isCurrent: true });
  const [rows, setRows] = useState([]);
  const [playoffWeeksRaw, setPlayoffWeeksRaw] = useState([]); // per-week rows for weeks>=19, kept un-merged so totalAvailablePoints can weight each round by its own per-game max
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});
  const [potInfo, setPotInfo] = useState(null);

  // Tiebreak watch state
  const [tbWatch, setTbWatch] = useState(null);

  // Per-game pick detail for the "tap a bar to see picks" drawer -- loaded
  // once per season/week (not per user) since a pool this size is cheap to
  // load in full, and it means every row's drawer opens instantly with no
  // per-click fetch. Same season/week range as the leaderboard rows above
  // (a single week for the regular season, weeks 19..current for playoffs).
  const [picksDetail, setPicksDetail] = useState({ games: [], resultByGid: {}, picksByUserGame: {}, bonusByUserGame: {} });

  async function loadPicksDetail(season, week) {
    try {
      if (!season || !week) {
        setPicksDetail({ games: [], resultByGid: {}, picksByUserGame: {}, bonusByUserGame: {} });
        return;
      }

      const lowWeek = isPlayoffWeek(week) ? PLAYOFFS_FIRST_WEEK : week;

      const [
        { data: games, error: gErr },
        { data: results, error: rErr },
        { data: picks, error: pErr },
        { data: bonusPicks, error: bErr },
      ] = await Promise.all([
        supabase
          .from("games")
          .select("id, week, away, home, kickoff")
          .eq("season", season)
          .gte("week", lowWeek)
          .lte("week", week)
          .order("kickoff", { ascending: true }),
        supabase
          .from("game_results")
          .select("game_id, status, home_score, away_score, passing_winner, rushing_winner")
          .eq("season", season)
          .gte("week", lowWeek)
          .lte("week", week),
        // picks/bonus_picks have no season column (only week) -- same
        // week-range-only filter already used elsewhere in this app.
        supabase.from("picks").select("user_name, game_id, pick").gte("week", lowWeek).lte("week", week),
        supabase
          .from("bonus_picks")
          .select("user_name, game_id, category, pick")
          .gte("week", lowWeek)
          .lte("week", week),
      ]);
      if (gErr) throw gErr;
      if (rErr) throw rErr;
      if (pErr) throw pErr;
      if (bErr) throw bErr;

      const nowMs = Date.now();
      const gamesWithLock = (games || []).map((g) => {
        const kickoffMs = g.kickoff ? new Date(g.kickoff).getTime() : NaN;
        const locked = Number.isFinite(kickoffMs) && nowMs >= kickoffMs - 60 * 60 * 1000;
        return { ...g, locked };
      });

      // Same FINAL-only winnerSide/passingWinner/rushingWinner derivation as
      // Results.jsx's gameResultByGid, so "correct pick" here always agrees
      // with the Picks Table.
      const resultByGid = {};
      for (const r of results || []) {
        const gid = String(r.game_id || "").trim();
        if (!gid) continue;
        const status = String(r.status || "").toUpperCase();
        let winnerSide = null;
        let passingWinner = null;
        let rushingWinner = null;
        if (status === "FINAL") {
          const awayScore = Number(r.away_score);
          const homeScore = Number(r.home_score);
          if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) {
            winnerSide = homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : "TIE";
          }
          const pw = String(r.passing_winner || "").toUpperCase();
          const rw = String(r.rushing_winner || "").toUpperCase();
          if (pw === "AWAY" || pw === "HOME") passingWinner = pw;
          if (rw === "AWAY" || rw === "HOME") rushingWinner = rw;
        }
        resultByGid[gid] = { status, winnerSide, passingWinner, rushingWinner };
      }

      const picksByUserGame = {};
      for (const p of picks || []) {
        const u = String(p.user_name || "").trim();
        const gid = String(p.game_id || "").trim();
        if (!u || !gid) continue;
        (picksByUserGame[u] ||= {})[gid] = p.pick;
      }

      const bonusByUserGame = {};
      for (const b of bonusPicks || []) {
        const u = String(b.user_name || "").trim();
        const gid = String(b.game_id || "").trim();
        if (!u || !gid) continue;
        ((bonusByUserGame[u] ||= {})[gid] ||= {})[b.category] = b.pick;
      }

      setPicksDetail({ games: gamesWithLock, resultByGid, picksByUserGame, bonusByUserGame });
    } catch (e) {
      console.error("loadPicksDetail failed:", e);
    }
  }

  async function loadMetaAndLeaderboard() {
    setLoading(true);
    setErr("");
    try {
      // 1) Ask server for the requested week (defaults to whatever's current)
      const qs = requestedSeason && requestedWeek ? `?season=${requestedSeason}&week=${requestedWeek}` : "";
      const res = await fetch(`/.netlify/functions/getweek${qs}`, { cache: "no-store" });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`getweek returned non-JSON (HTTP ${res.status}): ${text.slice(0, 140)}`);
      }

      if (!res.ok || !data.ok) throw new Error(data?.error || `Could not load week (HTTP ${res.status})`);

      const season = Number(data.season);
      const week = Number(data.week);

      setMeta({ season, week, isCurrent: data.isCurrent !== false });

      // 1b) Usernames/avatars for display (falls back to full name / initials
      // if this fails -- never block the leaderboard on it)
      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setUsernameByFullName(d.usernames || {});
            setAvatarByFullName(d.avatars || {});
          }
        })
        .catch(() => {});

      // 1c) The pot -- non-blocking, same as the usernames/avatars fetch.
      // Playoffs is one flat $40 buy-in for the whole postseason (sourced
      // from playoffs_participants), not a per-week charge like the
      // regular season's countPickParticipants()+calcPot().
      if (isPlayoffWeek(week)) {
        countPlayoffsParticipants()
          .then((n) => setPotInfo(calcPlayoffsPot(n)))
          .catch(() => {});
      } else {
        countPickParticipants(season, week)
          .then((n) => setPotInfo(calcPot(n)))
          .catch(() => {});
      }

      // 2) Load leaderboard rows for that season/week. Playoffs (weeks
      // 19-22) never reset the live Leaderboard round to round -- it shows
      // the running cumulative total across every playoff round played so
      // far, unlike the regular season's per-week-only view -- so for a
      // playoff week this sums every week from 19 through the current one
      // per user instead of reading a single week's rows.
      if (isPlayoffWeek(week)) {
        const { data: lbRaw, error } = await supabase
          .from("leaderboard")
          .select("user_name, week, points, correct_picks, games_final_count, updated_at")
          .eq("season", season)
          .gte("week", PLAYOFFS_FIRST_WEEK)
          .lte("week", week);

        if (error) throw error;

        const byUser = {};
        for (const r of lbRaw || []) {
          const u = String(r.user_name || "").trim();
          if (!u) continue;
          if (!byUser[u]) byUser[u] = { user_name: u, points: 0, correct_picks: 0, games_final_count: 0, updated_at: r.updated_at };
          byUser[u].points += Number(r.points || 0);
          byUser[u].correct_picks += Number(r.correct_picks || 0);
          if (r.updated_at && (!byUser[u].updated_at || r.updated_at > byUser[u].updated_at)) byUser[u].updated_at = r.updated_at;
        }
        const merged = Object.values(byUser).sort(
          (a, b) => b.points - a.points || a.user_name.localeCompare(b.user_name)
        );

        setRows(merged);
        setPlayoffWeeksRaw(lbRaw || []);
      } else {
        const { data: lb, error } = await supabase
          .from("leaderboard")
          .select("user_name, points, correct_picks, games_final_count, updated_at")
          .eq("season", season)
          .eq("week", week)
          .order("points", { ascending: false })
          .order("user_name", { ascending: true });

        if (error) throw error;

        setRows(lb || []);
        setPlayoffWeeksRaw([]);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadTiebreakWatch(season, week, leaderboardRows) {
    try {
      if (!season || !week) {
        setTbWatch(null);
        return;
      }

      const lb = Array.isArray(leaderboardRows) ? leaderboardRows : [];
      if (lb.length === 0) {
        setTbWatch({ applicable: false, reason: "No leaderboard rows yet." });
        return;
      }

      const maxPoints = Math.max(...lb.map((r) => Number(r.points || 0)));
      const tiedUsers = lb.filter((r) => Number(r.points || 0) === maxPoints).map((r) => r.user_name);

      if (tiedUsers.length <= 1) {
        setTbWatch({ applicable: false, reason: "No tie for 1st.", maxPoints, tied_count: tiedUsers.length });
        return;
      }

      // 1) Read TB game_ids from week_meta
      const { data: metaRow, error: metaErr } = await supabase
        .from("week_meta")
        .select("tiebreakers")
        .eq("season", season)
        .eq("week", week)
        .maybeSingle();

      if (metaErr) throw metaErr;

      // Regular season always has exactly 3 tiebreakers; playoffs (weeks
      // 19-22) has exactly 1 per round -- .slice(0,3) is a no-op there, and
      // the real error condition in both cases is "none at all," not
      // "fewer than 3" (which would wrongly reject a valid playoff round).
      const tbGameIds = Array.isArray(metaRow?.tiebreakers) ? metaRow.tiebreakers.slice(0, 3).map(String) : [];
      if (tbGameIds.length === 0) {
        setTbWatch({
          applicable: true,
          maxPoints,
          tiedUsers,
          error: "week_meta.tiebreakers missing/invalid (need at least 1 game_id).",
          tbGameIds,
        });
        return;
      }

      // 1b) Load games metadata so we can show logos + "@" in the panel, plus
      // kickoff so we know when each TB round's guesses are safe to reveal
      const { data: tbGames, error: tbGamesErr } = await supabase
        .from("games")
        .select("id, away, home, kickoff")
        .eq("season", season)
        .eq("week", week)
        .in("id", tbGameIds);

      if (tbGamesErr) throw tbGamesErr;

      const gameMetaById = {};
      const lockedByGame = {};
      const nowMs = Date.now();
      for (const g of tbGames || []) {
        gameMetaById[String(g.id)] = { away: g.away, home: g.home };
        const kickoffMs = g.kickoff ? new Date(g.kickoff).getTime() : NaN;
        lockedByGame[String(g.id)] = Number.isFinite(kickoffMs) && nowMs >= kickoffMs - 60 * 60 * 1000;
      }

      // 2) Read game_results for those TB games (need status + scores)
      const { data: tbResults, error: grErr } = await supabase
        .from("game_results")
        .select("game_id, status, home_score, away_score")
        .eq("season", season)
        .eq("week", week)
        .in("game_id", tbGameIds);

      if (grErr) throw grErr;

      const resultByGame = {};
      for (const r of tbResults || []) resultByGame[String(r.game_id)] = r;

      // 3) Read users' TB guesses (tiebreakers table)
      const { data: guesses, error: tbErr } = await supabase
        .from("tiebreakers")
        .select("user_name, tb_no, total, game_id")
        .eq("week", week)
        .in("user_name", tiedUsers);

      if (tbErr) throw tbErr;

      const guessByUser = {};
      for (const u of tiedUsers) guessByUser[u] = { 1: null, 2: null, 3: null };

      for (const g of guesses || []) {
        const u = String(g.user_name || "").trim();
        const n = Number(g.tb_no);
        const val = g.total === null || g.total === undefined ? null : Number(g.total);
        if (!u || !guessByUser[u] || ![1, 2, 3].includes(n)) continue;
        guessByUser[u][n] = Number.isFinite(val) ? val : null;
      }

      // Season points (through this week, inclusive) for the tied group --
      // only actually consulted by resolveCascade if still tied after all
      // TB rounds are FINAL. Playoffs (weeks 19-22) share the same `season`
      // value as the regular season that preceded them, so this is floored
      // at week 19 for a playoff week -- otherwise it would incorrectly
      // blend in regular-season weeks 1-18 as a playoff tiebreak fallback.
      const { data: seasonLb, error: seasonErr } = await supabase
        .from("leaderboard")
        .select("user_name, week, points")
        .eq("season", season)
        .gte("week", isPlayoffWeek(week) ? PLAYOFFS_FIRST_WEEK : 0)
        .lte("week", week)
        .in("user_name", tiedUsers);
      if (seasonErr) throw seasonErr;

      const seasonPointsByUser = {};
      for (const u of tiedUsers) seasonPointsByUser[u] = 0;
      for (const r of seasonLb || []) {
        const u = String(r.user_name || "").trim();
        const pts = Number(r.points || 0);
        if (!u || !Number.isFinite(pts)) continue;
        seasonPointsByUser[u] = (seasonPointsByUser[u] || 0) + pts;
      }

      // Guesses stay hidden from everyone (including other tied leaders)
      // until each specific TB round's game has locked -- otherwise a
      // participant could see a rival's guess before submitting/changing
      // their own for a later-locking TB round, defeating the point of a
      // blind tiebreaker guess. Since lock timing can differ per round,
      // resolve per-round reveal below rather than passing one flag for
      // all three -- reuse resolveCascade's per-round evaluator directly.
      const { decidedBy, winners, perTB: perTBRaw, seasonTotals } = resolveCascade({
        tiedUsers,
        tbGameIds,
        resultByGame,
        guessByUser,
        seasonPointsByUser,
        revealGuesses: (gameId) => !!lockedByGame[String(gameId)],
      });

      const perTB = perTBRaw.map((res) => {
        const gm = gameMetaById[String(res.gameId)] || null;
        return { ...res, away: gm?.away || null, home: gm?.home || null };
      });

      setTbWatch({
        applicable: true,
        maxPoints,
        tiedUsers,
        tbGameIds,
        perTB,
        decidedBy,
        winners,
        seasonTotals,
      });
    } catch (e) {
      setTbWatch({ applicable: true, error: String(e?.message || e) });
    }
  }

  // initial load
  useEffect(() => {
    loadMetaAndLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSeason, requestedWeek]);

  // whenever meta/rows change, refresh tiebreak watch
  useEffect(() => {
    if (!meta.season || !meta.week) return;
    loadTiebreakWatch(meta.season, meta.week, rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week, rows]);

  // load the per-game pick detail once per season/week (not tied to `rows`
  // -- it doesn't need to re-fetch just because point totals re-sorted)
  useEffect(() => {
    if (!meta.season || !meta.week) return;
    loadPicksDetail(meta.season, meta.week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week]);

  // A TB round locking is a pure time event (no DB write happens at that
  // moment), so the realtime subscriptions below won't catch it -- poll
  // periodically while viewing the live current week so a guess reveals
  // right on schedule instead of only on the next unrelated data change.
  useEffect(() => {
    if (!meta.season || !meta.week || !meta.isCurrent) return;
    const t = setInterval(() => loadTiebreakWatch(meta.season, meta.week, rows), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week, meta.isCurrent, rows]);

  // realtime refresh whenever leaderboard / game_results / tiebreakers changes
  // (only meaningful for the live current week -- a historical week's rows
  // never change, so skip opening channels for it)
  useEffect(() => {
    if (!meta.season || !meta.week || !meta.isCurrent) return;

    const lbChannel = supabase
      .channel("leaderboard_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leaderboard",
          filter: `season=eq.${meta.season},week=eq.${meta.week}`,
        },
        () => loadMetaAndLeaderboard()
      )
      .subscribe();

    const grChannel = supabase
      .channel("game_results_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_results",
          filter: `season=eq.${meta.season},week=eq.${meta.week}`,
        },
        () => {
          loadTiebreakWatch(meta.season, meta.week, rows);
          loadPicksDetail(meta.season, meta.week);
        }
      )
      .subscribe();

    const tbChannel = supabase
      .channel("tiebreakers_live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tiebreakers",
          filter: `week=eq.${meta.week}`,
        },
        () => loadTiebreakWatch(meta.season, meta.week, rows)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lbChannel);
      supabase.removeChannel(grChannel);
      supabase.removeChannel(tbChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week, meta.isCurrent]);

  // Display label for a user -- their login username when known, else their
  // full name (join key stays full_name everywhere else, this is display-only)
  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  const hasPoints = useMemo(() => (rows || []).some((r) => Number(r.points || 0) > 0), [rows]);

  // Total points available: for the regular season, 1 pt per FINAL game
  // (winner) + 0.5 each for the passing/rushing bonus picks on that game.
  // Playoffs has no bonus picks and a different max-per-game each round
  // (1.1/3.3/7.7/8.8, favorite-or-underdog), and -- since the Leaderboard
  // is cumulative there -- needs to sum that per-round max across every
  // round played so far, not just the current one.
  const PLAYOFF_ROUND_MAX_PER_GAME = { 19: 1.1, 20: 3.3, 21: 7.7, 22: 8.8 };
  const totalAvailablePoints = useMemo(() => {
    if (isPlayoffWeek(meta.week)) {
      const gamesFinalByWeek = {};
      for (const r of playoffWeeksRaw || []) {
        const w = Number(r.week);
        const gfc = Number(r.games_final_count || 0);
        if (!(w in gamesFinalByWeek) || gfc > gamesFinalByWeek[w]) gamesFinalByWeek[w] = gfc;
      }
      let total = 0;
      for (const [w, gfc] of Object.entries(gamesFinalByWeek)) {
        total += gfc * (PLAYOFF_ROUND_MAX_PER_GAME[Number(w)] || 0);
      }
      return total;
    }
    const gamesFinal = Math.max(0, ...(rows || []).map((r) => Number(r.games_final_count || 0)));
    return gamesFinal * 2;
  }, [rows, meta.week, playoffWeeksRaw]);

  if (loading) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>Loading leaderboard…</div>;
  if (err) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <style>{`
        @keyframes lbBarShimmer { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
        .lb-drawer-games { display: flex; flex-wrap: wrap; gap: 12px; }
        @media (max-width: 640px) {
          .lb-drawer-games {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
          }
        }
      `}</style>

      <PageBanner src="/leaderboard_banner.png" alt="Leaderboard — See who's on top." />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ color: "#555", fontSize: 14 }}>
          Season <b style={{ color: "#111" }}>{meta.season}</b> • Week <b style={{ color: "#111" }}>{meta.week}</b>
          {potInfo && potInfo.n > 0 && (
            <div style={{ marginTop: 4, fontSize: 13 }}>
              🏆 {isPlayoffWeek(meta.week) ? "Playoffs' Pot" : "This week's pot"}: <b style={{ color: "#b8860b" }}>${potInfo.pot.toFixed(2)}</b>
              <span style={{ color: "#888" }}> ({potInfo.n} participant{potInfo.n === 1 ? "" : "s"})</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PillButton onClick={loadMetaAndLeaderboard}>Refresh</PillButton>
          <Link to="/results" style={{ textDecoration: "none" }}>
            <PillButton>📋 Picks Table</PillButton>
          </Link>
          <Link to="/history" style={{ textDecoration: "none" }}>
            <PillButton>📅 Season History</PillButton>
          </Link>
          <Link to="/" style={{ textDecoration: "none" }}>
            <PillButton primary>← Back</PillButton>
          </Link>
        </div>
      </div>

      {!meta.isCurrent && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid rgba(184,134,11,0.3)",
            background: "rgba(255,215,0,0.05)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>📅 Viewing a past week (Season {meta.season}, Week {meta.week}).</span>
          <Link to="/leaderboard" style={{ textDecoration: "none" }}>
            <PillButton>View current week</PillButton>
          </Link>
        </div>
      )}

      {!hasPoints ? (
        <div
          style={{
            marginTop: 18,
            border: "1px solid rgba(184,134,11,0.3)",
            borderRadius: 14,
            padding: 16,
            background: "linear-gradient(135deg, rgba(255,215,0,0.05), rgba(0,0,0,0.02))",
          }}
        >
          No points yet. This page updates automatically once games become FINAL.
          <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            Bars animate automatically as points change (realtime).
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          {/* Points Tracker header */}
          <div
            style={{
              border: "1px solid rgba(184,134,11,0.3)",
              borderRadius: 14,
              padding: 14,
              background: "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(0,0,0,0.02))",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>🏈 Points Tracker</div>
            <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
              Live rankings based on completed games.
              <br />
              Points will update as soon as data is officially available.
            </div>
          </div>

          <RaceList
            rows={rows}
            week={meta.week}
            totalAvailable={totalAvailablePoints}
            dispName={dispName}
            avatarByFullName={avatarByFullName}
            picksDetail={picksDetail}
          />

          {/* Tiebreak Watch BELOW the bars */}
          {tbWatch?.applicable ? <TiebreakWatchPanel tbWatch={tbWatch} dispName={dispName} /> : null}
        </div>
      )}
      </div>
    </div>
  );
}

/* ---------------- Horse race list (animated reorder via FLIP) ---------------- */
function RaceList({ rows, week, totalAvailable, dispName, avatarByFullName, picksDetail }) {
  const itemRefs = useRef(new Map()); // key -> element
  const lastRectsRef = useRef(new Map()); // key -> DOMRect
  const [expandedUsers, setExpandedUsers] = useState(() => new Set());

  function toggleExpanded(userName) {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) next.delete(userName);
      else next.add(userName);
      return next;
    });
  }

  // Capture positions BEFORE the DOM updates (layout)
  useLayoutEffect(() => {
    const map = new Map();
    for (const r of rows || []) {
      const key = String(r.user_name);
      const el = itemRefs.current.get(key);
      if (!el) continue;
      map.set(key, el.getBoundingClientRect());
    }
    lastRectsRef.current = map;
  }, [rows]);

  // Animate to new positions AFTER update
  useLayoutEffect(() => {
    const prev = lastRectsRef.current;
    for (const r of rows || []) {
      const key = String(r.user_name);
      const el = itemRefs.current.get(key);
      if (!el) continue;

      const newRect = el.getBoundingClientRect();
      const oldRect = prev.get(key);
      if (!oldRect) continue;

      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (dx === 0 && dy === 0) continue;

      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: 450,
        easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
      });
    }
  }, [rows]);

  const max = totalAvailable || 0;

  const medalStyle = [
    { background: "linear-gradient(160deg, #fff7d6, #ffd700, #b8860b)", color: "#3a2a00" }, // gold
    { background: "linear-gradient(160deg, #f4f4f4, #c9c9c9, #8f8f8f)", color: "#222" }, // silver
    { background: "linear-gradient(160deg, #f0c9a0, #cd7f32, #8a4b17)", color: "#2a1500" }, // bronze
  ];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r, idx) => {
        const points = Number(r.points || 0);
        const truePct = max > 0 ? Math.min(100, (points / max) * 100) : 0;
        const barPct = max > 0 ? Math.max(2, truePct) : 0; // floor is visual-only (keeps a 0pt bar from vanishing)
        const medal = medalStyle[idx];
        const userName = String(r.user_name);
        const isOpen = expandedUsers.has(userName);

        return (
          <div
            key={userName}
            ref={(el) => {
              if (!el) return;
              itemRefs.current.set(userName, el);
            }}
            style={{
              position: "relative",
              overflow: "hidden",
              border: idx === 0 ? "1px solid rgba(184,134,11,0.5)" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              background: "#f0f0f0",
              boxShadow: idx === 0 ? "0 4px 18px rgba(184,134,11,0.18)" : "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
            {/* Bar -- tap/click to reveal this player's picks in a drawer
                that scoots down from behind it (see PicksDrawer below) */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => toggleExpanded(userName)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleExpanded(userName);
                }
              }}
              style={{ position: "relative", cursor: "pointer" }}
            >
              {/* Fill layer -- the whole bar doubles as the progress bar now,
                  instead of a separate bar-in-a-box between the avatar and points */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${barPct}%`,
                  background: "linear-gradient(90deg, #111 0%, #7a5c14 55%, #ffd700 100%)",
                  transition: "width 650ms cubic-bezier(0.2, 0.9, 0.2, 1)",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: "45%",
                  height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                  animation: "lbBarShimmer 1.8s ease-in-out infinite",
                }} />
              </div>

              {/* Content sits above the fill -- name/points get a semi-opaque
                  chip behind them so they stay legible whether they land over
                  the dark/gold fill or the plain unfilled track */}
              <div style={{ position: "relative", padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 14,
                    flexShrink: 0,
                    background: medal ? medal.background : "#111",
                    color: medal ? medal.color : "#fff",
                    boxShadow: medal ? "0 2px 6px rgba(0,0,0,0.25)" : "none",
                  }}
                >
                  {idx + 1}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,255,255,0.88)",
                    borderRadius: 999,
                    padding: "4px 12px 4px 4px",
                  }}
                >
                  <Avatar username={dispName(userName)} avatar={avatarByFullName?.[userName]} size={32} />
                  <div style={{ fontWeight: 800, color: "#111" }}>{dispName(userName)}</div>
                </div>

                <div style={{ flex: 1 }} />

                <div
                  style={{
                    textAlign: "right",
                    background: "rgba(255,255,255,0.88)",
                    borderRadius: 10,
                    padding: "4px 10px",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18, color: idx === 0 ? "#b8860b" : "#111" }}>
                    {Number(points).toFixed(1)}
                  </div>
                  {max > 0 && <div style={{ fontSize: 10, color: "#666" }}>{Math.round(truePct)}%</div>}
                </div>

                <div
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.88)",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 250ms ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4L6 8L10 4" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <PicksDrawer
              open={isOpen}
              userName={userName}
              week={week}
              correctPicks={r.correct_picks}
              points={r.points}
              picksDetail={picksDetail}
            />
          </div>
        );
      })}
    </div>
  );
}

// Same derivation as HallOfChampions.jsx/ChampionWeekDetail.jsx's
// correctBonusPicks(): total points minus straight-pick points leaves the
// bonus (P/R) points, and each is worth 0.5. Only meaningful for the
// regular season, where every correct straight pick is worth exactly 1 --
// playoffs' underdog-scaled points (1.0-8.8) and lack of bonus picks make
// this arithmetic meaningless there, so callers must gate on !isPlayoffWeek.
function correctBonusPicks(points, correctStraightPicks) {
  const bonusPoints = Number(points || 0) - Number(correctStraightPicks || 0);
  return Math.max(0, Math.round(bonusPoints / 0.5));
}

/* ---------------- Per-player picks drawer (scoots down from behind the bar) ---------------- */
function PicksDrawer({ open, userName, week, correctPicks, points, picksDetail }) {
  const { games, resultByGid, picksByUserGame, bonusByUserGame } = picksDetail || {};
  const userPicks = picksByUserGame?.[userName] || {};
  const userBonusPicks = bonusByUserGame?.[userName] || {};
  const gamesList = games || [];
  const playoffs = isPlayoffWeek(week);

  // Small inline version of Results.jsx's renderBonusBadges() -- same
  // purple/orange P/R convention, sized to sit under the main pick logo here.
  function bonusBadge(gid, category, raw, color, letter, categoryWinner, g) {
    const pick = String(raw || "").toUpperCase();
    const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
    if (!team) return null;
    const src = logoSrc(team);
    const correct = !!categoryWinner && pick === categoryWinner;

    return (
      <span
        key={category}
        title={correct ? `${letter === "P" ? "Passing" : "Rushing"}: ${team} — correct!` : `${letter === "P" ? "Passing" : "Rushing"}: ${team}`}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          border: `2px solid ${color}`,
          borderRadius: 4,
          overflow: "visible",
        }}
      >
        {src && (
          <img
            src={src}
            alt={team}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        {correct && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#16a34a",
              color: "#fff",
              fontSize: 7,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            ✓
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 320ms cubic-bezier(0.2, 0.9, 0.2, 1)",
      }}
    >
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.1)",
            background: "#fff",
            padding: "12px 14px 14px",
          }}
        >
          {gamesList.length === 0 ? (
            <div style={{ color: "#888", fontSize: 13 }}>No games yet.</div>
          ) : (
            <>
              {Number.isFinite(Number(correctPicks)) && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, fontWeight: 800, color: "#16a34a", marginBottom: 8 }}>
                  <span>✅ {correctPicks} correct straight pick{Number(correctPicks) === 1 ? "" : "s"}</span>
                  {/* Playoffs has no passing/rushing bonus picks, and its
                      underdog-scaled points break the points-minus-straight
                      arithmetic this count relies on -- straight-pick count
                      alone is shown there instead (matches the label above,
                      just without the P/R split). */}
                  {!playoffs && (
                    <span>✅ {correctBonusPicks(points, correctPicks)} correct P/R pick{correctBonusPicks(points, correctPicks) === 1 ? "" : "s"}</span>
                  )}
                </div>
              )}
              {(() => {
                const renderGame = (g) => {
                  const gid = String(g.id);
                  const rawPick = userPicks[gid];
                  const pick = String(rawPick || "").toUpperCase();
                  const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
                  const gr = resultByGid?.[gid];
                  const correct = !!team && !!gr?.winnerSide && pick === gr.winnerSide;
                  const src = team ? logoSrc(team) : null;

                  return (
                    <div key={gid} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#999", marginBottom: 3, whiteSpace: "nowrap" }}>
                        {fmtMatchupAbbr(g)}
                      </div>
                      {!g.locked ? (
                        <span
                          title="Picks hidden until this game locks"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.04)",
                            fontSize: 18,
                            color: "#bbb",
                          }}
                        >
                          🔒
                        </span>
                      ) : !team ? (
                        <span
                          title="No pick submitted"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.05)",
                            border: "1px dashed rgba(0,0,0,0.15)",
                          }}
                        >
                          <img
                            src="/logos/nfl.png"
                            alt="No pick"
                            style={{ width: 22, height: 22, objectFit: "contain", opacity: 0.55, display: "block" }}
                          />
                        </span>
                      ) : (
                        <>
                          <span
                            title={correct ? `${team} — correct!` : team}
                            style={{
                              position: "relative",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 34,
                              height: 34,
                              border: correct ? "3px solid #16a34a" : "1px solid rgba(0,0,0,0.12)",
                              borderRadius: 8,
                              background: correct ? "rgba(22,163,74,0.10)" : "transparent",
                              overflow: "visible",
                            }}
                          >
                            {src && (
                              <img
                                src={src}
                                alt={team}
                                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 6 }}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            )}
                            {correct && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: -7,
                                  right: -7,
                                  width: 15,
                                  height: 15,
                                  borderRadius: "50%",
                                  background: "#16a34a",
                                  color: "#fff",
                                  fontSize: 10,
                                  fontWeight: 900,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </span>

                          {/* Passing/rushing bonus picks (regular season only
                              -- playoffs has none, so these maps are always
                              empty there and nothing renders) */}
                          {(userBonusPicks[gid]?.passing_yards || userBonusPicks[gid]?.rushing_yards) && (
                            <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                              {bonusBadge(gid, "passing_yards", userBonusPicks[gid]?.passing_yards, "#7c3aed", "P", gr?.passingWinner, g)}
                              {bonusBadge(gid, "rushing_yards", userBonusPicks[gid]?.rushing_yards, "#ea580c", "R", gr?.rushingWinner, g)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                };

                // Regular season is always a single week -- flat layout,
                // byte-identical to before. Playoffs is cumulative across
                // rounds (19..current), so when more than one week is
                // present, group games under a round-name header per week
                // to match the Leaderboard's own cumulative framing instead
                // of dumping every round's games into one unlabeled row.
                const weeksPresent = [...new Set(gamesList.map((g) => Number(g.week)))].sort((a, b) => a - b);

                if (weeksPresent.length <= 1) {
                  return <div className="lb-drawer-games">{gamesList.map(renderGame)}</div>;
                }

                return weeksPresent.map((w) => (
                  <div key={w} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#b8860b",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        marginBottom: 6,
                      }}
                    >
                      {roundNameForWeek(w)}
                    </div>
                    <div className="lb-drawer-games">
                      {gamesList.filter((g) => Number(g.week) === w).map(renderGame)}
                    </div>
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tiebreak watch panel ---------------- */
function TiebreakWatchPanel({ tbWatch, dispName }) {
  const card = {
    marginTop: 16,
    border: "1px solid rgba(184,134,11,0.3)",
    borderRadius: 14,
    padding: 14,
    background: "linear-gradient(135deg, rgba(255,215,0,0.05), rgba(0,0,0,0.02))",
  };

  if (tbWatch?.error) {
    return (
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 6, color: "#111" }}>⚖️ Tiebreak Watch</div>
        <div style={{ color: "#b00" }}>{tbWatch.error}</div>
      </div>
    );
  }

  if (!tbWatch?.tiedUsers || tbWatch.tiedUsers.length <= 1) return null;

  const decidedLabel =
    tbWatch.decidedBy === "PENDING"
      ? "Pending (waiting on tiebreak game FINAL)"
      : tbWatch.decidedBy === "SEASON_POINTS"
      ? "Currently decided by season points"
      : tbWatch.decidedBy === "SPLIT"
      ? "Still tied — split winnings"
      : `Currently decided by ${tbWatch.decidedBy}`;

  const logoBox = { width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center" };
  const logoImg = { width: 24, height: 24, objectFit: "contain", display: "block" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>⚖️ Tiebreak Watch</div>
          <div style={{ color: "#555", marginTop: 2 }}>
            Tie for 1st <i>right now</i> at <b>{tbWatch.maxPoints}</b> points: <b>{tbWatch.tiedUsers.map(dispName).join(", ")}</b>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
            ⏳ Live snapshot — recalculates automatically as more games finish. Who's tied, and everything below, can still change until every game this week is FINAL.
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
            Status: <b>{decidedLabel}</b>
          </div>
        </div>

        <div style={{ alignSelf: "flex-end", fontSize: 13 }}>
          Current Frontrunners: <b>{(tbWatch.winners || []).map(dispName).join(", ")}</b>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {(tbWatch.perTB || []).map((tb) => {
          const awayLogo = tb.away ? logoSrc(tb.away) : null;
          const homeLogo = tb.home ? logoSrc(tb.home) : null;

          return (
            <div key={tb.tbNo} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>TB{tb.tbNo} • Game:</span>

                  {awayLogo ? (
                    <span style={logoBox} title={tb.away}>
                      <img src={awayLogo} alt={tb.away} style={logoImg} />
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{tb.away || "—"}</span>
                  )}

                  <span style={{ fontWeight: 900, color: "#333" }}>@</span>

                  {homeLogo ? (
                    <span style={logoBox} title={tb.home}>
                      <img src={homeLogo} alt={tb.home} style={logoImg} />
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{tb.home || "—"}</span>
                  )}
                </div>

                <div style={{ fontSize: 13 }}>
                  Actual total: <b>{tb.actual === null || tb.actual === undefined ? "— (not FINAL yet)" : tb.actual}</b>
                </div>
              </div>

              <div style={{ marginTop: 8, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={th}>User</th>
                      <th style={th}>Guess</th>
                      <th style={th}>Status</th>
                      <th style={th}>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tb.rows || []).map((r) => {
                      const status = r.hidden
                        ? "🔒 Hidden until locked"
                        : tb.actual === null
                        ? "Waiting…"
                        : r.guess === null
                        ? "No guess"
                        : r.busted
                        ? "BUSTED (over)"
                        : "ALIVE (≤ actual)";
                      const diffText = r.diff === null || r.diff === undefined ? "—" : String(r.diff);

                      return (
                        <tr key={r.user_name} style={{ borderTop: "1px solid #eee" }}>
                          <td style={td}>
                            <b>{dispName(r.user_name)}</b>
                          </td>
                          <td style={td}>{r.hidden ? "🔒" : r.guess ?? "—"}</td>
                          <td style={td}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: "1px solid #ddd",
                                background:
                                  tb.actual === null
                                    ? "rgba(0,0,0,0.04)"
                                    : r.busted
                                    ? "rgba(200,0,0,0.08)"
                                    : r.guess === null
                                    ? "rgba(0,0,0,0.04)"
                                    : "rgba(0,160,0,0.10)",
                              }}
                            >
                              {status}
                            </span>
                          </td>
                          <td style={td}>{diffText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
                {tb.status === "PENDING_FINAL" && "This tiebreak game isn’t FINAL yet — standings will update automatically."}
                {tb.status === "NO_ELIGIBLE_ALL_BUSTED" &&
                  `Current Top ${tb.rows.length} Participant${tb.rows.length === 1 ? "" : "s"} busted for this tiebreak → next tiebreak game decides among them (if this group is still tied once the week wraps up).`}
                {tb.status === "TIED_CONTINUE" && `Still tied among today's group → advancing: ${(tb.bestUsers || []).map(dispName).join(", ")}`}
                {tb.status === "DECIDED" && `Would currently be decided here: ${(tb.bestUsers || []).map(dispName).join(", ")}`}
              </div>
            </div>
          );
        })}
      </div>

      {tbWatch.decidedBy === "SEASON_POINTS" && tbWatch.seasonTotals ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Season points (fallback)</div>
          {Object.entries(tbWatch.seasonTotals).map(([u, pts]) => (
            <div key={u}>
              {dispName(u)}: <b>{pts}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const th = { padding: "8px 6px", fontWeight: 800, color: "#333", whiteSpace: "nowrap" };
const td = { padding: "8px 6px", whiteSpace: "nowrap" };