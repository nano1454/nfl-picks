import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";
import Avatar from "./Avatar";
import { logoSrc, fmtMatchup } from "./teamLogos";

/** True when the global deadline has passed */
function isDeadlinePassed(deadlineIso, nowTs) {
  if (!deadlineIso) return false;
  const ms = new Date(deadlineIso).getTime();
  return Number.isFinite(ms) && nowTs >= ms;
}

/** True when a single game has locked (1 hour before kickoff — same rule as picks page) */
function isGameLockedNow(game, nowTs) {
  if (!game?.kickoff) return false;
  const kickMs = new Date(game.kickoff).getTime();
  return Number.isFinite(kickMs) && nowTs >= kickMs - 60 * 60 * 1000;
}

export default function Results() {
  const [searchParams] = useSearchParams();
  const requestedSeason = searchParams.get("season");
  const requestedWeek = searchParams.get("week");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meta, setMeta] = useState({ season: null, week: null, isCurrent: true });
  const [games, setGames] = useState([]);
  const [deadline, setDeadline] = useState(null);

  const [activeParticipants, setActiveParticipants] = useState([]); // [user_name]
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});
  const [picksRows, setPicksRows] = useState([]); // { user_name, game_id, pick }
  const [bonusPicksRows, setBonusPicksRows] = useState([]); // { user_name, game_id, category, pick }
  const [tbGameIds, setTbGameIds] = useState([]); // 3 ids
  const [tbRows, setTbRows] = useState([]); // { user_name, tb_no, game_id, total }
  const [gameResultsRows, setGameResultsRows] = useState([]); // { game_id, status, away_score, home_score }
  const [leaderboardRows, setLeaderboardRows] = useState([]); // { user_name, points }

  const [nowTs, setNowTs] = useState(() => Date.now());

  // tick so the page can auto-switch from “hidden” to “shown”
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      // 1) Get the requested week/season from server (defaults to whatever's current)
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
      setActiveParticipants(Array.isArray(data.activeParticipants) ? data.activeParticipants : []);

      // 1b) Usernames/avatars for display (falls back to full name / initials
      // if this fails -- never block the table on it)
      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setUsernameByFullName(d.usernames || {});
            setAvatarByFullName(d.avatars || {});
          }
        })
        .catch(() => {});

      // 2) Get games for this week (so table columns are correct)
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, season, week, away, home, kickoff")
        .eq("season", season)
        .eq("week", week)
        .order("kickoff", { ascending: true });

      if (gErr) throw gErr;
      setGames(g || []);

      // 3) week_meta for deadline + tiebreakers
      const { data: wm, error: wmErr } = await supabase
        .from("week_meta")
        .select("deadline, tiebreakers")
        .eq("season", season)
        .eq("week", week)
        .maybeSingle();

      if (wmErr) throw wmErr;

      setDeadline(wm?.deadline || null);

      const tbIds = Array.isArray(wm?.tiebreakers) ? wm.tiebreakers.slice(0, 3).map(String) : [];
      setTbGameIds(tbIds);

      // 4) picks for this week (try season column first; fallback if table doesn’t have it)
      let picks = [];
      {
        const q1 = await supabase.from("picks").select("user_name, game_id, pick").eq("season", season).eq("week", week);
        if (!q1.error) {
          picks = q1.data || [];
        } else {
          const q2 = await supabase.from("picks").select("user_name, game_id, pick").eq("week", week);
          if (q2.error) throw q2.error;
          picks = q2.data || [];
        }
      }
      setPicksRows(picks);

      // 4b) bonus (passing/rushing yardage) picks for this week
      const { data: bp, error: bpErr } = await supabase
        .from("bonus_picks")
        .select("user_name, game_id, category, pick")
        .eq("week", week);

      if (bpErr) {
        console.warn("bonus_picks load warning:", bpErr);
        setBonusPicksRows([]);
      } else {
        setBonusPicksRows(bp || []);
      }

      // 5) tiebreakers guesses (optional—only if you want the TB columns like your screenshot)
      // If your tiebreakers table doesn’t have season, we filter by week only (same as current code base)
      const { data: tb, error: tbErr } = await supabase
        .from("tiebreakers")
        .select("user_name, tb_no, game_id, total")
        .eq("week", week);

      if (tbErr) {
        // Non-fatal (table can still work)
        console.warn("tiebreakers load warning:", tbErr);
        setTbRows([]);
      } else {
        setTbRows(tb || []);
      }

      // 6) game results (for the green "correct pick" border/checkmark -- only
      // meaningful once a game is FINAL, i.e. the results processor has run)
      const { data: gr, error: grErr } = await supabase
        .from("game_results")
        .select("game_id, status, away_score, home_score, passing_winner, rushing_winner")
        .eq("season", season)
        .eq("week", week);

      if (grErr) {
        console.warn("game_results load warning:", grErr);
        setGameResultsRows([]);
      } else {
        setGameResultsRows(gr || []);
      }

      // 7) leaderboard points (already-scored totals -- reused as-is rather
      // than re-deriving points here, so this always matches the Leaderboard page)
      const { data: lb, error: lbErr } = await supabase
        .from("leaderboard")
        .select("user_name, points")
        .eq("season", season)
        .eq("week", week);

      if (lbErr) {
        console.warn("leaderboard load warning:", lbErr);
        setLeaderboardRows([]);
      } else {
        setLeaderboardRows(lb || []);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSeason, requestedWeek]);

  // realtime refresh if picks change (only meaningful for the live current week --
  // a historical week's rows never change, so skip opening channels for it)
  useEffect(() => {
    if (!meta.season || !meta.week || !meta.isCurrent) return;

    const pCh = supabase
      .channel("results_picks_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    const bpCh = supabase
      .channel("results_bonus_picks_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bonus_picks", filter: `week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    const wmCh = supabase
      .channel("results_week_meta_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "week_meta", filter: `season=eq.${meta.season},week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    // Refresh when the results processor runs, so the correct-pick borders
    // and points column appear live without a manual page reload
    const grCh = supabase
      .channel("results_game_results_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_results", filter: `week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    const lbCh = supabase
      .channel("results_leaderboard_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard", filter: `week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pCh);
      supabase.removeChannel(bpCh);
      supabase.removeChannel(wmCh);
      supabase.removeChannel(grCh);
      supabase.removeChannel(lbCh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week, meta.isCurrent]);

  // True once the global weekly deadline has passed
  const deadlineLocked = useMemo(
    () => isDeadlinePassed(deadline, nowTs),
    [deadline, nowTs]
  );

  // Set of game IDs whose picks are now visible (locked 1 hr before kickoff, or deadline passed)
  const lockedGameIds = useMemo(() => {
    const s = new Set();
    for (const g of games) {
      if (deadlineLocked || isGameLockedNow(g, nowTs)) s.add(String(g.id));
    }
    return s;
  }, [games, deadlineLocked, nowTs]);

  // Table frame appears as soon as ANY game has locked
  const isAnyLocked = deadlineLocked || lockedGameIds.size > 0;

  // ---- Build table model ----
  const gameById = useMemo(() => {
    const m = {};
    for (const g of games || []) m[String(g.id)] = g;
    return m;
  }, [games]);

  // Display label for a user -- their login username when known, else their
  // full name (join key stays full_name everywhere else, this is display-only)
  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  const users = useMemo(() => {
    const set = new Set();
    // Every active participant gets a row, even with zero picks -- otherwise
    // someone who never submitted just doesn't appear at all, instead of
    // showing up as a full row of "no pick" placeholders.
    for (const u of activeParticipants || []) {
      const name = String(u || "").trim();
      if (name) set.add(name);
    }
    for (const r of picksRows || []) {
      const u = String(r.user_name || "").trim();
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => dispName(a).localeCompare(dispName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParticipants, picksRows, usernameByFullName]);

  const pickByUserGame = useMemo(() => {
    const m = {}; // m[user][gameId] = pick
    for (const r of picksRows || []) {
      const u = String(r.user_name || "").trim();
      const gid = String(r.game_id || "").trim();
      const pick = String(r.pick || "").trim();
      if (!u || !gid) continue;
      if (!m[u]) m[u] = {};
      m[u][gid] = pick;
    }
    return m;
  }, [picksRows]);

  const bonusPickByUserGame = useMemo(() => {
    const m = {}; // m[user][gameId] = { passing_yards, rushing_yards }
    for (const r of bonusPicksRows || []) {
      const u = String(r.user_name || "").trim();
      const gid = String(r.game_id || "").trim();
      if (!u || !gid) continue;
      ((m[u] ||= {})[gid] ||= {})[r.category] = String(r.pick || "").trim();
    }
    return m;
  }, [bonusPicksRows]);

  const tbByUserNo = useMemo(() => {
    const m = {}; // m[user][tbNo] = total
    for (const r of tbRows || []) {
      const u = String(r.user_name || "").trim();
      const no = Number(r.tb_no);
      if (!u || ![1, 2, 3].includes(no)) continue;
      if (!m[u]) m[u] = {};
      m[u][no] = r.total;
    }
    return m;
  }, [tbRows]);

  // gid -> { status, winnerSide, passingWinner, rushingWinner } -- winnerSide/
  // passingWinner/rushingWinner only set once status is FINAL, i.e. the
  // results processor has scored this specific game
  const gameResultByGid = useMemo(() => {
    const m = {};
    for (const r of gameResultsRows || []) {
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
        // PUSH (exact tie) leaves these null -- nobody's bonus pick can be "correct"
        const pw = String(r.passing_winner || "").toUpperCase();
        const rw = String(r.rushing_winner || "").toUpperCase();
        if (pw === "AWAY" || pw === "HOME") passingWinner = pw;
        if (rw === "AWAY" || rw === "HOME") rushingWinner = rw;
      }
      m[gid] = { status, winnerSide, passingWinner, rushingWinner };
    }
    return m;
  }, [gameResultsRows]);

  // user_name -> points, from the already-scored leaderboard (reused as-is
  // rather than re-deriving totals here, so this always matches Leaderboard.jsx)
  const pointsByUser = useMemo(() => {
    const m = {};
    for (const r of leaderboardRows || []) {
      const u = String(r.user_name || "").trim();
      if (!u) continue;
      m[u] = Number(r.points);
    }
    return m;
  }, [leaderboardRows]);

  // helper: render the small passing/rushing bonus-pick badges below a pick cell
  function renderBonusBadges(userName, gid) {
    const picks = bonusPickByUserGame?.[userName]?.[gid];
    const g = gameById[gid];
    if (!picks || !g) return null;

    const gr = gameResultByGid[gid];

    const badge = (raw, color, label, letter, categoryWinner) => {
      const pick = String(raw || "").toUpperCase();
      const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
      if (!team) return null;
      const src = logoSrc(team);
      const correct = !!categoryWinner && pick === categoryWinner;

      return (
        <div
          key={label}
          style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: "0 2px" }}
        >
          <span style={correct ? styles.correctWrapSmall : styles.plainWrap}>
            <span
              title={correct ? `${label}: ${team} — correct!` : `${label}: ${team}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                border: `2px solid ${color}`,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {src && (
                <img
                  src={src}
                  alt={team}
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </span>
            {correct && <span style={styles.correctCheckSmall}>✓</span>}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: 0.5, marginTop: 1 }}>{letter}</span>
        </div>
      );
    };

    return (
      <div style={{ marginTop: 3 }}>
        {badge(picks.passing_yards, "#7c3aed", "Passing", "P", gr?.passingWinner)}
        {badge(picks.rushing_yards, "#ea580c", "Rushing", "R", gr?.rushingWinner)}
      </div>
    );
  }

  // helper: render a pick cell (logo)
  function renderPickCell(userName, gid) {
    const raw = pickByUserGame?.[userName]?.[gid];
    const pick = String(raw || "").toUpperCase();
    const g = gameById[gid];

    const winnerLabel = (
      <div style={{ fontSize: 9, fontWeight: 800, color: "#999", letterSpacing: 0.5, marginBottom: 2 }}>W</div>
    );

    // Only mark a pick "correct" once this specific game is FINAL (the
    // results processor has scored it) -- distinct from just "locked"
    const gr = gameResultByGid[gid];
    const correct = !!pick && !!gr?.winnerSide && pick === gr.winnerSide;
    const correctWrap = correct ? styles.correctWrap : styles.plainWrap;
    const checkBadge = correct ? <span style={styles.correctCheck}>✓</span> : null;

    if (!pick || !g) {
      return (
        <div>
          {winnerLabel}
          <img
            src="/logos/nfl.png"
            alt="No pick"
            title="No pick submitted"
            style={{ width: 42, height: 42, objectFit: "contain", display: "block", margin: "0 auto", opacity: 0.55 }}
          />
        </div>
      );
    }

    if (pick === "TIE")
      return (
        <div>
          {winnerLabel}
          <span style={correctWrap}>
            <span style={styles.tiePill}>TIE</span>
            {checkBadge}
          </span>
        </div>
      );

    // pick is AWAY/HOME
    const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
    const src = team ? logoSrc(team) : null;

    if (!team || !src)
      return (
        <div>
          {winnerLabel}
          <span style={{ fontSize: 12 }}>{team || pick}</span>
        </div>
      );

    return (
      <div>
        {winnerLabel}
        <span style={correctWrap}>
          <img
            src={src}
            alt={team}
            title={correct ? `${team} — correct pick!` : team}
            style={{ width: 42, height: 42, objectFit: "contain", display: "block", margin: "0 auto" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          {checkBadge}
        </span>
      </div>
    );
  }

  if (loading) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  const lockLabel = deadline
    ? `Submission deadline: ${new Date(deadline).toLocaleString()}`
    : "Picks reveal column-by-column as each game locks (1 hr before kickoff)";

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>View Picks Table</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{meta.season}</b> • Week <b>{meta.week}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>{lockLabel}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
            ✅ Green check mark will mark correct picks as soon as data is officially available.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadAll}>
            Refresh
          </Button>
          <Link to="/leaderboard">
            <Button variant="secondary" size="sm">🏆 Leaderboard</Button>
          </Link>
          <Link to="/history">
            <Button variant="secondary" size="sm" pill>📅 Season History</Button>
          </Link>
          <Link to="/">
            <Button variant="dark" size="sm">← Back</Button>
          </Link>
        </div>
      </div>

      {!meta.isCurrent && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(0,0,0,0.03)",
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
          <span>
            📅 Viewing a past week (Season {meta.season}, Week {meta.week}).
          </span>
          <Link to="/results">
            <Button variant="secondary" size="sm">View current week</Button>
          </Link>
        </div>
      )}

      {!isAnyLocked ? (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14, background: "#fff" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>🔒 Picks are hidden until games start locking.</div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
            Each game’s picks will appear here 1 hour before its kickoff. Check back once the first game of the week locks.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thStickyLeft}>#</th>
                  <th style={thStickyName}>Participant</th>
                  <th style={thStickyPoints}>Points</th>

                  {(games || []).map((g, idx) => {
                    const gameLocked = lockedGameIds.has(String(g.id));
                    const lockTime = g.kickoff
                      ? new Date(new Date(g.kickoff).getTime() - 60 * 60 * 1000)
                      : null;
                    return (
                      <th key={g.id} style={th}>
                        Game {idx + 1}
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginTop: 2 }}>
                          {fmtMatchup(g)}
                        </div>
                        {gameLocked ? (
                          <div style={{ fontSize: 10, color: "#b00", marginTop: 3, fontWeight: 700 }}>🔒 LOCKED</div>
                        ) : lockTime ? (
                          <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>
                            Locks {lockTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}

                  {tbGameIds.length === 3 ? (
                    tbGameIds.map((gid, i) => {
                      const g = gameById[gid];
                      const gameLocked = lockedGameIds.has(String(gid));
                      return (
                        <th key={`tb_${i + 1}`} style={th}>
                          TB{i + 1}
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginTop: 2 }}>
                            {g ? fmtMatchup(g) : gid}
                          </div>
                          {gameLocked && (
                            <div style={{ fontSize: 10, color: "#b00", marginTop: 3, fontWeight: 700 }}>🔒 LOCKED</div>
                          )}
                        </th>
                      );
                    })
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={(games?.length || 0) + 3 + (tbGameIds.length === 3 ? 3 : 0)} style={{ padding: 14, color: "#666" }}>
                      No picks found for this week yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <tr key={u} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdNum}>{i + 1}</td>
                      <td style={tdName}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <Avatar username={dispName(u)} avatar={avatarByFullName[u]} size={32} />
                          <span style={nameTextStyle}>{dispName(u)}</span>
                        </div>
                      </td>
                      <td style={tdPoints}>
                        {pointsByUser[u] != null
                          ? (Number.isInteger(pointsByUser[u]) ? pointsByUser[u] : pointsByUser[u].toFixed(1))
                          : <span style={{ color: "#bbb", fontWeight: 400 }}>—</span>}
                      </td>

                      {(games || []).map((g) => {
                        const gameLocked = lockedGameIds.has(String(g.id));
                        return (
                          <td key={`${u}_${g.id}`} style={tdCenter}>
                            {gameLocked
                              ? (
                                <>
                                  {renderPickCell(u, String(g.id))}
                                  {renderBonusBadges(u, String(g.id))}
                                </>
                              )
                              : <span title="Picks hidden until game locks" style={{ color: "#ccc", fontSize: 16 }}>🔒</span>
                            }
                          </td>
                        );
                      })}

                      {tbGameIds.length === 3 ? (
                        [1, 2, 3].map((tbNo) => {
                          const gid = tbGameIds[tbNo - 1];
                          const gameLocked = lockedGameIds.has(String(gid));
                          return (
                            <td key={`${u}_tb_${tbNo}`} style={tdCenter}>
                              {gameLocked
                                ? (tbByUserNo?.[u]?.[tbNo] ?? <span style={{ color: "#999" }}>—</span>)
                                : <span title="Picks hidden until game locks" style={{ color: "#ccc", fontSize: 16 }}>🔒</span>
                              }
                            </td>
                          );
                        })
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#777", textAlign: "center" }}>
            🔒 = picks still hidden (game hasn’t locked yet) &nbsp;·&nbsp; purple-bordered logo = passing-yards bonus pick, orange-bordered logo = rushing-yards bonus pick &nbsp;·&nbsp; ✅ green border + checkmark = correct pick (appears once results are processed) &nbsp;·&nbsp; This table updates automatically as games lock and as results are processed.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- table styles ---------- */
const th = {
  padding: "10px 8px",
  textAlign: "center",
  fontWeight: 900,
  fontSize: 12,
  color: "#111",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const thStickyLeft = {
  ...th,
  position: "sticky",
  left: 0,
  background: "#fff",
  zIndex: 3,
  textAlign: "right",
  width: 42,
};

// Fixed (not just min) width so the Points column's sticky offset next to
// it is always correct -- long usernames are truncated via nameTextStyle
// below instead of growing this column and throwing that offset off.
const NAME_COL_WIDTH = 130;
const POINTS_COL_LEFT = 42 + NAME_COL_WIDTH;

const thStickyName = {
  ...th,
  position: "sticky",
  left: 42,
  background: "#fff",
  zIndex: 3,
  textAlign: "center",
  width: NAME_COL_WIDTH,
};

const thStickyPoints = {
  ...th,
  position: "sticky",
  left: POINTS_COL_LEFT,
  background: "#fff",
  zIndex: 3,
  width: 64,
};

const tdCenter = {
  padding: "10px 8px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdNum = {
  ...tdCenter,
  position: "sticky",
  left: 0,
  background: "#fff",
  zIndex: 2,
  textAlign: "right",
  fontWeight: 800,
  color: "#444",
};

const tdName = {
  ...tdCenter,
  position: "sticky",
  left: 42,
  background: "#fff",
  zIndex: 2,
  textAlign: "center",
  fontWeight: 800,
  width: NAME_COL_WIDTH,
};

// box-sizing is border-box app-wide (index.html), so NAME_COL_WIDTH already
// includes tdCenter's 8px-each-side padding -- subtract the full 16px to
// get the actual available content width, or a long username could still
// push this column wider than POINTS_COL_LEFT expects.
const nameTextStyle = {
  display: "block",
  maxWidth: NAME_COL_WIDTH - 16,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tdPoints = {
  ...tdCenter,
  position: "sticky",
  left: POINTS_COL_LEFT,
  background: "#fff",
  zIndex: 2,
  width: 64,
  fontWeight: 900,
  color: "#b8860b",
  fontSize: 14,
};

const styles = {
  tiePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    minWidth: 28,
    padding: "0 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    color: "#111",
    fontSize: 12,
    fontWeight: 800,
  },
  plainWrap: {
    position: "relative",
    display: "inline-block",
  },
  correctWrap: {
    position: "relative",
    display: "inline-block",
    border: "3px solid #16a34a",
    borderRadius: 10,
    background: "rgba(22,163,74,0.10)",
    padding: 2,
  },
  correctCheck: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#16a34a",
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    lineHeight: 1,
  },
  correctWrapSmall: {
    position: "relative",
    display: "inline-block",
    border: "2px solid #16a34a",
    borderRadius: 6,
    background: "rgba(22,163,74,0.10)",
    padding: 1,
  },
  correctCheckSmall: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#16a34a",
    color: "#fff",
    fontSize: 8,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
    lineHeight: 1,
  },
};