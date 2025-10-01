import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";


/** Optional: keep Formspree so you still receive an email copy (no mailto popups) */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xovlredw";

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
  "Washington Commanders": "commanders"
};

function logoSrc(team) {
  const slug = teamLogoSlug[team];
  return slug ? `/logos/${slug}.png` : null;
}

/* ---------- Simple validator ---------- */
function validate({ user, week, picks, tiebreakers }) {
  const e = {};
  if (!user?.name?.trim()) e.name = "Full name is required";
  if (!/^\S+@\S+\.\S+$/.test(user?.email || "")) e.email = "Valid email is required";

  const anyPick = Object.values(picks || {}).some(Boolean);
  if (!anyPick) e.picks = "Please make at least one pick";

  const tb = tiebreakers || [];
  if (tb.length !== 3 || tb.some(t => String(t.total || "").trim() === "")) {
    e.tiebreakers = "Enter totals for all 3 tiebreakers";
  }
  return e;
}

export default function App() {
  const [week, setWeek] = useState({ week: "", deadline: "", games: [], tiebreakers: [], byes: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [user, setUser] = useState({ name: "", email: "" });
  const [picks, setPicks] = useState({}); // { [gameId]: "AWAY" | "HOME" | "TIE" }
  const [tbs, setTbs] = useState([]);     // [{ gameId, total }]

  // % stats per game: { [gameId]: { away, home, tie, total } }
  const [stats, setStats] = useState({});

  // hover styles for buttons
  const [printBtnStyle, setPrintBtnStyle] = useState(styles.btn);
  const [submitBtnStyle, setSubmitBtnStyle] = useState(styles.btnPrimary);

  /* Load week.json */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/week.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not load week.json (${res.status})`);
        const data = await res.json();

        // ensure exactly 3 predetermined tiebreakers
        let tbIds = Array.isArray(data.tiebreakers) ? data.tiebreakers.slice(0, 3) : [];
        if (tbIds.length < 3) {
          tbIds = (data.games || []).slice(0, 3).map((g) => g.id).slice(0, 3);
        }

        setWeek({ week: data.week, deadline: data.deadline, games: data.games || [], tiebreakers: tbIds, byes: Array.isArray(data.byes) ? data.byes : [] });
        setTbs(tbIds.map((id) => ({ gameId: id, total: "" })));
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Load stats when week ready + (optional) realtime updates */
  useEffect(() => {
    if (!week.week || week.games.length === 0) return;

    loadStats(week.week);

    // Realtime: refresh when any insert happens for this week (guarded)
    const canRealtime =
      supabase &&
      typeof supabase.channel === "function" &&
      typeof supabase.removeChannel === "function";

    if (!canRealtime) return;

    let channel;
    try {
      channel = supabase
        .channel("picks_live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "picks", filter: `week=eq.${week.week}` },
          () => loadStats(week.week)
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

  /* ---------- Stats loader ---------- */
  async function loadStats(currentWeek) {
    try {
      const { data, error } = await supabase
        .from("picks")
        .select("game_id, pick")
        .eq("week", currentWeek);

      if (error) {
        console.error("Supabase select error:", error);
        return;
      }

      const map = {};
      for (const g of (week.games || [])) {
        if (!g?.id) continue;
        map[g.id] = { away: 0, home: 0, tie: 0, total: 0 };
      }
      for (const row of (data || [])) {
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
      pick:
        picks[g.id] === "HOME" ? g.home :
        picks[g.id] === "AWAY" ? g.away :
        "Tie",
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
      tiebreakers: tbLines.map((t) => `${t.label}: ${t.total} total`)
    };
  }

  /* ---------- Submit: save to Supabase (+ optional Formspree) ---------- */
  async function submitEmail(e) {
  e.preventDefault();
  if (!isValid) return;

  try {
    const name = (user.name || "").trim();
    if (!name) {
      alert("Please enter your name.");
      return;
    }

    // 1) Build rows for PICKS
    const rows = (week.games || [])
      .filter((g) => g?.id && picks[g.id]) // only games the user actually picked
      .map((g) => ({
        week: week.week,
        game_id: g.id,
        pick: picks[g.id],       // "AWAY" | "HOME" | "TIE"
        user_name: name
      }));

    if (rows.length === 0) {
      alert("Please make at least one pick before submitting.");
      return;
    }

    // 2) Save PICKS
    // If you created a unique index on (week,game_id,user_name), upsert lets users update their picks
    const { error: pickError } = await supabase
      .from("picks")
      .upsert(rows, { onConflict: "week,game_id,user_name" });
      // If you created user_name_norm instead, use:
      // .upsert(rows, { onConflict: "week,game_id,user_name_norm" });

    if (pickError) {
      // 23505 = unique_violation (only happens with insert; upsert normally avoids it)
      if (pickError.code === "23505") {
        alert("Looks like you already submitted a pick for one or more games this week under this name.");
        return;
      }
      console.error("Supabase picks error:", pickError);
      alert("There was a problem saving your picks.");
      return;
    }

    // 3) Build rows for TIEBREAKERS (3 totals)
    const tbRows = (tbs || []).map((tb, idx) => ({
      week: week.week,
      user_name: name,
      tb_no: idx + 1,                 // 1, 2, 3
      game_id: tb.gameId,             // e.g. "SEA@ARI"
      total: Number.parseInt(tb.total, 10) || 0
    }));

    // Only attempt if we have exactly 3
    if (tbRows.length === 3) {
      const { error: tbError } = await supabase
        .from("tiebreakers")
        .upsert(tbRows, { onConflict: "week,user_name,tb_no" }); // overwrites their own TBs for this week/slot

      if (tbError) {
        console.error("Supabase tiebreakers error:", tbError);
        // Don't block the whole submission if TBs fail, but let the user know
        alert("Your picks were saved, but there was a problem saving tiebreakers. Please try again.");
        return;
      }
    }

    // 4) (Optional) Email you a concise copy via Formspree (if you kept FORMSPREE_ENDPOINT)
    if (FORMSPREE_ENDPOINT) {
      try {
        const concise = buildConciseSubmission({ user, week, picks, tiebreakers: tbs });
        await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...concise }) // (we’re not sending user email anymore)
        });
      } catch (e) {
        console.error("Formspree error (non-blocking):", e);
      }
    }

    alert("Submitted! Thank you — your picks and tiebreakers were saved.");
    // Refresh live stats/bars
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

  const deadline = week.deadline ? new Date(week.deadline) : null;

  return (
    <Shell>
      <div style={styles.pageOverlay}>
        <h1 style={styles.h1}>NFL Weekly Picks</h1>
        <p style={styles.muted}>
          Week {week.week}{deadline ? ` • Due by ${deadline.toLocaleString()}` : ""}
        </p>

        <form onSubmit={submitEmail} style={{ display: "grid", gap: 16 }}>
          {/* Player info */}
          <Card>
            <div style={styles.row}>
              <Field label="Full name" required error={errors.name}>
                <input
                  style={styles.input}
                  placeholder="Your full name"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                />
              </Field>
              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  style={styles.input}
                  placeholder="you@email.com"
                  value={user.email}
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
                />
              ))}
            </div>
            {errors.picks && <ErrorText>{errors.picks}</ErrorText>}
          </Card>

          {/* Predetermined tiebreakers: total points */}
          <Card>
            <h2 style={styles.h2}>Tiebreakers (total combined points)</h2>
            <p style={styles.mutedSmall}>We picked the games. Enter the total points for each.</p>

            <div style={{ display: "grid", gap: 10 }}>
              {tbs.map((tb, i) => {
                const g = week.games.find((x) => x.id === tb.gameId);
                if (!g) return null;
                return (
                  <div key={tb.gameId} style={styles.tbRow}>
                    <label style={styles.tbLabel}>
                      Tiebreaker {i + 1}: {g.away} @ {g.home}
                      {(g.date || g.time) ? ` — ${g.date || ""} ${g.time || ""}` : ""}
                    </label>
                    <input
                      style={styles.input}
                      inputMode="numeric"
                      placeholder="Total points"
                      value={tb.total}
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
</Card>
          

          

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={submitBtnStyle}
              onMouseEnter={() => setSubmitBtnStyle({ ...styles.btnPrimary, ...styles.btnPrimaryHover })}
              onMouseLeave={() => setSubmitBtnStyle(styles.btnPrimary)}
              disabled={!isValid}
            >
              Submit Picks
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

            <Link to="/results">
  <button
       type="button"
              style={printBtnStyle}
              onMouseEnter={() => setResultsBtnStyle({ ...styles.btn, ...styles.btnHover })}
              onMouseLeave={() => setResultsBtnStyle(styles.btn)}
  >
    View Picks Table
  </button>
</Link>


          </div>          
        </form>

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

  // Color logic: higher % = green, lower % = red, tie = gray
  const green = "#2ecc71";
  const red = "#e74c3c";
  const gray = "#bdc3c7";

  let awayColor = gray;
  let homeColor = gray;
  if (total > 0) {
    if (awayPct > homePct) {
      awayColor = green; homeColor = red;
    } else if (homePct > awayPct) {
      awayColor = red; homeColor = green;
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
      {/* Header */}
      <div style={{ ...row, fontWeight: 600, color: "#333" }}>
        <div></div>
        <div>Team</div>
        <div style={{ textAlign: "right" }}>Picks</div>
        <div style={{ textAlign: "right" }}>%</div>
      </div>

      {/* AWAY row */}
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

      {/* HOME row */}
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

/* ---------- Game row (uses only PickSummary now) ---------- */
function GameRow({ game, index, pick, onPick, gameStats }) {
  const awayLogo = logoSrc(game.away);
  const homeLogo = logoSrc(game.home);

  const total = gameStats?.total || 0;
  const awayCount = gameStats?.away || 0;
  const homeCount = gameStats?.home || 0;

  return (
    <div style={styles.gameRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#000" }}>
          Game {index + 1}: {game.away} @ {game.home}
        </div>

        {/* Only the table + stacked bars */}
        <PickSummary
          awayLabel={game.away}
          homeLabel={game.home}
          awayCount={awayCount}
          homeCount={homeCount}
          awayLogo={awayLogo}
          homeLogo={homeLogo}
          total={total}
        />
      </div>

      {/* Picks: logos only for AWAY/HOME, small pill for TIE */}
      <div style={styles.pickGroup}>
        {[
          { v: "AWAY", label: game.away, logo: awayLogo, title: `${game.away} (Away)` },
          { v: "HOME", label: game.home, logo: homeLogo, title: `${game.home} (Home)` },
          { v: "TIE",  label: "Tie",     logo: null,      title: "Tie" }
        ].map((opt) => {
          const isSelected = pick === opt.v;
          const base = styles.logoButton;
          const selected = isSelected ? styles.logoButtonSelected : {};
          return (
            <label key={opt.v} style={{ ...base, ...selected }} title={opt.title}>
              <input
                type="radio"
                name={`pick_${game.id}`}
                checked={isSelected}
                onChange={() => onPick(game.id, opt.v)}
                style={styles.radioActual}
                aria-label={opt.label}
              />
              {opt.logo ? (
                <img
                  src={opt.logo}
                  alt={opt.label}
                  style={styles.logoOnly}
                  onError={(e)=>e.currentTarget.style.display='none'}
                />
              ) : (
                <span style={styles.tiePill}>TIE</span>
              )}
              <span style={styles.srOnly}>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Layout & UI ---------- */
function Shell({ children }) {
  return (
    <>
      {/* mobile fix: ensure full height & avoid iOS fixed-bg quirk */}
      <style>
        {`
          html, body, #root { height: 100%; }
          @media (max-width: 768px) {
            #app-shell { background-attachment: scroll !important; }
          }
        `}
      </style>

      <div
        id="app-shell"
        style={{
          background: "url('/background.png') center / cover no-repeat",
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 24,
          boxSizing: "border-box",
          color: "#000"
        }}
      >
        {children}
      </div>
    </>
  );
}

function Card({ children }) {
  return <div style={styles.card}>{children}</div>;
}
function Field({ label, required, error, children }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
      <span>{label} {required && <span style={{ color: "#c00" }}>*</span>}</span>
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

/* ---------- Styles ---------- */
const styles = {
  pageOverlay: {
    maxWidth: 920,
    width: "100%",
    margin: "24px auto",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    padding: 20,
    color: "#000"
  },
  card: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.10)"
  },
  h1: { fontSize: 28, fontWeight: 800, margin: "0 0 4px", letterSpacing: 0.2 },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  muted: { color: "rgba(0,0,0,0.75)", margin: "0 0 16px" },
  mutedSmall: { color: "rgba(0,0,0,0.75)", fontSize: 13, margin: "4px 0 12px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  input: {
    padding: "10px 12px",
    border: "1px solid #9ca3af",
    borderRadius: 8,
    background: "#333",
    color: "#fff",
    width: "100%",
    boxSizing: "border-box"
  },

  btn: {
    padding: "10px 16px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.9)",
    color: "#000",
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
    backdropFilter: "saturate(120%) blur(2px)"
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

  gameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    gap: 12
  },
  pickGroup: { display: "flex", gap: 10, alignItems: "center" },

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
    backdropFilter: "saturate(120%) blur(2px)"
  },
  logoButtonSelected: { border: "#111 solid 2px" },
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
    fontSize: 12
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
    border: 0
  }
};
