import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

/** NFL season helper (Jan–Jul should usually be previous season) */
function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  return m < 7 ? y - 1 : y;
}

const STATUS_LABEL = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  final: "Final",
};
const STATUS_COLOR = {
  upcoming: { bg: "rgba(0,0,0,0.05)", border: "rgba(0,0,0,0.15)", text: "#555" },
  in_progress: { bg: "rgba(200,140,0,0.1)", border: "rgba(200,140,0,0.35)", text: "#8a5a00" },
  final: { bg: "rgba(25,185,55,0.1)", border: "rgba(25,185,55,0.4)", text: "#1a7a28" },
};

export default function History() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [season, setSeason] = useState(null);
  const [weeks, setWeeks] = useState([]);

  async function loadHistory() {
    setLoading(true);
    setErr("");
    try {
      const s = getDefaultNflSeasonYear();
      const res = await fetch(`/.netlify/functions/getSeasonHistory?season=${s}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Could not load season history (HTTP ${res.status})`);

      setSeason(data.season);
      const sorted = [...(data.weeks || [])].sort((a, b) => b.week - a.week);
      setWeeks(sorted);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) return <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Season History</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{season}</b> — newest week first
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadHistory}>
            Refresh
          </Button>
          <Link to="/">
            <Button variant="dark" size="sm">← Back</Button>
          </Link>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14, background: "#fff" }}>
          No weeks found for this season yet.
        </div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {weeks.map((w) => {
            const color = STATUS_COLOR[w.status] || STATUS_COLOR.upcoming;
            return (
              <div
                key={w.week}
                style={{
                  border: w.isCurrent ? "1px solid rgba(255,180,0,0.6)" : "1px solid #ddd",
                  boxShadow: w.isCurrent ? "0 0 0 3px rgba(255,180,0,0.15)" : "0 4px 14px rgba(0,0,0,0.05)",
                  borderRadius: 14,
                  padding: 14,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>Week {w.week}</span>
                    {w.isCurrent && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#8a5a00", background: "rgba(255,180,0,0.15)", border: "1px solid rgba(255,180,0,0.4)", borderRadius: 999, padding: "2px 8px" }}>
                        CURRENT
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: color.text,
                        background: color.bg,
                        border: `1px solid ${color.border}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {STATUS_LABEL[w.status] || w.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                    {w.gamesFinal} of {w.gamesTotal} games final
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: 14 }}>
                  {w.topUser ? (
                    <>
                      🏆 <b>{w.topUser}</b> — {Number(w.topPoints).toFixed(1)} pts
                    </>
                  ) : (
                    <span style={{ color: "#888" }}>No results yet</span>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <Link to={`/results?season=${season}&week=${w.week}`}>
                      <Button variant="secondary" size="sm">Picks Table</Button>
                    </Link>
                    <Link to={`/leaderboard?season=${season}&week=${w.week}`}>
                      <Button variant="dark" size="sm">Leaderboard</Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
