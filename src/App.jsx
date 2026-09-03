import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import { getSession, clearSession } from "./auth";
import { pageBackgroundStyle } from "./backgroundStyle";
import Button from "./Button";
import Avatar from "./Avatar";
import { calcPot, countPickParticipants } from "./potCalc";

/* ---------- Styles (MUST be above App so useState can reference it) ---------- */
const styles = {
  pageOverlay: {
    maxWidth: 920,
    width: "100%",
    margin: "24px auto",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    padding: 20,
    color: "#000",
  },

  // Header-ish row
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  headerLeft: { minWidth: 260 },
  headerRight: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  card: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
  },
  h1: { fontSize: 28, fontWeight: 800, margin: "0 0 4px", letterSpacing: 0.2 },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  muted: { color: "rgba(0,0,0,0.75)", margin: "0 0 0" },
  mutedSmall: { color: "rgba(0,0,0,0.75)", fontSize: 13, margin: "4px 0 12px" },

  input: {
    padding: "10px 12px",
    border: "1px solid #9ca3af",
    borderRadius: 8,
    background: "#333",
    color: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },

  radioActual: { position: "absolute", opacity: 0, pointerEvents: "none" },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },

  /* ================= Dark "Make Your Pick" modal ================= */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 100,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 22,
    padding: "20px 20px 24px",
    background: "linear-gradient(160deg, #0c0c0c 0%, #1c1c1c 60%, #0a0a0a 100%)",
    border: "1px solid rgba(255,215,0,0.3)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,215,0,0.08)",
    color: "#fff",
  },
  modalHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalHeaderLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#ffd700",
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.6)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    padding: 4,
  },

  // Step progress strip (dark)
  stepStrip: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.65)",
  },
  stepDotAnswered: {
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.6)",
    color: "#7CFB9B",
  },
  stepDotLocked: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.3)",
  },
  stepDotCurrent: {
    boxShadow: "0 0 0 3px rgba(255,215,0,0.4)",
    transform: "scale(1.08)",
  },

  screenWrap: { display: "grid", gap: 4 },
  wizardFooter: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 18,
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionDividerWrap: { display: "flex", alignItems: "center", gap: 8, margin: "16px 0 10px" },
  sectionDividerLine: { flex: 1, height: 1, background: "rgba(255,215,0,0.25)" },
  sectionDividerLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(255,215,0,0.85)",
    whiteSpace: "nowrap",
  },

  teamPillWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
  },
  teamPillCaption: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  teamPill: {
    position: "relative",
    width: "100%",
    height: 64,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    transition: "transform 0.15s, box-shadow 0.2s",
    overflow: "hidden",
  },
  teamPillSelected: {
    boxShadow: "0 4px 14px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,215,0,0.55), 0 0 22px rgba(255,215,0,0.35)",
    transform: "scale(1.04)",
  },
  teamPillDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  teamPillLogo: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 100,
    height: 100,
    objectFit: "contain",
    zIndex: 2,
    pointerEvents: "none",
  },

  spreadPillGroup: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  spreadPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    transition: "background 0.2s, border-color 0.2s, transform 0.1s, box-shadow 0.2s",
  },
  spreadPillSelected: {
    border: "2px solid #ffd700",
    background: "rgba(255,215,0,0.15)",
    boxShadow: "0 0 0 3px rgba(255,215,0,0.25), 0 0 16px rgba(255,215,0,0.3)",
    transform: "scale(1.04)",
  },
  spreadPillDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },

  insetPanel: {
    marginTop: 16,
    background: "rgba(255,255,255,0.94)",
    color: "#111",
    borderRadius: 14,
    padding: 12,
  },

  darkMuted: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  darkLockNote: { fontSize: 12, marginBottom: 10, color: "rgba(255,255,255,0.65)" },
  darkLockNoteWarn: { fontSize: 12, marginBottom: 10, color: "#ff8a8a" },
  darkSaveOkNote: { color: "#7CFB9B", fontSize: 13, fontWeight: 700, marginTop: 12 },
  darkErrorText: { color: "#ff8a8a", fontSize: 13, marginTop: 12 },

  darkBtnGhost: {
    padding: "10px 14px",
    border: "1px solid transparent",
    borderRadius: 10,
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontWeight: 600,
  },
  darkBtnOutlineWarn: {
    padding: "10px 16px",
    border: "1px solid rgba(255,120,120,0.4)",
    borderRadius: 10,
    background: "rgba(255,80,80,0.08)",
    color: "#ff8a8a",
    cursor: "pointer",
    fontWeight: 700,
  },
  darkBtnSecondary: {
    padding: "10px 16px",
    border: "1px solid rgba(255,215,0,0.4)",
    borderRadius: 10,
    background: "rgba(255,215,0,0.08)",
    color: "#ffd700",
    cursor: "pointer",
    fontWeight: 700,
  },
  darkBtnPrimary: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 10,
    background: "linear-gradient(160deg, #ffe98a, #ffd700, #b8860b)",
    color: "#1a1200",
    cursor: "pointer",
    fontWeight: 800,
  },
};

/* ---------- Logos map ---------- */
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

/** e.g. "New England Patriots" -> "Patriots" (short label for the pick pills) */
function shortTeamName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

