import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

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

function LeaderboardHeader() {
  const sc = 0.7;
  const sceneW = Math.round(760 * sc);
  const sceneH = Math.round(340 * sc);

  const sparks = useMemo(() => {
    const colors = ['#1a3a6e', '#0d2550', '#ffcc00', '#071830', '#2a5298', '#fff', '#ffd700'];
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360;
      const x = Math.cos(angle * Math.PI / 180) * 180 * sc;
      const y = Math.sin(angle * Math.PI / 180) * 70 * sc;
      return {
        angle, x, y,
        h: (14 + (i % 5) * 6) * sc,
        color: colors[i % colors.length],
        delay: (i / 24) * 1.9,
        duration: 1.1 + (i % 3) * 0.3,
      };
    });
  }, []);

  const embers = useMemo(() => {
    const colors = ['#1a3a6e', '#0d2550', '#ffcc00', '#071830', '#2a5298', '#fff', '#ffd700'];
    return Array.from({ length: 28 }, (_, i) => ({
      s: (2 + (i % 4)) * sc,
      x: (30 + (i / 28) * 700) * sc,
      y: (60 + (i % 7) * 31) * sc,
      dx: ((i % 2 === 0 ? 1 : -1) * (10 + i * 3)) * sc,
      dur: 1.4 + (i % 4) * 0.55,
      color: colors[i % colors.length],
      delay: (i / 28) * 2.5,
    }));
  }, []);

  const bolts = useMemo(() =>
    [10, 55, 100, 155, 210, 265, 310, 355].map((angle, i) => ({
      angle,
      len: (55 + (i % 4) * 22) * sc,
      delay: i * 0.35,
      duration: 2.2 + (i % 3) * 0.45,
    }))
  , []);

  const rings = [
    { w: 340*sc, h: 120*sc, color: 'rgba(13,37,80,0.9)',   delay: 0 },
    { w: 480*sc, h: 170*sc, color: 'rgba(26,58,110,0.65)', delay: 0.45 },
    { w: 620*sc, h: 220*sc, color: 'rgba(255,200,0,0.35)', delay: 0.9 },
    { w: 760*sc, h: 270*sc, color: 'rgba(13,37,80,0.25)',  delay: 1.35 },
  ];

  return (
    <div style={{ position: 'relative', width: sceneW, maxWidth: '100%', height: sceneH, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', margin: '0 auto' }}>
      {/* Burst rays */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'lbBurstSpin 16s linear infinite' }}>
        <svg viewBox="0 0 1000 580" style={{ width: '100%', height: '100%', position: 'absolute' }}>
          <defs>
            <radialGradient id="lbRayGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#1a3a6e" stopOpacity="0.9" />
              <stop offset="40%"  stopColor="#0d2550" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#071830" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="translate(500,290)" fill="url(#lbRayGrad)">
            {Array.from({ length: 30 }, (_, i) => (
              <polygon key={i} points="0,-10 6,-320 -6,-320" transform={`rotate(${i * 12})`} opacity={i % 2 === 0 ? 0.95 : 0.55} />
            ))}
          </g>
        </svg>
      </div>

      {/* Elliptical rings */}
      {rings.map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r.w, height: r.h,
          borderRadius: '50%', border: `2px solid ${r.color}`,
          animation: `lbRingPulse 2.2s ease-out ${r.delay}s infinite`,
        }} />
      ))}

      {/* Sparks */}
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 3, height: s.h, borderRadius: 2,
          left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)`,
          background: `linear-gradient(to top, transparent, ${s.color})`,
          transform: `rotate(${s.angle + 90}deg)`, transformOrigin: 'center bottom',
          animation: `lbSparkFly ${s.duration}s ${s.delay}s ease-out infinite`,
        }} />
      ))}

      {/* Embers */}
      {embers.map((em, i) => (
        <div key={i} style={{
          position: 'absolute', width: em.s, height: em.s, borderRadius: '50%',
          left: em.x, top: em.y, background: em.color,
          '--lb-dx': `${em.dx}px`,
          boxShadow: `0 0 ${em.s * 2}px ${em.color}`,
          animation: `lbEmberFloat ${em.dur}s ${em.delay}s linear infinite`,
        }} />
      ))}

      {/* Lightning */}
      {bolts.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%', width: 2, height: b.len,
          transform: `translate(-50%, -${b.len}px) rotate(${b.angle}deg)`,
          transformOrigin: 'top center',
          background: 'linear-gradient(to bottom, #fff, #ffcc00, rgba(26,58,110,0))',
          boxShadow: '0 0 6px #ffcc00, 0 0 12px #1a3a6e',
          animation: `lbBoltFlash ${b.duration}s ${b.delay}s ease-in-out infinite`,
          opacity: 0, zIndex: 5,
        }} />
      ))}

      {/* Center flare */}
      <div style={{
        position: 'absolute', width: 120*sc, height: 60*sc, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(255,220,100,0.85) 0%, rgba(13,37,80,0.5) 40%, transparent 70%)',
        zIndex: 8, animation: 'lbFlareBreath 1.6s ease-in-out infinite', mixBlendMode: 'screen',
      }} />

      {/* Text */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div style={{
          position: 'absolute', top: -28*sc, left: '50%', transform: 'translateX(-50%)',
          fontSize: 36*sc,
          filter: 'drop-shadow(0 0 10px #ffcc00) drop-shadow(0 0 20px #ff6600)',
          animation: 'lbCrownBob 2s ease-in-out infinite',
        }}>🏆</div>

        <span style={{
          fontFamily: "'Black Ops One', sans-serif",
          fontSize: `clamp(26px, 8vw, ${96*sc}px)`, lineHeight: 1, letterSpacing: 2, whiteSpace: 'nowrap',
          color: '#fff', userSelect: 'none', display: 'block',
          textShadow: `
            0 0 20px #fff, 0 0 40px #1a3a6e, 0 0 70px #0d2550, 0 0 110px #071830,
            2px 2px 0 #0f2d5e, 4px 4px 0 #0c2550, 6px 6px 0 #091d40,
            8px 8px 0 #061530, 10px 10px 0 #040e20, 12px 12px 0 #020810,
            -1px -1px 0 #ffcc00, 14px 18px 32px rgba(0,0,0,0.95)
          `,
          animation: 'lbFloat 3.2s ease-in-out infinite, lbPulse 1.6s ease-in-out infinite',
        }}>Leaderboard</span>

        <div style={{
          position: 'absolute', bottom: -14*sc, left: '50%', transform: 'translateX(-50%)',
          width: '85%', height: 4,
          background: 'linear-gradient(90deg, transparent, #1a3a6e, #ffcc00, #1a3a6e, transparent)',
          borderRadius: 2, zIndex: 11,
          animation: 'lbBarGlow 1.6s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState({ season: null, week: null });
  const [rows, setRows] = useState([]);

  // Tiebreak watch state
  const [tbWatch, setTbWatch] = useState(null);

  async function loadMetaAndLeaderboard() {
    setLoading(true);
    setErr("");
    try {
      // 1) Ask server what the CURRENT week is
      const res = await fetch("/.netlify/functions/getweek", { cache: "no-store" });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`getweek returned non-JSON (HTTP ${res.status}): ${text.slice(0, 140)}`);
      }

      if (!res.ok || !data.ok) throw new Error(data?.error || `Could not load current week (HTTP ${res.status})`);

      const season = Number(data.season);
      const week = Number(data.week);

      setMeta({ season, week });

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
  }, []);

  // whenever meta/rows change, refresh tiebreak watch
  useEffect(() => {
    if (!meta.season || !meta.week) return;
    loadTiebreakWatch(meta.season, meta.week, rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week, rows]);

  // realtime refresh whenever leaderboard / game_results / tiebreakers changes
  useEffect(() => {
    if (!meta.season || !meta.week) return;

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
  }, [meta.season, meta.week]);

  const hasPoints = useMemo(() => (rows || []).some((r) => Number(r.points || 0) > 0), [rows]);

  // Horse race scaling: leader is 100%, everyone else proportional
  const leaderPoints = useMemo(() => {
    const max = Math.max(...(rows || []).map((r) => Number(r.points || 0)));
    return Number.isFinite(max) && max > 0 ? max : 0;
  }, [rows]);

  if (loading) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>Loading leaderboard…</div>;
  if (err) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap');
        @keyframes lbBurstSpin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lbRingPulse  { 0% { transform: scale(0.55); opacity: 1; } 100% { transform: scale(1.35); opacity: 0; } }
        @keyframes lbSparkFly   { 0% { opacity: 1; transform: scaleY(1) translateY(0); } 100% { opacity: 0; transform: scaleY(0.2) translateY(-${Math.round(130*0.7)}px); } }
        @keyframes lbFloat      { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-5px) scale(1.015); } }
        @keyframes lbPulse      { 0%, 100% { filter: brightness(1) drop-shadow(0 0 14px #1a3a6e) drop-shadow(0 0 38px #0d2550); } 50% { filter: brightness(1.22) drop-shadow(0 0 24px #ffcc00) drop-shadow(0 0 60px #1a3a6e); } }
        @keyframes lbBoltFlash  { 0%, 84%, 100% { opacity: 0; } 87%, 91% { opacity: 1; } }
        @keyframes lbEmberFloat { 0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; } 100% { transform: translateY(-154px) translateX(var(--lb-dx)) scale(0); opacity: 0; } }
        @keyframes lbFlareBreath{ 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.6); opacity: 1; } }
        @keyframes lbCrownBob   { 0%, 100% { transform: translateX(-50%) translateY(0) scale(1); } 50% { transform: translateX(-50%) translateY(-5px) scale(1.08); } }
        @keyframes lbBarGlow    { 0%, 100% { opacity: 0.7; box-shadow: 0 0 8px #1a3a6e; } 50% { opacity: 1; box-shadow: 0 0 20px #ffcc00, 0 0 40px #1a3a6e; } }
        @keyframes lbBarShimmer { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
      `}</style>

      <LeaderboardHeader />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div style={{ color: "#555" }}>
          Season <b>{meta.season}</b> • Week <b>{meta.week}</b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadMetaAndLeaderboard} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Refresh
          </button>
          <Link to="/">
            <button style={{ padding: "8px 12px", cursor: "pointer" }}>← Back</button>
          </Link>
        </div>
      </div>

      {!hasPoints ? (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
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
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 14,
              background: "rgba(0,0,0,0.02)",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Points Tracker</div>
            <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
              Live rankings based on completed games.
            </div>
          </div>

          <RaceList rows={rows} leaderPoints={leaderPoints} />

          {/* Tiebreak Watch BELOW the bars */}
          {tbWatch?.applicable ? <TiebreakWatchPanel tbWatch={tbWatch} /> : null}
        </div>
      )}
    </div>
  );
}

