import React, { useEffect, useMemo, useState } from "react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xovlredw"; // direct submit
const RECIPIENT_EMAIL = "aperez01@live.com";                   // fallback mailto

export default function App() {
  const [week, setWeek] = useState({ week: "", deadline: "", games: [], tiebreakers: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [user, setUser] = useState({ name: "", email: "" });
  // picks: { [gameId]: "AWAY" | "HOME" | "TIE" }
  const [picks, setPicks] = useState({});
  // tiebreakers: [{ gameId, total }]
  const [tbs, setTbs] = useState([]);

  // hover styles
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

  async function submitEmail(e) {
    e.preventDefault();
    if (!isValid) return;

    // Build minimal, concise payload/body
    const concise = buildConciseSubmission({ user, week, picks, tiebreakers: tbs });

    // Try Formspree first (emails you without opening an email app)
    if (FORMSPREE_ENDPOINT) {
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(concise), // only picks + tiebreakers in body
        });
        if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
        alert("Submitted! Thank you.");
        return;
      } catch (err) {
        console.error(err);
        // fall through to mailto
      }
    }

    // Fallback: mailto (also only picks + tiebreakers)
    const subject = `Week ${week.week} — ${user.name} (${user.email})`;
    const body = formatConciseEmail(concise);
    const href = `mailto:${encodeURIComponent(RECIPIENT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
          <div style={{ borderTop: "1px solid #eee" }}>
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
  return (
    <div style={styles.gameRow}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          Game {index + 1}: {game.away} @ {game.home}
        </div>
        {(game.date || game.time) && (
          <div style={styles.mutedSmall}>
            {game.date || ""} {game.time || ""}
          </div>
        )}
      </div>
      <div style={styles.pickGroup}>
        {[
          { v: "AWAY", label: game.away },
          { v: "HOME", label: game.home },
          { v: "TIE", label: "Tie" },
        ].map((opt) => (
          <label key={opt.v} style={styles.radioLabel}>
            <input
              type="radio"
              name={`pick_${game.id}`}
              checked={pick === opt.v}
              onChange={() => onPick(game.id, opt.v)}
            />
            {opt.label}
          </label>
        ))}
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

// Build ONLY the concise data we want to send/store
function buildConciseSubmission({ user, week, picks, tiebreakers }) {
  // Convert picks object into pretty lines like "Cowboys @ Eagles → Cowboys"
  const games = week.games.map((g) => ({
    id: g.id,
    label: `${g.away} @ ${g.home}`,
    pick: picks[g.id] === "HOME" ? g.home : picks[g.id] === "AWAY" ? g.away : "Tie",
  }));

  // Keep only games that have a selection
  const selected = games.filter((g) => !!picks[g.id]);

  // Map tiebreakers to {label, total}
  const tbLines = tiebreakers.map((tb) => {
    const g = week.games.find((x) => x.id === tb.gameId);
    return {
      id: tb.gameId,
      label: g ? `${g.away} @ ${g.home}` : tb.gameId,
      total: tb.total,
    };
  });

  return {
    _subject: `Week ${week.week} — ${user.name} (${user.email})`, // Formspree uses this as email subject
    picks: selected.map((g) => `${g.label} → ${g.pick}`),          // array of strings
    tiebreakers: tbLines.map((t) => `${t.label}: ${t.total} total`) // array of strings
  };
}

// Very short body for mailto fallback
function formatConciseEmail(concise) {
  const lines = [];
  lines.push("Picks:");
  concise.picks.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  lines.push("");
  lines.push("Tiebreakers (total points):");
  concise.tiebreakers.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  return lines.join("\n");
}

/* ===== UI (inline styles) ===== */

function Shell({ children }) {
  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
function Card({ children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  );
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
    <p style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 16 }}>
      © NFL Weekly Picks — Print to save a PDF copy.
    </p>
  );
}

const styles = {
  h1: { fontSize: 28, fontWeight: 700, margin: "0 0 4px" },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  muted: { color: "#333", margin: "0 0 16px" },
  mutedSmall: { color: "#444", fontSize: 13, margin: "4px 0 12px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  input: {
    padding: "10px 12px",
    border: "1px solid #9ca3af",
    borderRadius: 8,
    background: "#333", // dark input background
    color: "#fff",      // white text for contrast
    width: "100%",
    boxSizing: "border-box"
  },
  btn: {
    padding: "10px 16px",
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "#fff",
    color: "#000",
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
  },
  btnHover: { background: "#f5f5f5", color: "#000" },
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
  gameRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" },
  pickGroup: { display: "flex", gap: 14, alignItems: "center" },
  radioLabel: { display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14 },
  tbRow: { display: "flex", alignItems: "center", gap: 10, padding: "4px 0" },
  tbLabel: { width: 360, fontSize: 14, fontWeight: 600 },
};
