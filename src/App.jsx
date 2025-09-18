import React, { useEffect, useMemo, useState } from "react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xovlredw"; // direct submit
const RECIPIENT_EMAIL = "aperez01@live.com";                   // fallback mailto

// Map official full team names to short slugs for logo filenames.
// Place PNGs in: /public/logos/<slug>.png  (all lowercase)
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

export default function App() {
  const [week, setWeek] = useState({ week: "", deadline: "", games: [], tiebreakers: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [user, setUser] = useState({ name: "", email: "" });
  const [picks, setPicks] = useState({});      // { [gameId]: "AWAY" | "HOME" | "TIE" }
  const [tbs, setTbs] = useState([]);          // [{ gameId, total }]

  // hover styles for buttons
  const [printBtnStyle, setPrintBtnStyle] = useState(styles.btn);
  const [submitBtnStyle, setSubmitBtnStyle] = useState(styles.btnPrimary);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/week.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not load week.json (${res.status})`);
        const data = await res.json();

        // Ensure exactly 3 predetermined tiebreakers
        let tbIds = Array.isArray(data.tiebreakers) ? data.tiebreakers.slice(0, 3) : [];
        if (tbIds.length < 3) {
          tbIds = (data.games || []).slice(0, 3).map((g) => g.id).slice(0, 3);
        }

        setWeek({ week: data.week, deadline: data.deadline, games: data.games || [], tiebreakers: tbIds });
        setTbs(tbIds.map((id) => ({ gameId: id, total: "" })));
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  // Build ONLY the concise data to email/store: winners + tiebreaker totals
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
      tiebreakers: tbLines.map((t) => `${t.label}: ${t.total} total`)
    };
  }

  function formatConciseEmail(concise) {
    const lines = [];
    lines.push("Picks:");
    concise.picks.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    lines.push("");
    lines.push("Tiebreakers (total points):");
    concise.tiebreakers.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
    return lines.join("\n");
  }

  // After submit, send the user a copy via mailto (they hit Send)
  function sendUserCopyMailto(concise, userEmail, weekNum) {
    if (!/^\S+@\S+\.\S+$/.test(userEmail)) return;
    const subject = `Copy of your NFL Picks — Week ${weekNum}`;
    const body = formatConciseEmail(concise);
    const href = `mailto:${encodeURIComponent(userEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(href, "_blank");
  }

  async function submitEmail(e) {
    e.preventDefault();
    if (!isValid) return;

    const concise = buildConciseSubmission({ user, week, picks, tiebreakers: tbs });

    // Try Formspree first (no email app required)
    if (FORMSPREE_ENDPOINT) {
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Include user.email so Formspree can auto-respond if you enable it in the dashboard
          body: JSON.stringify({ ...concise, email: user.email }),
        });
        if (!res.ok) throw new Error(`Submit failed: ${res.status}`);

        // Give the user a copy of their picks via mailto (they just click Send)
        sendUserCopyMailto(concise, user.email, week.week);

        alert("Submitted! Check your email for a copy of your picks.");
        return;
      } catch (err) {
        console.error(err);
        // fall through to mailto fallback
      }
    }

    // Fallback: mailto (also only concise data) — bcc the user so they get a copy automatically
    const subject = `Week ${week.week} — ${user.name} (${user.email})`;
    const body = formatConciseEmail(concise);
    const href = `mailto:${encodeURIComponent(RECIPIENT_EMAIL)}?subject=${encodeURIComponent(subject)}&bcc=${encodeURIComponent(user.email)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
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
                <GameRow key={g.id || idx} index={idx} game={g} pick={picks[g.id]} onPick={setPick} />
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

function GameRow({ game, index, pick, onPick }) {
  const awayLogo = logoSrc(game.away);
  const homeLogo = logoSrc(game.home);

  return (
    <div style={styles.gameRow}>
      {/* Header ONLY text (reduced clutter) */}
<div style={{ fontWeight: 700, fontSize: 16, color: "#000" }}>
  Game {index + 1}: {game.away} @ {game.home}
</div>



      {/* Picks: logos only for AWAY/HOME, small text for TIE */}
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

/* ===== Helpers ===== */
function validate({ user, week, picks, tiebreakers }) {
  const e = {};
  if (!user.name.trim()) e.name = "Name is required";
  if (!/^\S+@\S+\.\S+$/.test(user.email)) e.email = "Valid email required";
  if (!week.games?.length) e.week = "No games loaded.";
  const missing = (week.games || []).filter((g) => !picks[g.id]);
  if (missing.length) e.picks = `Please make a selection for all ${week.games.length} games.`;
  const tbBad = !Array.isArray(tiebreakers) || tiebreakers.length !== 3 || tiebreakers.some((tb) => !tb.gameId || tb.total === "");
  if (tbBad) e.tiebreakers = "Please enter the total points for all three tiebreakers.";
  return e;
}

/* ===== Layout with background ===== */
function Shell({ children }) {
  return (
    <>
      {/* mobile fix: avoid iOS quirks with fixed backgrounds */}
      <style>
        {`
          @media (max-width: 768px) {
            #app-shell { background-attachment: scroll !important; }
          }
        `}
      </style>

      <div
        id="app-shell"
        style={{
          // if you're using public/ path:
          // background: "url('/background.png') center / cover no-repeat",
          // if you're using imported asset, use:
          // backgroundImage: `url(${bg})`,
          background: "url('/background.png') center / cover no-repeat",
          minHeight: "100vh",        // fill viewport
          width: "100%",
          display: "flex",           // center horizontally
          justifyContent: "center",
          // don't center vertically so long lists can scroll
          alignItems: "flex-start",
          padding: 24,
          boxSizing: "border-box",
          color: "#000"              // force dark text globally
        }}
      >
        {children}
      </div>
    </>
  );
}




/* ===== UI (inline styles) ===== */
function Card({ children }) {
  return <div style={styles.card}>{children}</div>;
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

const styles = {
  pageOverlay: {
    maxWidth: 920,
    width: "100%",
    margin: "24px auto",                  // centered with top/bottom margin
    background: "rgba(255,255,255,0.82)", // semi-transparent white
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    padding: 20,
    color: "#000"                         // ensure dark text inside
  },
  card: {
    background: "rgba(255,255,255,0.86)",  // slightly more opaque for readability
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
    background: "#333", // dark input background for contrast over bright bg
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

  // Logo-only radio buttons
  radioActual: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none"
  },
  logoOnly: {
    height: 28,
    width: 28,
    objectFit: "contain",
    display: "block"
  },
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
  logoButtonHover: {
    background: "rgba(255,255,255,1)",
    transform: "translateY(-1px)"
  },
  logoButtonSelected: {
    border: "#111 solid 2px"
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
