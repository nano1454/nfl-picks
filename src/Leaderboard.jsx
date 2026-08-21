import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";
import Avatar from "./Avatar";

/* ---------- Logos map (same keys as your games.away/home full names) ---------- */
const teamLogoSlug = {
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

function logoSrc(team) {
  const slug = teamLogoSlug[team];
  return slug ? `/logos/${slug}.png` : null;
}

function LeaderboardTitle() {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        padding: "26px 20px",
        textAlign: "center",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 55%, #000 100%)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,215,0,0.25)",
      }}
    >
      <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 4 }}>🏆</div>
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(32px, 6vw, 52px)",
          fontWeight: 900,
          letterSpacing: 1,
          fontFamily: "system-ui, sans-serif",
          background: "linear-gradient(180deg, #fff7d6 0%, #ffd700 45%, #b8860b 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        Leaderboard
      </h1>
      <div
        style={{
          width: 140,
          height: 3,
          margin: "10px auto 0",
          borderRadius: 2,
          background: "linear-gradient(90deg, transparent, #ffd700, transparent)",
        }}
      />
    </div>
  );
}

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
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});

  // Tiebreak watch state
  const [tbWatch, setTbWatch] = useState(null);

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

      // 2) Load leaderboard rows for that season/week
      const { data: lb, error } = await supabase
        .from("leaderboard")
        .select("user_name, points, correct_picks, games_final_count, updated_at")
        .eq("season", season)
        .eq("week", week)
        .order("points", { ascending: false })
        .order("user_name", { ascending: true });

      if (error) throw error;

      setRows(lb || []);
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

      const tbGameIds = Array.isArray(metaRow?.tiebreakers) ? metaRow.tiebreakers.slice(0, 3).map(String) : [];
      if (tbGameIds.length < 3) {
        setTbWatch({
          applicable: true,
          maxPoints,
          tiedUsers,
          error: "week_meta.tiebreakers missing/invalid (need 3 game_ids).",
          tbGameIds,
        });
        return;
      }

      // 1b) Load games metadata so we can show logos + "@" in the panel
      const { data: tbGames, error: tbGamesErr } = await supabase
        .from("games")
        .select("id, away, home")
        .eq("season", season)
        .eq("week", week)
        .in("id", tbGameIds);

      if (tbGamesErr) throw tbGamesErr;

      const gameMetaById = {};
      for (const g of tbGames || []) {
        gameMetaById[String(g.id)] = { away: g.away, home: g.home };
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

      function evalTB(tbNo, gameId, currentUsers) {
        const r = resultByGame[String(gameId)];
        const isFinal = String(r?.status || "").toUpperCase() === "FINAL";
        const hs = isFinal ? Number(r?.home_score) : null;
        const as = isFinal ? Number(r?.away_score) : null;
        const actual = isFinal && Number.isFinite(hs) && Number.isFinite(as) ? hs + as : null;

        const rows = currentUsers.map((u) => {
          const guess = guessByUser?.[u]?.[tbNo];
          const hasGuess = Number.isFinite(guess);
          const busted = actual === null ? null : hasGuess ? guess > actual : null;
          const eligible = actual === null ? false : hasGuess ? guess <= actual : false;
          const diff = actual === null ? null : eligible ? actual - guess : null;

          return {
            user_name: u,
            guess: hasGuess ? guess : null,
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
          return {
            tbNo,
            gameId,
            isFinal: true,
            actual,
            rows,
            status: "NO_ELIGIBLE_ALL_BUSTED",
            bestUsers: currentUsers,
          };
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

      let remaining = [...tiedUsers];
      const perTB = [];
      let decidedBy = "PENDING";
      let winners = remaining;

      for (let i = 0; i < 3; i++) {
        const tbNo = i + 1;
        const gid = tbGameIds[i];

        const res = evalTB(tbNo, gid, remaining);

        const gm = gameMetaById[String(gid)] || null;
        perTB.push({
          ...res,
          away: gm?.away || null,
          home: gm?.home || null,
        });

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
      }

      const allTBFinal = perTB.length === 3 && perTB.every((x) => x.isFinal);
      if (decidedBy !== "PENDING" && winners.length > 1 && allTBFinal) {
        const { data: seasonLb, error: seasonErr } = await supabase
          .from("leaderboard")
          .select("user_name, week, points")
          .eq("season", season)
          .lte("week", week)
          .in("user_name", winners);

        if (!seasonErr) {
          const seasonTotals = {};
          for (const u of winners) seasonTotals[u] = 0;
          for (const r of seasonLb || []) {
            const u = String(r.user_name || "").trim();
            const pts = Number(r.points || 0);
            if (!u || !Number.isFinite(pts)) continue;
            if (seasonTotals[u] === undefined) seasonTotals[u] = 0;
            seasonTotals[u] += pts;
          }

          const maxSeasonPts = Math.max(...Object.values(seasonTotals).map((n) => Number(n || 0)));
          const bestSeason = winners.filter((u) => Number(seasonTotals[u] || 0) === maxSeasonPts);

          if (bestSeason.length === 1) {
            decidedBy = "SEASON_POINTS";
            winners = bestSeason;
          } else {
            decidedBy = "SPLIT";
            winners = bestSeason;
          }

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
          return;
        }
      }

      setTbWatch({
        applicable: true,
        maxPoints,
        tiedUsers,
        tbGameIds,
        perTB,
        decidedBy,
        winners,
        seasonTotals: null,
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
        () => loadTiebreakWatch(meta.season, meta.week, rows)
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

  // Total points available for the week: 1 pt per FINAL game (winner) + 0.5
  // each for the passing/rushing bonus picks on that game.
  const totalAvailablePoints = useMemo(() => {
    const gamesFinal = Math.max(0, ...(rows || []).map((r) => Number(r.games_final_count || 0)));
    return gamesFinal * 2;
  }, [rows]);

  if (loading) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>Loading leaderboard…</div>;
  if (err) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <style>{`
        @keyframes lbBarShimmer { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
      `}</style>

      <LeaderboardTitle />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ color: "#555", fontSize: 14 }}>
          Season <b style={{ color: "#111" }}>{meta.season}</b> • Week <b style={{ color: "#111" }}>{meta.week}</b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PillButton onClick={loadMetaAndLeaderboard}>Refresh</PillButton>
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
            </div>
          </div>

          <RaceList rows={rows} totalAvailable={totalAvailablePoints} dispName={dispName} avatarByFullName={avatarByFullName} />

          {/* Tiebreak Watch BELOW the bars */}
          {tbWatch?.applicable ? <TiebreakWatchPanel tbWatch={tbWatch} dispName={dispName} /> : null}
        </div>
      )}
    </div>
  );
}

/* ---------------- Horse race list (animated reorder via FLIP) ---------------- */
function RaceList({ rows, totalAvailable, dispName, avatarByFullName }) {
  const itemRefs = useRef(new Map()); // key -> element
  const lastRectsRef = useRef(new Map()); // key -> DOMRect

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
        const pct = max > 0 ? Math.max(2, Math.min(100, (points / max) * 100)) : 0;
        const medal = medalStyle[idx];

        return (
          <div
            key={r.user_name}
            ref={(el) => {
              if (!el) return;
              itemRefs.current.set(String(r.user_name), el);
            }}
            style={{
              border: idx === 0 ? "1px solid rgba(184,134,11,0.5)" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              display: "flex",
              gap: 12,
              alignItems: "center",
              background: "#fff",
              boxShadow: idx === 0 ? "0 4px 18px rgba(184,134,11,0.18)" : "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
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

            <div style={{ width: 220, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Avatar username={dispName(r.user_name)} avatar={avatarByFullName?.[r.user_name]} size={40} />
              <div style={{ fontWeight: 800, color: "#111" }}>{dispName(r.user_name)}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ height: 16, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #111 0%, #7a5c14 55%, #ffd700 100%)",
                    transition: "width 650ms cubic-bezier(0.2, 0.9, 0.2, 1)",
                    position: "relative",
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
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                {max > 0 ? `${Math.round(pct)}% of points available` : ""}
              </div>
            </div>

            <div style={{ width: 90, textAlign: "right", fontWeight: 900, fontSize: 18, color: idx === 0 ? "#b8860b" : "#111" }}>
              {Number(points).toFixed(1)}
            </div>
          </div>
        );
      })}
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
      ? "Decided by season points"
      : tbWatch.decidedBy === "SPLIT"
      ? "Still tied — split winnings"
      : `Decided by ${tbWatch.decidedBy}`;

  const logoBox = { width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center" };
  const logoImg = { width: 24, height: 24, objectFit: "contain", display: "block" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>⚖️ Tiebreak Watch</div>
          <div style={{ color: "#555", marginTop: 2 }}>
            Tie for 1st at <b>{tbWatch.maxPoints}</b> points: <b>{tbWatch.tiedUsers.map(dispName).join(", ")}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
            Status: <b>{decidedLabel}</b>
          </div>
        </div>

        <div style={{ alignSelf: "flex-end", fontSize: 13 }}>
          Current winner{(tbWatch.winners || []).length > 1 ? "s" : ""}: <b>{(tbWatch.winners || []).map(dispName).join(", ")}</b>
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
                      const status =
                        tb.actual === null
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
                          <td style={td}>{r.guess ?? "—"}</td>
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
                {tb.status === "NO_ELIGIBLE_ALL_BUSTED" && "Everyone busted on this tiebreak → moving to the next one."}
                {tb.status === "TIED_CONTINUE" && `Still tied → advancing: ${(tb.bestUsers || []).map(dispName).join(", ")}`}
                {tb.status === "DECIDED" && `Winner decided here: ${(tb.bestUsers || []).map(dispName).join(", ")}`}
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