/** e.g. formatCountdown(90 * 60 * 1000) -> "1h 30m"; returns "" once the target has passed. */
function formatCountdown(msRemaining) {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return "";
  const totalMinutes = Math.floor(msRemaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** NFL season helper (Jan–Jul should usually be previous season) */
function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  // If we're before Aug, assume we're still in the prior NFL season year
  return m < 7 ? y - 1 : y;
}

function isValidTBValue(v) {
  return typeof v === "string" && /^[0-9]+$/.test(v);
}

const BONUS_CATEGORIES = ["passing_yards", "rushing_yards"];

export default function App() {
  const [week, setWeek] = useState({ season: "", week: "", games: [], tiebreakers: [], byes: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const navigate = useNavigate();
  const session = getSession();

  const [picks, setPicks] = useState({}); // { [gameId]: "AWAY" | "HOME" }
  const [bonusPicks, setBonusPicks] = useState({ passing_yards: {}, rushing_yards: {} }); // { [category]: { [gameId]: "AWAY" | "HOME" } }
  const [tbs, setTbs] = useState([]); // [{ gameId, total }]

  // what's actually been saved to Supabase so far (used for progress + "unsaved change" detection)
  const [savedPicks, setSavedPicks] = useState({}); // { [gameId]: "AWAY" | "HOME" }
  const [savedBonusPicks, setSavedBonusPicks] = useState({ passing_yards: {}, rushing_yards: {} });
  const [savedTbTotals, setSavedTbTotals] = useState({}); // { [tb_no]: "41" }

  // which step in the wizard is currently showing
  const [activeStep, setActiveStep] = useState(0);
  const [savingKey, setSavingKey] = useState(null);
  const [saveOkKey, setSaveOkKey] = useState("");
  const [saveErr, setSaveErr] = useState("");

  // % stats per game: { [gameId]: { away, home, tie, total } }
  const [stats, setStats] = useState({});

  // kickoff map: { [gameId]: "2025-09-07T18:00:00Z" }
  const [kickoffById, setKickoffById] = useState({});

  // ticking clock so locks update even if page stays open
  const [nowTs, setNowTs] = useState(() => Date.now());

  /* Load week from DB */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        const season = getDefaultNflSeasonYear();
        const res = await fetch(`/.netlify/functions/getweek?season=${season}`, { cache: "no-store" });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Could not load week data");

        // ✅ ensure exactly 3 predetermined tiebreakers (KEEP THIS LOGIC)
        let tbIds = Array.isArray(data.tiebreakers) ? data.tiebreakers.slice(0, 3) : [];
        if (tbIds.length < 3) {
          tbIds = (data.games || [])
            .slice(0, 3)
            .map((g) => g.id)
            .slice(0, 3);
        }

        setWeek({
          season,
          week: data.week,
          games: data.games || [],
          tiebreakers: tbIds,
          byes: Array.isArray(data.byes) ? data.byes : [],
        });

        setTbs(tbIds.map((id) => ({ gameId: id, total: "" })));

        // kickoff map FROM getweek payload (no client DB access needed)
        const map = {};
        for (const g of data.games || []) {
          if (g?.id && g?.kickoff) map[g.id] = g.kickoff;
        }
        setKickoffById(map);
      } catch (e) {
        console.error(e);
        setErr(String(e?.message || e));
        setKickoffById({});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load this user's own previously-saved answers so they can resume where they left off
  useEffect(() => {
    if (!week.week || !session?.fullName) return;
    (async () => {
      const name = session.fullName;
      const weekNum = Number(week.week);

      const [{ data: pRows }, { data: bRows }, { data: tRows }] = await Promise.all([
        supabase.from("picks").select("game_id, pick").eq("week", weekNum).eq("user_name", name),
        supabase.from("bonus_picks").select("game_id, category, pick").eq("week", weekNum).eq("user_name", name),
        supabase.from("tiebreakers").select("tb_no, total").eq("week", weekNum).eq("user_name", name),
      ]);

      if (pRows?.length) {
        const map = {};
        for (const r of pRows) map[r.game_id] = r.pick;
        setPicks((prev) => ({ ...prev, ...map }));
        setSavedPicks(map);
      }
      if (bRows?.length) {
        const map = { passing_yards: {}, rushing_yards: {} };
        for (const r of bRows) if (map[r.category]) map[r.category][r.game_id] = r.pick;
        setBonusPicks((prev) => ({
          passing_yards: { ...prev.passing_yards, ...map.passing_yards },
          rushing_yards: { ...prev.rushing_yards, ...map.rushing_yards },
        }));
        setSavedBonusPicks(map);
      }
      if (tRows?.length) {
        const map = {};
        for (const r of tRows) map[Number(r.tb_no)] = String(r.total);
        setTbs((prev) => prev.map((tb, i) => (map[i + 1] !== undefined ? { ...tb, total: map[i + 1] } : tb)));
        setSavedTbTotals(map);
      }
    })();
  }, [week.week, session?.fullName]);

  // Has this participant already paid this week's buy-in? (drives the Done-screen prompt)
  const [hasPaid, setHasPaid] = useState(null); // null = unknown/loading

  useEffect(() => {
    if (!week.week || !session?.fullName) return;
    (async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/getPaymentStatus?week=${Number(week.week)}&user_name=${encodeURIComponent(session.fullName)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data?.ok) setHasPaid(!!data.paid);
      } catch (e) {
        console.error("getPaymentStatus failed:", e);
      }
    })();
  }, [week.week, session?.fullName]);

  // This week's pot (participants who've saved at least one pick x $20,
  // minus commission) -- shown on the Done screen
  const [potInfo, setPotInfo] = useState(null);

  useEffect(() => {
    if (!week.season || !week.week) return;
    (async () => {
      try {
        const n = await countPickParticipants(week.season, week.week);
        setPotInfo(calcPot(n));
      } catch (e) {
        console.error("countPickParticipants failed:", e);
      }
    })();
  }, [week.season, week.week]);

  // update "now" every 30 seconds so lock state updates on screen
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function logout() {
    clearSession();
    navigate("/login");
  }

  /* Load stats when week ready + (optional) realtime updates */
  useEffect(() => {
    if (!week.week || week.games.length === 0) return;

    loadStats(Number(week.week));

    const canRealtime =
      supabase && typeof supabase.channel === "function" && typeof supabase.removeChannel === "function";
    if (!canRealtime) return;

    let channel;
    try {
      channel = supabase
        .channel("picks_live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "picks", filter: `week=eq.${week.week}` },
          () => loadStats(Number(week.week))
        )
        .subscribe();
    } catch (e) {
      console.error("Realtime subscribe error:", e);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (e) {
        console.error("Realtime cleanup error:", e);
      }
    };
  }, [week.week, week.games.length]);

  function setPick(gameId, value) {
    setPicks((p) => ({ ...p, [gameId]: value }));
  }

  function setBonusPick(category, gameId, value) {
    setBonusPicks((p) => ({ ...p, [category]: { ...p[category], [gameId]: value } }));
  }

  function setTBTotal(i, value) {
    setTbs((arr) => {
      const next = [...arr];
      next[i] = { ...next[i], total: value.replace(/[^0-9]/g, "") };
      return next;
    });
  }

  // helper: is a specific game locked yet? (locks 1 hour before kickoff — the only lock now)
  function isGameLocked(gameId) {
    const kickoffIso = kickoffById?.[gameId];
    if (!kickoffIso) return false;
    const kickoffMs = new Date(kickoffIso).getTime();
    if (Number.isNaN(kickoffMs)) return false;
    return nowTs >= kickoffMs - 60 * 60 * 1000;
  }

  /* ---------- Stats loader ---------- */
  async function loadStats(currentWeek) {
    try {
      const { data, error } = await supabase.from("picks").select("game_id, pick").eq("week", Number(currentWeek));

      if (error) {
        console.error("Supabase select error:", error);
        return;
      }

      const map = {};
      for (const g of week.games || []) {
        if (!g?.id) continue;
        map[g.id] = { away: 0, home: 0, tie: 0, total: 0 };
      }

      for (const row of data || []) {
        const key = row?.game_id;
        if (!key) continue;
        const m = map[key] || (map[key] = { away: 0, home: 0, tie: 0, total: 0 });
        if (row.pick === "AWAY") m.away++;
        else if (row.pick === "HOME") m.home++;
        else if (row.pick === "TIE") m.tie++;
        m.total++;
      }

      setStats(map);
    } catch (e) {
      console.error("loadStats crashed:", e);
    }
  }

  /* ---------- Wizard step model ---------- */
  const steps = useMemo(() => {
    const list = [{ type: "intro", key: "intro" }];
    (week.games || []).forEach((g, i) => list.push({ type: "game", key: `game_${g.id}`, game: g, index: i }));
    (week.tiebreakers || []).forEach((gid, i) => {
      const g = (week.games || []).find((x) => x.id === gid);
      list.push({ type: "tb", key: `tb_${i + 1}`, tbIndex: i, gameId: gid, game: g });
    });
    list.push({ type: "done", key: "done" });
    return list;
  }, [week.games, week.tiebreakers]);

  function statusOf(step) {
    if (step.type === "game") {
      const gid = step.game.id;
      const hasMain = !!savedPicks[gid];
      const hasPassing = !!savedBonusPicks?.passing_yards?.[gid];
      const hasRushing = !!savedBonusPicks?.rushing_yards?.[gid];
      if (hasMain && hasPassing && hasRushing) return "answered";
      if (isGameLocked(gid)) return "locked";
      return "open";
    }
    if (step.type === "tb") {
      const saved = savedTbTotals[step.tbIndex + 1];
      if (saved !== undefined && String(saved).trim() !== "") return "answered";
      if (step.gameId && isGameLocked(step.gameId)) return "locked";
      return "open";
    }
    return "answered";
  }

  function firstOpenIndex() {
    const idx = steps.findIndex((s) => (s.type === "game" || s.type === "tb") && statusOf(s) === "open");
    return idx === -1 ? steps.length - 1 : idx;
  }

  function goTo(idx) {
    setActiveStep(Math.max(0, Math.min(steps.length - 1, idx)));
    setSaveErr("");
    setSaveOkKey("");
  }

  /* ---------- Per-item save (autosave, replaces the old batch Submit) ---------- */
  async function saveGamePick(gameId, { advance } = {}) {
    if (!session?.fullName) return;
    const value = picks[gameId];
    if (!value) {
      if (advance) goTo(activeStep + 1);
      return;
    }

    setSavingKey(gameId);
    setSaveErr("");

    const { error } = await supabase
      .from("picks")
      .upsert([{ week: week.week, game_id: gameId, pick: value, user_name: session.fullName }], {
        onConflict: "week,game_id,user_name",
      });

    if (error) {
      console.error("Supabase picks error:", error);
      setSaveErr("There was a problem saving your pick. Please try again.");
      setSavingKey(null);
      return;
    }
    setSavedPicks((m) => ({ ...m, [gameId]: value }));

    const bonusRows = BONUS_CATEGORIES
      .map((category) => ({ category, value: bonusPicks[category][gameId] }))
      .filter((x) => x.value)
      .map((x) => ({ week: week.week, game_id: gameId, category: x.category, pick: x.value, user_name: session.fullName }));

    if (bonusRows.length > 0) {
      const { error: bErr } = await supabase
        .from("bonus_picks")
        .upsert(bonusRows, { onConflict: "week,game_id,user_name,category" });

      if (bErr) {
        console.error("Supabase bonus_picks error:", bErr);
        setSaveErr("Your winner pick saved, but there was a problem saving your bonus picks.");
        setSavingKey(null);
        return;
      }
      setSavedBonusPicks((m) => {
        const next = { ...m };
        for (const { category } of bonusRows) next[category] = { ...next[category], [gameId]: bonusPicks[category][gameId] };
        return next;
      });
    }

    setSavingKey(null);
    setSaveOkKey(gameId);
    loadStats(week.week);
    if (advance) goTo(activeStep + 1);
  }

  async function saveTiebreaker(tbIndex, { advance } = {}) {
    if (!session?.fullName) return;
    const tb = tbs[tbIndex];
    if (!tb || !isValidTBValue(tb.total)) {
      if (advance) goTo(activeStep + 1);
      return;
    }

    setSavingKey(`tb_${tbIndex + 1}`);
    setSaveErr("");

    const { error } = await supabase.from("tiebreakers").upsert(
      [
        {
          week: week.week,
          user_name: session.fullName,
          tb_no: tbIndex + 1,
          game_id: tb.gameId,
          total: Number.parseInt(tb.total, 10) || 0,
        },
      ],
      { onConflict: "week,user_name,tb_no" }
    );

    if (error) {
      console.error("Supabase tiebreakers error:", error);
      setSaveErr("There was a problem saving this tiebreaker. Please try again.");
      setSavingKey(null);
      return;
    }

    setSavedTbTotals((m) => ({ ...m, [tbIndex + 1]: tb.total }));
    setSavingKey(null);
    setSaveOkKey(`tb_${tbIndex + 1}`);
    if (advance) goTo(activeStep + 1);
  }

  function skipGame(gameId) {
    setPicks((p) => ({ ...p, [gameId]: savedPicks[gameId] }));
    setBonusPicks((p) => ({
      passing_yards: { ...p.passing_yards, [gameId]: savedBonusPicks.passing_yards[gameId] },
      rushing_yards: { ...p.rushing_yards, [gameId]: savedBonusPicks.rushing_yards[gameId] },
    }));
    goTo(activeStep + 1);
  }

  function skipTb(tbIndex) {
    const savedTotal = savedTbTotals[tbIndex + 1] ?? "";
    setTbs((arr) => {
      const next = [...arr];
      next[tbIndex] = { ...next[tbIndex], total: String(savedTotal) };
      return next;
    });
    goTo(activeStep + 1);
  }

  if (loading) return <Shell><p>Loading…</p></Shell>;
  if (err) return <Shell><p style={{ color: "red" }}>{err}</p></Shell>;

  const step = steps[activeStep] || steps[0];

  return (
    <Shell>
      <div className="page-overlay" style={styles.pageOverlay}>
        {/* Corner badge: avatar + username, links to Profile Settings */}
        {session?.username && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <Link to="/profile" style={{ textDecoration: "none", textAlign: "center" }}>
              <Avatar username={session.username} avatar={session.avatar} size={96} />
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#111" }}>{session.username}</div>
            </Link>
          </div>
        )}

        {/* Header row: title left, nav buttons right */}
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <h1 style={styles.h1}>NFL Weekly Picks</h1>
            <p style={styles.muted}>Week {week.week}</p>
          </div>

          <div style={styles.headerRight}>
            <Link to="/results">
              <Button variant="secondary" size="sm" pill>View Picks Table</Button>
            </Link>

            <Link to="/leaderboard">
              <Button variant="secondary" size="sm" pill>Live Leaderboard</Button>
            </Link>

            <Link to="/rules">
              <Button variant="secondary" size="sm" pill>Rules</Button>
            </Link>

            <Link to="/reglas">
              <Button variant="secondary" size="sm" pill>Reglas</Button>
            </Link>

            <Link to="/history">
              <Button variant="secondary" size="sm" pill>Season History</Button>
            </Link>

            <PaymentMenu />

            <Button variant="secondary" size="sm" pill onClick={logout} title="Log out">
              Log out
            </Button>
          </div>
        </div>

        <div style={styles.screenWrap} key={step.key}>
          {step.type === "intro" && (
            <IntroScreen
              fullName={session?.fullName}
              username={session?.username}
              week={week.week}
              steps={steps}
              statusOf={statusOf}
              savedBonusPicks={savedBonusPicks}
              onStart={() => goTo(firstOpenIndex())}
            />
          )}

          {step.type === "done" && (
            <DoneScreen
              steps={steps}
              statusOf={statusOf}
              byes={week.byes}
              hasPaid={hasPaid}
              potInfo={potInfo}
              savedPicks={savedPicks}
              savedBonusPicks={savedBonusPicks}
              savedTbTotals={savedTbTotals}
              isGameLocked={isGameLocked}
              onReview={() => goTo(firstOpenIndex())}
              onEdit={(idx) => goTo(idx)}
            />
          )}
        </div>

        {(step.type === "game" || step.type === "tb") && (
          <WizardModal onClose={() => goTo(0)}>
            <StepProgress steps={steps} activeStep={activeStep} statusOf={statusOf} onJump={goTo} />

            {step.type === "game" && (
              <GamePickScreen
                game={step.game}
                index={step.index}
                totalGames={week.games.length}
                pick={picks[step.game.id]}
                bonusPicks={bonusPicks}
                savedPick={savedPicks[step.game.id]}
                savedBonusPicks={savedBonusPicks}
                onPick={setPick}
                onBonusPick={setBonusPick}
                gameStats={stats[step.game.id]}
                kickoffIso={kickoffById[step.game.id] || ""}
                locked={isGameLocked(step.game.id)}
                nowTs={nowTs}
                saving={savingKey === step.game.id}
                saveOk={saveOkKey === step.game.id}
                saveErr={saveErr}
                onBack={() => goTo(activeStep - 1)}
                onSkip={() => skipGame(step.game.id)}
                onSave={() => saveGamePick(step.game.id)}
                onContinue={() => saveGamePick(step.game.id, { advance: true })}
              />
            )}

            {step.type === "tb" && (
              <TiebreakerScreen
                tbIndex={step.tbIndex}
                game={step.game}
                total={tbs[step.tbIndex]?.total || ""}
                onChangeTotal={(v) => setTBTotal(step.tbIndex, v)}
                locked={step.gameId ? isGameLocked(step.gameId) : false}
                kickoffIso={step.gameId ? kickoffById[step.gameId] || "" : ""}
                nowTs={nowTs}
                saving={savingKey === step.key}
                saveOk={saveOkKey === step.key}
                saveErr={saveErr}
                onBack={() => goTo(activeStep - 1)}
                onSkip={() => skipTb(step.tbIndex)}
                onSave={() => saveTiebreaker(step.tbIndex)}
                onContinue={() => saveTiebreaker(step.tbIndex, { advance: true })}
              />
            )}
          </WizardModal>
        )}

        {/* Admin box */}
        {session?.isAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: "10px 14px", textAlign: "right", background: "rgba(255,255,255,0.7)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" }}>
                Only for Admins
              </div>
              <Link to="/admin">
                <Button variant="dark" size="sm" pill>Admin Dashboard</Button>
              </Link>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </Shell>
  );
}

