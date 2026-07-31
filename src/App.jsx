import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import { getSession, clearSession } from "./auth";
import { pageBackgroundStyle } from "./backgroundStyle";

/** Optional: keep Formspree so you still receive an email copy (no mailto popups) */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xovlredw";

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
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "start" },

  input: {
    padding: "10px 12px",
    border: "1px solid #9ca3af",
    borderRadius: 8,
    background: "#333",
    color: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },

  btn: {
    padding: "10px 16px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.9)",
    color: "#000",
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
    backdropFilter: "saturate(120%) blur(2px)",
  },
  btnHover: { background: "rgba(255,255,255,1)", color: "#000" },

  btnPrimary: {
    padding: "10px 16px",
    border: "none",
    borderRadius: 10,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  btnPrimaryHover: { background: "#333" },

  // Header-ish nav buttons (smaller + pill-ish)
  navBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    color: "#111",
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    fontSize: 13,
    fontWeight: 700,
  },
  navBtnHover: {
    background: "rgba(255,255,255,1)",
    transform: "translateY(-1px)",
  },

  gameRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    gap: 12,
  },
  pickGroup: { display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap" },

  radioActual: { position: "absolute", opacity: 0, pointerEvents: "none" },
  logoOnly: { height: 28, width: 28, objectFit: "contain", display: "block" },
  logoButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    width: 40,
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "rgba(255,255,255,0.9)",
    cursor: "pointer",
    transition: "transform 0.1s, background 0.2s, border-color 0.2s",
    backdropFilter: "saturate(120%) blur(2px)",
    position: "relative",
  },
  logoButtonSelected: {
    border: "2.5px solid rgba(25, 185, 55, 0.85)",
    boxShadow: "0 0 0 3px rgba(25, 185, 55, 0.18)",
    transform: "scale(1.08)",
  },
  logoButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    filter: "grayscale(60%)",
  },
  tiePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    minWidth: 28,
    padding: "0 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    color: "#111",
    fontSize: 12,
  },
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
  tbRow: {
    display: "grid",
    gap: 6,
    padding: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.85)",
  },
  tbLabel: { fontSize: 13, fontWeight: 600, color: "rgba(0,0,0,0.85)" },

  // Deadline lock banner
  lockBanner: {
    marginTop: 12,
    border: "1px solid rgba(160,0,0,0.25)",
    background: "rgba(200,0,0,0.07)",
    borderRadius: 12,
    padding: 12,
    color: "#7a0000",
    fontSize: 13,
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

/** e.g. teamMeta("0-3", "-3") -> " (0-3, -3)"; either piece may be missing. */
function teamMeta(record, spread) {
  const parts = [record, spread].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/* ---------- Simple validator ---------- */
function validate({ user, week, picks, tiebreakers }) {
  const e = {};
  if (!user?.name?.trim()) e.name = "Full name is required";
  if (!/^\S+@\S+\.\S+$/.test(user?.email || "")) e.email = "Valid email is required";

  const totalGames = (week?.games || []).length;
  const picksMade = Object.values(picks || {}).filter(Boolean).length;
  if (totalGames > 0 && picksMade < totalGames) e.picks = "Please pick every matchup";

  const tb = tiebreakers || [];
  if (tb.length !== 3 || tb.some((t) => String(t.total || "").trim() === "")) {
    e.tiebreakers = "Enter totals for all 3 tiebreakers";
  }
  return e;
}

/** NFL season helper (Jan–Jul should usually be previous season) */
function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  // If we're before Aug, assume we're still in the prior NFL season year
  return m < 7 ? y - 1 : y;
}

export default function App() {
  const [week, setWeek] = useState({ week: "", deadline: "", games: [], tiebreakers: [], byes: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // hover styles for bottom buttons
  const [printBtnStyle, setPrintBtnStyle] = useState(styles.btn);
  const [submitBtnStyle, setSubmitBtnStyle] = useState(styles.btnPrimary);

  // header-ish nav button hover styles
  const [navResultsStyle, setNavResultsStyle] = useState(styles.navBtn);
  const [navAdminStyle, setNavAdminStyle] = useState(styles.navBtn);
  const [navLeaderboardStyle, setNavLeaderboardStyle] = useState(styles.navBtn);
  const [navRulesStyle, setNavRulesStyle] = useState(styles.navBtn);
  const [navReglasStyle, setNavReglasStyle] = useState(styles.navBtn);

  const navigate = useNavigate();
  const session = getSession();

  const [user, setUser] = useState({ name: session?.fullName || "", email: "" });
  const [picks, setPicks] = useState({}); // { [gameId]: "AWAY" | "HOME" }
  const [tbs, setTbs] = useState([]); // [{ gameId, total }]

  // % stats per game: { [gameId]: { away, home, tie, total } }
  const [stats, setStats] = useState({});

  // kickoff map: { [gameId]: "2025-09-07T18:00:00Z" }
  const [kickoffById, setKickoffById] = useState({});

  // ticking clock so locks update even if page stays open
  const [nowTs, setNowTs] = useState(() => Date.now());

  /* Load week from DB (C2) */
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
          week: data.week,
          deadline: data.deadline || "", // ✅ deadline now used for global lock
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

  // update "now" every 30 seconds so lock state updates on screen
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  function logout() {
    clearSession();
    navigate("/login");
  }

  // ✅ GLOBAL DEADLINE LOCK (whole sheet)
  const deadlineObj = useMemo(() => {
    if (!week.deadline) return null;
    const d = new Date(week.deadline);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [week.deadline]);

  const isDeadlineLocked = useMemo(() => {
    if (!deadlineObj) return false; // If no deadline set, don't lock
    return nowTs >= deadlineObj.getTime();
  }, [deadlineObj, nowTs]);

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

  const errors = useMemo(() => validate({ user, week, picks, tiebreakers: tbs }), [user, week, picks, tbs]);
  const isValid = Object.keys(errors).length === 0;

  function setPick(gameId, value) {
    setPicks((p) => ({ ...p, [gameId]: value }));
  }

  function setTBTotal(i, value) {
    setTbs((arr) => {
      const next = [...arr];
      next[i] = { ...next[i], total: value.replace(/[^0-9]/g, "") };
      return next;
    });
  }

  function isValidTBValue(v) {
    return typeof v === "string" && /^[0-9]+$/.test(v);
  }

  // helper: is a specific game locked yet? (locks 1 hour before kickoff)
  function isGameLocked(gameId) {
    const kickoffIso = kickoffById?.[gameId];
    if (!kickoffIso) return false;
    const kickoffMs = new Date(kickoffIso).getTime();
    if (Number.isNaN(kickoffMs)) return false;
    return nowTs >= kickoffMs - 60 * 60 * 1000;
  }

  // ✅ unified lock: deadline OR kickoff
  function isAnyLockActiveForGame(gameId) {
    return isDeadlineLocked || isGameLocked(gameId);
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

  /* ---------- Build concise (for Formspree email body) ---------- */
  function buildConciseSubmission({ user, week, picks, tiebreakers }) {
    const games = week.games.map((g) => ({
      id: g.id,
      label: `${g.away} @ ${g.home}`,
      pick: picks[g.id] === "HOME" ? g.home : picks[g.id] === "AWAY" ? g.away : "Tie",
    }));

    const selected = games.filter((g) => !!picks[g.id]);

    const tbLines = tiebreakers.map((tb) => {
      const g = week.games.find((x) => x.id === tb.gameId);
      return {
        id: tb.gameId,
        label: g ? `${g.away} @ ${g.home}` : tb.gameId,
        total: tb.total,
      };
    });

    return {
      _subject: `Week ${week.week} — ${user.name} (${user.email})`,
      picks: selected.map((g) => `${g.label} → ${g.pick}`),
      tiebreakers: tbLines.map((t) => `${t.label}: ${t.total} total`),
    };
  }

  /* ---------- Submit: save to Supabase (+ optional Formspree) ---------- */
  async function submitEmail(e) {
    e.preventDefault();

    // ✅ Hard stop if global deadline locked
    if (isDeadlineLocked) {
      alert(
        `Picks are locked (deadline passed).${
          deadlineObj ? `\nDeadline was: ${deadlineObj.toLocaleString()}` : ""
        }`
      );
      return;
    }

    const missingGames = week.games.filter((g) => !picks[g.id]);

    // block submit if missing picks for games that already started
    const lockedMissing = missingGames.filter((g) => isGameLocked(g.id));
    if (lockedMissing.length > 0) {
      const names = lockedMissing.map((g) => `${g.away} @ ${g.home}`).join(", ");
      alert(
        `Too late — these games already started and are missing picks:\n${names}\n\nYou can’t submit after kickoff if a pick is missing.`
      );
      return;
    }

    if (missingGames.length > 0) {
      alert(
        `You missed ${missingGames.length} game${missingGames.length > 1 ? "s" : ""}. Please make all selections before submitting.`
      );
      return;
    }

    if (!Array.isArray(tbs) || tbs.length !== 3) {
      alert("Please enter totals for all 3 tiebreakers.");
      return;
    }

    const tbMissing = tbs.findIndex((tb) => !isValidTBValue(tb?.total));
    if (tbMissing !== -1) {
      alert(`Please enter a number for Tiebreaker ${tbMissing + 1}.`);
      document.getElementById(`tb_${tbMissing + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!isValid) return;

    try {
      const name = (user.name || "").trim();
      if (!name) {
        alert("Please enter your name.");
        return;
      }

      // 1) Build rows for PICKS
      const rows = (week.games || [])
        .filter((g) => g?.id && picks[g.id])
        .map((g) => ({
          week: week.week,
          game_id: g.id,
          pick: picks[g.id], // "AWAY" | "HOME" | "TIE"
          user_name: name,
        }));

      if (rows.length === 0) {
        alert("Please make at least one pick before submitting.");
        return;
      }

      // 2) Save PICKS
      const { error: pickError } = await supabase.from("picks").upsert(rows, { onConflict: "week,game_id,user_name" });

      if (pickError) {
        if (pickError.code === "23505") {
          alert("Looks like you already submitted a pick for one or more games this week under this name.");
          return;
        }
        console.error("Supabase picks error:", pickError);
        alert("There was a problem saving your picks.");
        return;
      }

      // 3) Build rows for TIEBREAKERS
      const tbRows = (tbs || []).map((tb, idx) => ({
        week: week.week,
        user_name: name,
        tb_no: idx + 1,
        game_id: tb.gameId,
        total: Number.parseInt(tb.total, 10) || 0,
      }));

      if (tbRows.length === 3) {
        const { error: tbError } = await supabase
          .from("tiebreakers")
          .upsert(tbRows, { onConflict: "week,user_name,tb_no" });
        if (tbError) {
          console.error("Supabase tiebreakers error:", tbError);
          alert("Your picks were saved, but there was a problem saving tiebreakers. Please try again.");
          return;
        }
      }

      // 4) Optional Formspree email
      if (FORMSPREE_ENDPOINT) {
        try {
          const concise = buildConciseSubmission({ user, week, picks, tiebreakers: tbs });
          await fetch(FORMSPREE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...concise }),
          });
        } catch (e) {
          console.error("Formspree error (non-blocking):", e);
        }
      }

      alert("Submitted! Thank you — your picks and tiebreakers were saved.");
      loadStats(week.week);
    } catch (err) {
      console.error("submitEmail crashed:", err);
      alert("There was a problem processing your submission.");
    }
  }

  function printPDF() {
    window.print();
  }

  if (loading) return <Shell><p>Loading…</p></Shell>;
  if (err) return <Shell><p style={{ color: "red" }}>{err}</p></Shell>;

  const deadline = deadlineObj;

  return (
    <Shell>
      <div className="page-overlay" style={styles.pageOverlay}>
        {/* Header row: title left, nav buttons right */}
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <h1 style={styles.h1}>NFL Weekly Picks</h1>
            <p style={styles.muted}>
              Week {week.week}
              {deadline ? ` • Due by ${deadline.toLocaleString()}` : ""}
            </p>

            {/* ✅ Deadline lock banner */}
            {isDeadlineLocked ? (
              <div style={styles.lockBanner}>
                <b>🔒 Picks are locked.</b>{" "}
                {deadline ? (
                  <span>Deadline passed: <b>{deadline.toLocaleString()}</b></span>
                ) : (
                  <span>Deadline passed.</span>
                )}
              </div>
            ) : null}
          </div>

          <div style={styles.headerRight}>
            <Link to="/results">
              <button
                type="button"
                style={navResultsStyle}
                onMouseEnter={() => setNavResultsStyle({ ...styles.navBtn, ...styles.navBtnHover })}
                onMouseLeave={() => setNavResultsStyle(styles.navBtn)}
              >
                View Picks Table
              </button>
            </Link>

            <Link to="/leaderboard">
              <button
                type="button"
                style={navLeaderboardStyle}
                onMouseEnter={() => setNavLeaderboardStyle({ ...styles.navBtn, ...styles.navBtnHover })}
                onMouseLeave={() => setNavLeaderboardStyle(styles.navBtn)}
              >
                Live Leaderboard
              </button>
            </Link>

            <Link to="/rules">
              <button
                type="button"
                style={navRulesStyle}
                onMouseEnter={() => setNavRulesStyle({ ...styles.navBtn, ...styles.navBtnHover })}
                onMouseLeave={() => setNavRulesStyle(styles.navBtn)}
              >
                Rules
              </button>
            </Link>

            <Link to="/reglas">
              <button
                type="button"
                style={navReglasStyle}
                onMouseEnter={() => setNavReglasStyle({ ...styles.navBtn, ...styles.navBtnHover })}
                onMouseLeave={() => setNavReglasStyle(styles.navBtn)}
              >
                Reglas
              </button>
            </Link>

            <PaymentMenu />

            <button type="button" style={styles.navBtn} onClick={logout} title="Log out">
              Log out
            </button>
          </div>
        </div>

        {session?.fullName && (
          <p style={{ ...styles.mutedSmall, marginTop: 10 }}>
            Signed in as <b>{session.fullName}</b> (@{session.username})
          </p>
        )}

        <form onSubmit={submitEmail} style={{ display: "grid", gap: 16, marginTop: 14 }}>
          {/* Player info */}
          <Card>
            <div style={styles.row}>
              <Field label="Full name">
                <input
                  type="text"
                  style={{ ...styles.input, cursor: "not-allowed" }}
                  value={user.name}
                  disabled
                  readOnly
                />
              </Field>
              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  style={styles.input}
                  placeholder="you@email.com"
                  value={user.email}
                  disabled={isDeadlineLocked}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          {/* Games */}
          <Card>
            <h2 style={styles.h2}>Matchups</h2>
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              {week.games.map((g, idx) => (
                <GameRow
                  key={g.id || idx}
                  index={idx}
                  game={g}
                  pick={picks[g.id]}
                  onPick={setPick}
                  gameStats={stats[g.id]}
                  locked={isAnyLockActiveForGame(g.id)}
                  kickoffIso={kickoffById[g.id] || ""}
                  lockedReason={isDeadlineLocked ? "deadline" : isGameLocked(g.id) ? "kickoff" : ""}
                />
              ))}
            </div>
            {errors.picks && <ErrorText>{errors.picks}</ErrorText>}
          </Card>

          {/* Predetermined tiebreakers */}
          {(() => {
            const allTbsFilled = tbs.length === 3 && tbs.every((tb) => String(tb.total || "").trim() !== "");
            return (
            <div style={{
              ...styles.card,
              background: allTbsFilled ? "rgba(10, 155, 45, 0.07)" : styles.card.background,
              transition: "background 0.4s",
            }}>
            <h2 style={styles.h2}>Tiebreakers (total combined points)</h2>
            <p style={styles.mutedSmall}>We picked the games. Enter the total points for each.</p>

            <div style={{ display: "grid", gap: 10 }}>
              {tbs.map((tb, i) => {
                const g = week.games.find((x) => x.id === tb.gameId);
                if (!g) return null;
                const filled = String(tb.total || "").trim() !== "";
                return (
                  <div key={tb.gameId} style={styles.tbRow}>
                    <label style={styles.tbLabel}>
                      Tiebreaker {i + 1}: {g.away} @ {g.home}
                    </label>
                    <input
                      id={`tb_${i + 1}`}
                      style={{
                        ...styles.input,
                        transition: "box-shadow 0.3s",
                        boxShadow: filled
                          ? "0 0 0 3px rgba(25, 185, 55, 0.45)"
                          : "none",
                      }}
                      inputMode="numeric"
                      placeholder="Total points"
                      value={tb.total}
                      disabled={isDeadlineLocked}
                      onChange={(e) => setTBTotal(i, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>

            {errors.tiebreakers && <ErrorText>{errors.tiebreakers}</ErrorText>}

            {/* Teams on Bye */}
            {week.byes?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ margin: "8px 0 12px", fontSize: 18 }}>Teams on Bye</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {week.byes.map((team) => (
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
            </div>
            );
          })()}

          {/* Actions (bottom only) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="submit"
              style={submitBtnStyle}
              onMouseEnter={() => setSubmitBtnStyle({ ...styles.btnPrimary, ...styles.btnPrimaryHover })}
              onMouseLeave={() => setSubmitBtnStyle(styles.btnPrimary)}
              disabled={!isValid || isDeadlineLocked}
              title={isDeadlineLocked ? "Locked (deadline passed)" : ""}
            >
              {isDeadlineLocked ? "Locked" : "Submit Picks"}
            </button>

            <button
              type="button"
              style={printBtnStyle}
              onMouseEnter={() => setPrintBtnStyle({ ...styles.btn, ...styles.btnHover })}
              onMouseLeave={() => setPrintBtnStyle(styles.btn)}
              onClick={printPDF}
            >
              Print / Save as PDF
            </button>
          </div>
        </form>

        {/* Admin box */}
        {session?.isAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: "10px 14px", textAlign: "right", background: "rgba(255,255,255,0.7)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" }}>
                Only for Admins
              </div>
              <Link to="/admin">
                <button
                  type="button"
                  style={navAdminStyle}
                  onMouseEnter={() => setNavAdminStyle({ ...styles.navBtn, ...styles.navBtnHover })}
                  onMouseLeave={() => setNavAdminStyle(styles.navBtn)}
                >
                  Admin Dashboard
                </button>
              </Link>
            </div>
          </div>
        )}

        <Footer />
      </div>

      {/* Print styles */}
      <style>{`@media print {
        button { display:none !important; }
        input, select { border: none !important; }
        body { background: white; }
      }`}</style>
    </Shell>
  );
}

/* ---------- Table + bars summary per game (higher % = green) ---------- */
function PickSummary({ awayLabel, homeLabel, awayCount, homeCount, awayLogo, homeLogo }) {
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
    <div style={{ marginTop: 10 }}>
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
        <div>{awayLabel}</div>
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
        <div>{homeLabel}</div>
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

/* ---------- Game row (summary + pick buttons) ---------- */
function GameRow({ game, index, pick, onPick, gameStats, locked, kickoffIso, lockedReason }) {
  const awayLogo = logoSrc(game.away);
  const homeLogo = logoSrc(game.home);

  const awayCount = gameStats?.away || 0;
  const homeCount = gameStats?.home || 0;

  let lockNote = "";
  if (locked) {
    lockNote =
      lockedReason === "deadline"
        ? "🔒 Locked — deadline passed"
        : "🔒 Locked — game started";
  } else {
    if (kickoffIso) {
      const lockTime = new Date(new Date(kickoffIso).getTime() - 60 * 60 * 1000);
      lockNote = `Locks 1 hr before kickoff: ${lockTime.toLocaleString()}`;
    }
  }

  // Blowup background: logo of the selected team
  const selectedLogo = pick === "AWAY" ? awayLogo : pick === "HOME" ? homeLogo : null;
  const selectedTeam = pick === "AWAY" ? game.away : pick === "HOME" ? game.home : null;

  return (
    <div
      style={{
        ...styles.gameRow,
        position: "relative",
        // No overflow:hidden here — keeps the selected button's glow from clipping on the right
        background: pick ? "rgba(10, 155, 45, 0.055)" : "transparent",
        transition: "background 0.35s",
        paddingRight: 10, // breathing room for button glow
      }}
    >
      {/* ── Blowup logo background — overflow:hidden lives on this inner div, not the row ── */}
      {selectedLogo && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={selectedLogo}
            alt=""
            aria-hidden="true"
            style={{
              height: 210,
              width: "auto",
              objectFit: "contain",
              opacity: 0.11,
              flexShrink: 0,
              filter: "saturate(1.8)",
              transition: "opacity 0.4s",
            }}
          />
        </div>
      )}

      {/* ── Left: game info + stats ── */}
      <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#000", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          Game {index + 1}: {game.away}{teamMeta(game.awayRecord, game.awaySpread)} @ {game.home}
          {teamMeta(game.homeRecord, game.homeSpread)}
          {selectedTeam && (
            <span style={{
              fontSize: 12, fontWeight: 800, color: "#1a7a28",
              background: "rgba(25, 185, 55, 0.12)",
              border: "1px solid rgba(25, 185, 55, 0.3)",
              padding: "2px 9px", borderRadius: 999,
            }}>
              ✓ {selectedTeam}
            </span>
          )}
        </div>

        {lockNote ? (
          <div style={{ fontSize: 12, marginTop: 4, color: locked ? "#a00" : "rgba(0,0,0,0.65)" }}>{lockNote}</div>
        ) : null}

        <PickSummary
          awayLabel={game.away}
          homeLabel={game.home}
          awayCount={awayCount}
          homeCount={homeCount}
          awayLogo={awayLogo}
          homeLogo={homeLogo}
        />
      </div>

      {/* ── Right: pick buttons (AWAY + VS + HOME — no TIE) ── */}
      <div style={{ ...styles.pickGroup, position: "relative", zIndex: 1 }}>
        {[
          { v: "AWAY", label: game.away, logo: awayLogo, title: `${game.away} (Away)` },
          { v: "HOME", label: game.home, logo: homeLogo, title: `${game.home} (Home)` },
        ].reduce((acc, opt, i) => {
          if (i === 1) acc.push(<VsAnimation key="vs" />);
          const isSelected = pick === opt.v;
          const disabled = locked;
          acc.push(
            <label
              key={opt.v}
              style={{
                ...styles.logoButton,
                ...(isSelected ? styles.logoButtonSelected : {}),
                ...(disabled ? styles.logoButtonDisabled : {}),
              }}
              title={disabled ? "Locked" : opt.title}
            >
              <input
                type="radio"
                name={`pick_${game.id}`}
                checked={isSelected}
                disabled={disabled}
                onChange={() => !disabled && onPick(game.id, opt.v)}
                style={styles.radioActual}
                aria-label={opt.label}
              />
              {opt.logo && (
                <img
                  src={opt.logo}
                  alt={opt.label}
                  style={styles.logoOnly}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <span style={styles.srOnly}>{opt.label}</span>
            </label>
          );
          return acc;
        }, [])}
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
function Field({ label, required, error, children }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
      <span>
        {label} {required && <span style={{ color: "#c00" }}>*</span>}
      </span>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </label>
  );
}
function ErrorText({ children }) {
  return <p style={{ color: "#c00", fontSize: 13, marginTop: 6 }}>{children}</p>;
}
function Footer() {
  return (
    <p style={{ textAlign: "center", fontSize: 12, color: "rgba(0,0,0,0.75)", marginTop: 16 }}>
      © NFL Weekly Picks — Print to save a PDF copy.
    </p>
  );
}

/* ---------- Payment Options dropdown ---------- */
const ZELLE_CONTACT = "926.235.4891";
const PAYMENT_LINKS = [
  { name: "Venmo", url: "https://www.venmo.com/u/Adrian-Perez-21" },
  { name: "Cash App", url: "https://cash.app/$nano1454" },
  { name: "PayPal", url: "https://paypal.me/AdrianPerez184" },
];

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
      <button type="button" style={styles.navBtn} onClick={() => setOpen((o) => !o)}>
        Payment Options
      </button>

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