/* ---------------- Horse race list (animated reorder via FLIP) ---------------- */
function RaceList({ rows, leaderPoints }) {
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

  const max = leaderPoints || 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r, idx) => {
        const points = Number(r.points || 0);
        const pct = max > 0 ? Math.max(2, Math.min(100, (points / max) * 100)) : 0;

        return (
          <div
            key={r.user_name}
            ref={(el) => {
              if (!el) return;
              itemRefs.current.set(String(r.user_name), el);
            }}
            style={{
              border: "1px solid #ddd",
              borderRadius: 14,
              padding: 12,
              display: "flex",
              gap: 12,
              alignItems: "center",
              background: "#fff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ width: 34, textAlign: "right", fontWeight: 900, color: "#444" }}>#{idx + 1}</div>

            <div style={{ width: 220, fontWeight: 800 }}>{r.user_name}</div>

            <div style={{ flex: 1 }}>
              <div style={{ height: 16, background: "#eee", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "#0d2550",
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
                {max > 0 ? `${Math.round(pct)}% of leader` : ""}
              </div>
            </div>

            <div style={{ width: 90, textAlign: "right", fontWeight: 900, fontSize: 18 }}>
              {Number(points).toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Tiebreak watch panel ---------------- */
function TiebreakWatchPanel({ tbWatch }) {
  const card = {
    marginTop: 16,
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 14,
    background: "rgba(0,0,0,0.02)",
  };

  if (tbWatch?.error) {
    return (
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Tiebreak Watch</div>
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
          <div style={{ fontWeight: 900, fontSize: 16 }}>Tiebreak Watch</div>
          <div style={{ color: "#555", marginTop: 2 }}>
            Tie for 1st at <b>{tbWatch.maxPoints}</b> points: <b>{tbWatch.tiedUsers.join(", ")}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
            Status: <b>{decidedLabel}</b>
          </div>
        </div>

        <div style={{ alignSelf: "flex-end", fontSize: 13 }}>
          Current winner{(tbWatch.winners || []).length > 1 ? "s" : ""}: <b>{(tbWatch.winners || []).join(", ")}</b>
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
                            <b>{r.user_name}</b>
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
                {tb.status === "TIED_CONTINUE" && `Still tied → advancing: ${(tb.bestUsers || []).join(", ")}`}
                {tb.status === "DECIDED" && `Winner decided here: ${(tb.bestUsers || []).join(", ")}`}
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
              {u}: <b>{pts}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const th = { padding: "8px 6px", fontWeight: 800, color: "#333", whiteSpace: "nowrap" };
const td = { padding: "8px 6px", whiteSpace: "nowrap" };