/* ---------- Step progress strip (click any dot to jump straight there) ---------- */
function StepProgress({ steps, activeStep, statusOf, onJump }) {
  const items = steps.filter((s) => s.type === "game" || s.type === "tb");
  return (
    <div style={styles.stepStrip}>
      {items.map((s) => {
        const idx = steps.indexOf(s);
        const status = statusOf(s);
        const label = s.type === "game" ? String(s.index + 1) : `T${s.tbIndex + 1}`;
        const title =
          s.type === "game"
            ? `${s.game.away} @ ${s.game.home}`
            : s.game
            ? `Tiebreaker: ${s.game.away} @ ${s.game.home}`
            : `Tiebreaker ${s.tbIndex + 1}`;
        return (
          <button
            key={s.key}
            type="button"
            title={title}
            onClick={() => onJump(idx)}
            style={{
              ...styles.stepDot,
              ...(status === "answered" ? styles.stepDotAnswered : {}),
              ...(status === "locked" ? styles.stepDotLocked : {}),
              ...(idx === activeStep ? styles.stepDotCurrent : {}),
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Intro / resume screen ---------- */
function IntroScreen({ fullName, username, week, steps, statusOf, savedBonusPicks, onStart }) {
  const gameSteps = steps.filter((s) => s.type === "game");
  const tbSteps = steps.filter((s) => s.type === "tb");
  const answeredGames = gameSteps.filter((s) => statusOf(s) === "answered").length;
  const answeredTbs = tbSteps.filter((s) => statusOf(s) === "answered").length;
  const bonusTotal = gameSteps.length * 2;
  const answeredBonus = gameSteps.reduce((sum, s) => {
    const gid = s.game.id;
    let c = 0;
    if (savedBonusPicks?.passing_yards?.[gid]) c++;
    if (savedBonusPicks?.rushing_yards?.[gid]) c++;
    return sum + c;
  }, 0);
  const allDone = gameSteps.every((s) => statusOf(s) !== "open") && tbSteps.every((s) => statusOf(s) !== "open");
  const anyProgress = answeredGames + answeredTbs > 0;

  return (
    <Card>
      <h2 style={styles.h2}>
        Welcome, {fullName}
        {username ? ` (@${username})` : ""}
      </h2>
      <p style={styles.mutedSmall}>
        Week {week}. Step through each game, save as you go — come back anytime to finish anything you skip.
      </p>
      <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap", fontSize: 14 }}>
        <div>
          <b>{answeredGames}</b> / {gameSteps.length} games picked
        </div>
        <div>
          <b>{answeredBonus}</b> / {bonusTotal} bonus picks picked
        </div>
        <div>
          <b>{answeredTbs}</b> / {tbSteps.length} tiebreakers picked
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Button variant="primary" onClick={onStart}>
          {allDone ? "Review My Picks" : anyProgress ? "Resume Picks →" : "Start Picks →"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------- Done / recap screen ---------- */
function DoneScreen({
  steps,
  statusOf,
  byes,
  hasPaid,
  potInfo,
  savedPicks,
  savedBonusPicks,
  savedTbTotals,
  isGameLocked,
  onReview,
  onEdit,
}) {
  const gameSteps = steps.filter((s) => s.type === "game");
  const tbSteps = steps.filter((s) => s.type === "tb");
  const count = (arr, status) => arr.filter((s) => statusOf(s) === status).length;
  const openGames = count(gameSteps, "open");
  const openTbs = count(tbSteps, "open");
  const bonusTotal = gameSteps.length * 2;
  const answeredBonus = gameSteps.reduce((sum, s) => {
    const gid = s.game.id;
    let c = 0;
    if (savedBonusPicks?.passing_yards?.[gid]) c++;
    if (savedBonusPicks?.rushing_yards?.[gid]) c++;
    return sum + c;
  }, 0);

  const [showRecap, setShowRecap] = useState(false);

  const recapRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
  };
  const recapLogo = { width: 18, height: 18, objectFit: "contain", verticalAlign: "middle", marginRight: 6 };

  return (
    <Card>
      <h2 style={styles.h2}>🎉 You're all set</h2>
      <p style={styles.mutedSmall}>Everything here is already saved — there's nothing else to submit.</p>
      <ul style={{ paddingLeft: 20, lineHeight: 1.8, margin: "8px 0" }}>
        <li>
          {count(gameSteps, "answered")} of {gameSteps.length} games picked
          {openGames > 0 ? ` (${openGames} still open)` : ""}
        </li>
        <li>
          {answeredBonus} of {bonusTotal} bonus picks picked
          {answeredBonus < bonusTotal ? ` (${bonusTotal - answeredBonus} still open)` : ""}
        </li>
        <li>
          {count(tbSteps, "answered")} of {tbSteps.length} tiebreakers picked
          {openTbs > 0 ? ` (${openTbs} still open)` : ""}
        </li>
      </ul>

      {(openGames > 0 || openTbs > 0) && (
        <Button variant="primary" onClick={onReview}>
          Go finish what's open
        </Button>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => setShowRecap((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 12px",
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: "#111",
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>Your Picks &amp; Tiebreakers</span>
          <span style={{ fontSize: 12, color: "#666" }}>{showRecap ? "▲ Hide" : "▼ View"}</span>
        </button>
      </div>

      {showRecap && (
      <div style={{ marginTop: 12 }}>
        <h3 style={{ margin: "8px 0 12px", fontSize: 18 }}>Your Picks</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {gameSteps.map((s) => {
            const g = s.game;
            const pick = savedPicks?.[g.id];
            const pickedTeam = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
            const passingPick = savedBonusPicks?.passing_yards?.[g.id];
            const rushingPick = savedBonusPicks?.rushing_yards?.[g.id];
            const passingTeam = passingPick === "AWAY" ? g.away : passingPick === "HOME" ? g.home : null;
            const rushingTeam = rushingPick === "AWAY" ? g.away : rushingPick === "HOME" ? g.home : null;
            const locked = isGameLocked ? isGameLocked(g.id) : false;
            const idx = steps.indexOf(s);
            return (
              <div key={s.key} style={recapRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {shortTeamName(g.away)} @ {shortTeamName(g.home)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {pickedTeam ? (
                      <>
                        {logoSrc(pickedTeam) && <img src={logoSrc(pickedTeam)} alt={pickedTeam} style={recapLogo} />}
                        {shortTeamName(pickedTeam)}
                      </>
                    ) : (
                      <span style={{ color: "#999", fontWeight: 400 }}>No pick</span>
                    )}
                  </div>
                  {(passingTeam || rushingTeam) && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#888", marginTop: 2 }}>
                      {passingTeam && <span>Passing: {shortTeamName(passingTeam)}</span>}
                      {passingTeam && rushingTeam && <span> · </span>}
                      {rushingTeam && <span>Rushing: {shortTeamName(rushingTeam)}</span>}
                    </div>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={locked}
                  title={locked ? "This game has started — locked" : "Change this pick"}
                  onClick={() => onEdit(idx)}
                >
                  {locked ? "Locked" : "Edit"}
                </Button>
              </div>
            );
          })}
        </div>

        <h3 style={{ margin: "16px 0 12px", fontSize: 18 }}>Your Tiebreakers</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {tbSteps.map((s) => {
            const total = savedTbTotals?.[s.tbIndex + 1];
            const hasTotal = total !== undefined && String(total).trim() !== "";
            const locked = s.gameId && isGameLocked ? isGameLocked(s.gameId) : false;
            const idx = steps.indexOf(s);
            return (
              <div key={s.key} style={recapRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Tiebreaker {s.tbIndex + 1}
                    {s.game ? ` — ${shortTeamName(s.game.away)} @ ${shortTeamName(s.game.home)}` : ""}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {hasTotal ? `${total} total points` : <span style={{ color: "#999", fontWeight: 400 }}>No pick</span>}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={locked}
                  title={locked ? "This game has started — locked" : "Change this tiebreaker"}
                  onClick={() => onEdit(idx)}
                >
                  {locked ? "Locked" : "Edit"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {potInfo && potInfo.n > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(184,134,11,0.3)",
            background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(0,0,0,0.02))",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            🏆 This week's pot: ${potInfo.pot.toFixed(2)}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
            {potInfo.n} participant{potInfo.n === 1 ? "" : "s"} × ${potInfo.buyIn.toFixed(2)} − {Math.round(potInfo.commissionPct * 100)}% commission
          </p>
        </div>
      )}

      {hasPaid === true && (
        <p style={{ marginTop: 16, color: "#1a7a28", fontWeight: 700, fontSize: 14 }}>
          ✅ You're paid up for this week. Thanks!
        </p>
      )}
      {hasPaid === false && <PaymentPrompt />}

      {byes?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: "8px 0 12px", fontSize: 18 }}>Teams on Bye</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {byes.map((team) => (
              <div key={team} style={{ width: 64, textAlign: "center" }} title={team}>
                <img
                  src={logoSrc(team)}
                  alt={team}
                  style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Payment prompt shown on the Done screen when unpaid ---------- */
function PaymentPrompt() {
  const [copied, setCopied] = useState(false);

  function copyZelle() {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ZELLE_CONTACT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const badgeStyle = (color) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 16px",
    borderRadius: 10,
    background: color,
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    cursor: "pointer",
    border: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  });

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 15 }}>💳 Don't forget your buy-in — $20.00 USD</div>
      <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#555" }}>Pay however's easiest for you:</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PAYMENT_LINKS.map((opt) => (
          <a key={opt.name} href={opt.url} target="_blank" rel="noopener noreferrer" style={badgeStyle(opt.color)}>
            {opt.name}
          </a>
        ))}
        <button type="button" onClick={copyZelle} style={badgeStyle(ZELLE_COLOR)}>
          {copied ? "✅ Copied!" : "Zelle"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Table + bars summary per game (higher % = green) ---------- */
function PickSummary({ awayLabel, homeLabel, awayCount, homeCount, awayLogo, homeLogo, awayRecord, homeRecord }) {
  const total = (awayCount || 0) + (homeCount || 0);
  const awayPct = total ? Math.round((awayCount / total) * 100) : 0;
  const homePct = total ? 100 - awayPct : 0;

  const green = "#2ecc71";
  const red = "#e74c3c";
  const gray = "#bdc3c7";

  let awayColor = gray;
  let homeColor = gray;
  if (total > 0) {
    if (awayPct > homePct) {
      awayColor = green;
      homeColor = red;
    } else if (homePct > awayPct) {
      awayColor = red;
      homeColor = green;
    }
  }

  const row = {
    display: "grid",
    gridTemplateColumns: "auto 1fr 56px 40px",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    fontSize: 13,
  };
  const barTrack = {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid #ddd",
    background: "rgba(0,0,0,0.05)",
  };
  const logoBox = { width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" };
  const logoImg = { width: 20, height: 20, objectFit: "contain", display: "block" };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...row, fontWeight: 600, color: "#333" }}>
        <div></div>
        <div>Team</div>
        <div style={{ textAlign: "right" }}>Picks</div>
        <div style={{ textAlign: "right" }}>%</div>
      </div>

      <div style={row}>
        <div style={logoBox} title={awayLabel}>
          {awayLogo ? <img src={awayLogo} alt={awayLabel} style={logoImg} /> : null}
        </div>
        <div>
          {awayLabel}
          {awayRecord && <span style={{ color: "#666", fontWeight: 400 }}> ({awayRecord})</span>}
        </div>
        <div style={{ textAlign: "right" }}>{awayCount || 0}</div>
        <div style={{ textAlign: "right" }}>{awayPct}%</div>
      </div>
      <div style={barTrack}>
        <div style={{ width: `${awayPct}%`, height: "100%", background: awayColor }} />
      </div>

      <div style={{ ...row, marginTop: 8 }}>
        <div style={logoBox} title={homeLabel}>
          {homeLogo ? <img src={homeLogo} alt={homeLabel} style={logoImg} /> : null}
        </div>
        <div>
          {homeLabel}
          {homeRecord && <span style={{ color: "#666", fontWeight: 400 }}> ({homeRecord})</span>}
        </div>
        <div style={{ textAlign: "right" }}>{homeCount || 0}</div>
        <div style={{ textAlign: "right" }}>{homePct}%</div>
      </div>
      <div style={barTrack}>
        <div style={{ width: `${homePct}%`, height: "100%", background: homeColor }} />
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.6)", textAlign: "center" }}>
        Total votes: {total || 0}
      </div>
    </div>
  );
}

/* ---------- One game, one screen ---------- */
function GamePickScreen({
  game,
  index,
  totalGames,
  pick,
  bonusPicks,
  savedPick,
  savedBonusPicks,
  onPick,
  onBonusPick,
  gameStats,
  kickoffIso,
  locked,
  nowTs,
  saving,
  saveOk,
  saveErr,
  onBack,
  onSkip,
  onSave,
  onContinue,
}) {
  const awayLogo = logoSrc(game.away);
  const homeLogo = logoSrc(game.home);
  const awayCount = gameStats?.away || 0;
  const homeCount = gameStats?.home || 0;

  let lockNote = "";
  if (locked) {
    lockNote = "🔒 Locked — game started";
  } else if (kickoffIso) {
    const lockTime = new Date(new Date(kickoffIso).getTime() - 60 * 60 * 1000);
    const countdown = formatCountdown(lockTime.getTime() - nowTs);
    lockNote = `Locks 1 hr before kickoff: ${lockTime.toLocaleString()}${countdown ? ` (${countdown})` : ""}`;
  }

  const passingPick = bonusPicks?.passing_yards?.[game.id];
  const rushingPick = bonusPicks?.rushing_yards?.[game.id];
  const isDirty =
    (pick && pick !== savedPick) ||
    (passingPick && passingPick !== savedBonusPicks?.passing_yards?.[game.id]) ||
    (rushingPick && rushingPick !== savedBonusPicks?.rushing_yards?.[game.id]);
  const canSave = !locked && !!pick && !!passingPick && !!rushingPick;
  const isFullySaved =
    !!savedPick && !!savedBonusPicks?.passing_yards?.[game.id] && !!savedBonusPicks?.rushing_yards?.[game.id];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={styles.darkMuted}>
          Game {index + 1} of {totalGames}
        </div>
        {isFullySaved && !isDirty && (
          <span style={{ fontSize: 12, fontWeight: 800, color: "#7CFB9B" }}>✓ Saved</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "6px 0 2px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{shortTeamName(game.away)}</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>@</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{shortTeamName(game.home)}</span>
      </div>

      {lockNote && <div style={locked ? styles.darkLockNoteWarn : styles.darkLockNote}>{lockNote}</div>}
      {locked && !savedPick && (
        <p style={{ color: "#ff8a8a", fontSize: 13 }}>No pick was saved before this game started.</p>
      )}

      <div style={styles.sectionDividerWrap}>
        <div style={styles.sectionDividerLine} />
        <span style={styles.sectionDividerLabel}>Straight Up</span>
        <div style={styles.sectionDividerLine} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {[
          { v: "AWAY", label: game.away, logo: awayLogo, title: `${game.away} (Away)` },
          { v: "HOME", label: game.home, logo: homeLogo, title: `${game.home} (Home)` },
        ].reduce((acc, opt, i) => {
          if (i === 1) acc.push(<VsAnimation key="vs" />);
          const isSelected = pick === opt.v;
          acc.push(
            <label
              key={opt.v}
              style={{ ...styles.teamPillWrap, ...(locked ? styles.teamPillDisabled : {}) }}
              title={locked ? "Locked" : opt.title}
            >
              <input
                type="radio"
                name={`pick_${game.id}`}
                checked={isSelected}
                disabled={locked}
                onChange={() => !locked && onPick(game.id, opt.v)}
                style={styles.radioActual}
                aria-label={opt.label}
              />
              <div style={{ ...styles.teamPill, ...(isSelected ? styles.teamPillSelected : {}) }}>
                {opt.logo && (
                  <img
                    src={opt.logo}
                    alt={opt.label}
                    style={styles.teamPillLogo}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </div>
              <span style={styles.teamPillCaption}>{shortTeamName(opt.label)}</span>
            </label>
          );
          return acc;
        }, [])}
      </div>

      <BonusPickRow
        category="passing_yards"
        label="Required (+0.5 pt) — More Passing Yards"
        game={game}
        value={passingPick}
        locked={locked}
        onPick={onBonusPick}
      />
      <BonusPickRow
        category="rushing_yards"
        label="Required (+0.5 pt) — More Rushing Yards"
        game={game}
        value={rushingPick}
        locked={locked}
        onPick={onBonusPick}
      />

      <div style={styles.insetPanel}>
        <PickSummary
          awayLabel={game.away}
          homeLabel={game.home}
          awayCount={awayCount}
          homeCount={homeCount}
          awayLogo={awayLogo}
          homeLogo={homeLogo}
          awayRecord={game.awayRecord}
          homeRecord={game.homeRecord}
        />
      </div>

      {saveErr && <p style={styles.darkErrorText}>{saveErr}</p>}
      {saveOk && !saveErr && <p style={styles.darkSaveOkNote}>✓ Saved!</p>}

      <div style={styles.wizardFooter}>
        <button type="button" style={styles.darkBtnGhost} onClick={onBack}>
          ← Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {!locked && (
            <button type="button" style={styles.darkBtnOutlineWarn} onClick={onSkip}>
              Skip
            </button>
          )}
          {!locked && (
            <button
              type="button"
              style={{ ...styles.darkBtnSecondary, ...((!canSave || saving) ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving ? "Saving…" : "Save Pick"}
            </button>
          )}
          <button
            type="button"
            style={{ ...styles.darkBtnPrimary, ...(saving ? { opacity: 0.7, cursor: "not-allowed" } : {}) }}
            disabled={saving}
            onClick={onContinue}
          >
            {saving ? "Saving…" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- One bonus-yardage pick row (rendered twice: passing, rushing) ---------- */
function BonusPickRow({ category, label, game, value, locked, onPick }) {
  return (
    <>
      <div style={styles.sectionDividerWrap}>
        <div style={styles.sectionDividerLine} />
        <span style={styles.sectionDividerLabel}>{label}</span>
        <div style={styles.sectionDividerLine} />
      </div>
      <div style={styles.spreadPillGroup}>
        {[
          { v: "AWAY", label: game.away },
          { v: "HOME", label: game.home },
        ].map((opt) => {
          const isSelected = value === opt.v;
          return (
            <label
              key={opt.v}
              style={{
                ...styles.spreadPill,
                ...(isSelected ? styles.spreadPillSelected : {}),
                ...(locked ? styles.spreadPillDisabled : {}),
              }}
              title={locked ? "Locked" : opt.label}
            >
              <input
                type="radio"
                name={`${category}_${game.id}`}
                checked={isSelected}
                disabled={locked}
                onChange={() => !locked && onPick(category, game.id, opt.v)}
                style={styles.radioActual}
                aria-label={opt.label}
              />
              {shortTeamName(opt.label)}
            </label>
          );
        })}
      </div>
    </>
  );
}

/* ---------- One tiebreaker, one screen ---------- */
function TiebreakerScreen({ tbIndex, game, total, onChangeTotal, locked, kickoffIso, nowTs, saving, saveOk, saveErr, onBack, onSkip, onSave, onContinue }) {
  const filled = String(total || "").trim() !== "";
  const canSave = !locked && filled;

  let lockNote = "";
  if (locked) {
    lockNote = "🔒 Locked — game started";
  } else if (kickoffIso) {
    const lockTime = new Date(new Date(kickoffIso).getTime() - 60 * 60 * 1000);
    const countdown = formatCountdown(lockTime.getTime() - nowTs);
    lockNote = `Locks 1 hr before kickoff: ${lockTime.toLocaleString()}${countdown ? ` (${countdown})` : ""}`;
  }

  return (
    <div>
      <div style={styles.darkMuted}>Tiebreaker {tbIndex + 1} of 3</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "6px 0 2px", flexWrap: "wrap" }}>
        {game ? (
          <>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{shortTeamName(game.away)}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>@</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{shortTeamName(game.home)}</span>
          </>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>Tiebreaker {tbIndex + 1}</span>
        )}
      </div>
      <p style={{ ...styles.darkMuted, textAlign: "center", marginTop: 4 }}>
        Guess the total combined points scored by both teams.
      </p>

      {lockNote && (
        <div style={{ ...(locked ? styles.darkLockNoteWarn : styles.darkLockNote), textAlign: "center" }}>{lockNote}</div>
      )}

      <div style={styles.sectionDividerWrap}>
        <div style={styles.sectionDividerLine} />
        <span style={styles.sectionDividerLabel}>Total Points</span>
        <div style={styles.sectionDividerLine} />
      </div>

      <input
        style={{
          ...styles.input,
          maxWidth: 220,
          margin: "0 auto",
          display: "block",
          textAlign: "center",
          fontSize: 18,
          fontWeight: 800,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,215,0,0.35)",
          color: "#ffd700",
          transition: "box-shadow 0.3s",
          boxShadow: filled ? "0 0 0 3px rgba(255,215,0,0.25)" : "none",
        }}
        inputMode="numeric"
        placeholder="Total points"
        value={total}
        disabled={locked}
        onChange={(e) => onChangeTotal(e.target.value.replace(/[^0-9]/g, ""))}
      />

      {saveErr && <p style={{ ...styles.darkErrorText, textAlign: "center" }}>{saveErr}</p>}
      {saveOk && !saveErr && <p style={{ ...styles.darkSaveOkNote, textAlign: "center" }}>✓ Saved!</p>}

      <div style={styles.wizardFooter}>
        <button type="button" style={styles.darkBtnGhost} onClick={onBack}>
          ← Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {!locked && (
            <button type="button" style={styles.darkBtnOutlineWarn} onClick={onSkip}>
              Skip
            </button>
          )}
          {!locked && (
            <button
              type="button"
              style={{ ...styles.darkBtnSecondary, ...((!canSave || saving) ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button
            type="button"
            style={{ ...styles.darkBtnPrimary, ...(saving ? { opacity: 0.7, cursor: "not-allowed" } : {}) }}
            disabled={saving}
            onClick={onContinue}
          >
            {saving ? "Saving…" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Full-screen "Make Your Pick" modal ---------- */
function WizardModal({ onClose, children }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div style={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.modalHeaderRow}>
          <span style={styles.modalHeaderLabel}>🏈 Make Your Pick</span>
          <button type="button" style={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- VS Animation ---------- */
function VsAnimation() {
  const sparks = useMemo(() => {
    const colors = ['#ff4500', '#ff6600', '#ffcc00', '#ff2200', '#ffaa00'];
    return Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * 360;
      const dist = 8 + (i % 3) * 4;
      return {
        angle,
        x: Math.cos(angle * Math.PI / 180) * dist,
        y: Math.sin(angle * Math.PI / 180) * dist,
        h: 2 + (i % 3),
        color: colors[i % colors.length],
        delay: (i / 10) * 1.8,
        duration: 1.2 + (i % 3) * 0.3,
      };
    });
  }, []);

  const embers = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      s: 1 + (i % 3) * 0.5,
      x: 10 + i * 8,
      y: 15 + i * 7,
      dx: (i % 2 === 0 ? 1 : -1) * (3 + i * 1.5),
      dur: 1.5 + (i % 3) * 0.5,
      color: ['#ff4500', '#ff6600', '#ffcc00', '#ff2200'][i % 4],
      delay: (i / 8) * 2,
    }))
  , []);

  const bolts = useMemo(() =>
    [30, 120, 210, 300].map((angle, i) => ({
      angle, len: 10 + i * 2, delay: i * 0.4, duration: 2.2 + (i % 2) * 0.5,
    }))
  , []);

  return (
    <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {/* Burst rays */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'vsBurstSpin 12s linear infinite' }}>
        <svg viewBox="0 0 500 500" style={{ width: '100%', height: '100%', position: 'absolute' }}>
          <defs>
            <radialGradient id="vsRayGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff6600" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#ff2200" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="translate(250,250)" fill="url(#vsRayGrad)">
            {Array.from({ length: 24 }, (_, i) => (
              <polygon key={i} points="0,-10 5,-240 -5,-240" transform={`rotate(${i * 15})`} opacity={i % 2 === 0 ? 0.9 : 0.6} />
            ))}
          </g>
        </svg>
      </div>

      {/* Shockwave rings */}
      {[
        { d: 26, color: 'rgba(255,60,0,0.7)', delay: 0 },
        { d: 36, color: 'rgba(255,160,0,0.5)', delay: 0.4 },
        { d: 48, color: 'rgba(255,230,0,0.3)', delay: 0.8 },
      ].map((r, i) => (
        <div key={i} style={{ position: 'absolute', width: r.d, height: r.d, borderRadius: '50%', border: `1px solid ${r.color}`, animation: `vsRingPulse 2s ease-out ${r.delay}s infinite` }} />
      ))}

      {/* Sparks */}
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', width: 1, height: s.h, borderRadius: 1,
          left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)`,
          background: `linear-gradient(to top, transparent, ${s.color})`,
          transform: `rotate(${s.angle + 90}deg)`, transformOrigin: 'center bottom',
          animation: `vsSparkFly ${s.duration}s ${s.delay}s ease-out infinite`,
        }} />
      ))}

      {/* Embers */}
      {embers.map((em, i) => (
        <div key={i} style={{
          position: 'absolute', width: em.s, height: em.s, borderRadius: '50%',
          left: em.x, top: em.y, background: em.color,
          '--vs-dx': `${em.dx}px`,
          boxShadow: `0 0 ${em.s * 2}px ${em.color}`,
          animation: `vsEmberFloat ${em.dur}s ${em.delay}s linear infinite`,
        }} />
      ))}

      {/* Lightning */}
      {bolts.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%', width: 1, height: b.len,
          transform: `translate(-50%, -${b.len}px) rotate(${b.angle}deg)`,
          transformOrigin: 'top center',
          background: 'linear-gradient(to bottom, #fff, #ffcc00, rgba(255,100,0,0))',
          boxShadow: '0 0 1px #ffcc00, 0 0 2px #ff6600',
          animation: `vsBoltFlash ${b.duration}s ${b.delay}s ease-in-out infinite`,
          opacity: 0, zIndex: 5,
        }} />
      ))}

      {/* Center flare */}
      <div style={{
        position: 'absolute', width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,220,100,0.9) 0%, rgba(255,100,0,0.4) 40%, transparent 70%)',
        zIndex: 8, animation: 'vsFlareBreath 1.5s ease-in-out infinite', mixBlendMode: 'screen',
      }} />

      {/* VS text */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <span style={{
          fontFamily: "'Black Ops One', sans-serif",
          fontSize: 26, lineHeight: 1, letterSpacing: -0.6,
          color: '#fff', userSelect: 'none', display: 'block',
          textShadow: `
            0 0 3px #fff, 0 0 6px #ff4500, 0 0 11px #ff6600, 0 0 16px #ff2200,
            0.3px 0.3px 0 #cc2200, 0.6px 0.6px 0 #aa1800, 1px 1px 0 #881000,
            1.3px 1.3px 0 #660800, 1.6px 1.6px 0 #440400, 1.9px 1.9px 0 #220200,
            -0.15px -0.15px 0 #ffcc00, 2.2px 2.5px 5px rgba(0,0,0,0.9)
          `,
          animation: 'vsFloat 3s ease-in-out infinite, vsPulse 1.5s ease-in-out infinite',
        }}>VS</span>
      </div>
    </div>
  );
}

/* ---------- Layout & UI ---------- */
function Shell({ children }) {
  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap');
          html, body, #root { height: 100%; }
          @media (max-width: 768px) {
            #app-shell { background-attachment: scroll !important; }
          }
          @media (max-width: 480px) {
            #app-shell { padding: 10px !important; }
            .page-overlay { padding: 12px !important; }
            .app-card { padding: 12px !important; }
          }
          @keyframes vsBurstSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes vsRingPulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
          @keyframes vsSparkFly { 0% { opacity: 1; transform: scaleY(1) translateY(0); } 100% { opacity: 0; transform: scaleY(0.2) translateY(-20px); } }
          @keyframes vsFloat { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1px) scale(1.02); } }
          @keyframes vsPulse {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 2px #ff4500) drop-shadow(0 0 6px #ff6600); }
            50% { filter: brightness(1.2) drop-shadow(0 0 4px #ffcc00) drop-shadow(0 0 10px #ff4500); }
          }
          @keyframes vsBoltFlash { 0%, 85%, 100% { opacity: 0; } 88%, 92% { opacity: 1; } }
          @keyframes vsEmberFloat { 0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; } 100% { transform: translateY(-30px) translateX(var(--vs-dx)) scale(0); opacity: 0; } }
          @keyframes vsFlareBreath { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 1; } }
          @keyframes wizardFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .app-card { animation: wizardFadeIn 0.22s ease; }
        `}
      </style>

      <div id="app-shell" style={pageBackgroundStyle}>
        {children}
      </div>
    </>
  );
}

function Card({ children }) {
  return <div className="app-card" style={styles.card}>{children}</div>;
}
function Footer() {
  return (
    <p style={{ textAlign: "center", fontSize: 12, color: "rgba(0,0,0,0.75)", marginTop: 16 }}>
      © NFL Weekly Picks
    </p>
  );
}

/* ---------- Payment Options dropdown ---------- */
const ZELLE_CONTACT = "926.235.4891";
const PAYMENT_LINKS = [
  { name: "Venmo", url: "https://www.venmo.com/u/Adrian-Perez-21", color: "#3D95CE" },
  { name: "Cash App", url: "https://cash.app/$nano1454", color: "#00D632" },
  { name: "PayPal", url: "https://paypal.me/AdrianPerez184", color: "#0070BA" },
];
const ZELLE_COLOR = "#6D1ED4";

function PaymentMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function copyZelle() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(ZELLE_CONTACT);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const menuItemStyle = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "9px 12px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#111",
    textDecoration: "none",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Button variant="secondary" size="sm" pill onClick={() => setOpen((o) => !o)}>
        Payment Options
      </Button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
            padding: 6,
            minWidth: 190,
            zIndex: 20,
          }}
        >
          {PAYMENT_LINKS.map((opt) => (
            <a
              key={opt.name}
              href={opt.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {opt.name}
            </a>
          ))}
          <button
            type="button"
            onClick={copyZelle}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f2f2f2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {copied ? "✅ Zelle number copied!" : `Zelle — ${ZELLE_CONTACT}`}
          </button>
        </div>
      )}
    </div>
  );
}
