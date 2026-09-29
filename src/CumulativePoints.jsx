import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";
import Avatar from "./Avatar";

function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  return m < 7 ? y - 1 : y;
}

// Regular season only (weeks 1-18) -- playoffs (19-22) scores on a totally
// different point scale with its own separate pot/prize, so it's excluded
// from this page's season-long total on purpose (same scoping decision
// HallOfChampions.jsx already made for the same reason).
const MAX_REGULAR_SEASON_WEEK = 18;

const medalStyle = [
  { background: "linear-gradient(160deg, #fff7d6, #ffd700, #b8860b)", color: "#3a2a00" },
  { background: "linear-gradient(160deg, #f4f4f4, #c9c9c9, #8f8f8f)", color: "#222" },
  { background: "linear-gradient(160deg, #f0c9a0, #cd7f32, #8a4b17)", color: "#2a1500" },
];

function fmtPts(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function CumulativePoints() {
  const [season] = useState(getDefaultNflSeasonYear());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [weeks, setWeeks] = useState([]); // distinct weeks with data so far, ascending
  const [rows, setRows] = useState([]); // [{ user_name, byWeek: {1: pts, ...}, total }], sorted by total desc
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});

  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setUsernameByFullName(d.usernames || {});
            setAvatarByFullName(d.avatars || {});
          }
        })
        .catch(() => {});

      const { data, error } = await supabase
        .from("leaderboard")
        .select("user_name, week, points")
        .eq("season", season)
        .lte("week", MAX_REGULAR_SEASON_WEEK);
      if (error) throw error;

      const weekSet = new Set();
      const byUser = {}; // user_name -> { byWeek: {}, total }
      for (const r of data || []) {
        const name = String(r.user_name || "").trim();
        if (!name) continue;
        const w = Number(r.week);
        const pts = Number(r.points || 0);
        weekSet.add(w);
        if (!byUser[name]) byUser[name] = { byWeek: {}, total: 0 };
        byUser[name].byWeek[w] = (byUser[name].byWeek[w] || 0) + pts;
        byUser[name].total += pts;
      }

      const weekList = [...weekSet].sort((a, b) => a - b);
      const list = Object.entries(byUser)
        .map(([user_name, v]) => ({ user_name, ...v }))
        .sort((a, b) => b.total - a.total || dispName(a.user_name).localeCompare(dispName(b.user_name)));

      setWeeks(weekList);
      setRows(list);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Live updates as results get processed week to week, same realtime
  // pattern already used on Leaderboard.jsx.
  useEffect(() => {
    const channel = supabase
      .channel("cumulative_points_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard", filter: `season=eq.${season}` },
        () => loadAll()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  if (loading) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Cumulative Points</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{season}</b> — running total across every week played so far. Highest total at season's end wins the prize.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadAll}>Refresh</Button>
          <Link to="/">
            <Button variant="dark" size="sm">← Back</Button>
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", color: "#666" }}>
          No points yet. This page updates automatically once games become FINAL.
        </div>
      ) : (
        <div style={{ marginTop: 18, border: "1px solid rgba(184,134,11,0.3)", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, ...thSticky, textAlign: "left" }}>Participant</th>
                  {weeks.map((w) => (
                    <th key={w} style={thBase}>Wk {w}</th>
                  ))}
                  <th style={{ ...thBase, ...thTotal }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const medal = medalStyle[idx];
                  return (
                    <tr key={r.user_name} style={{ borderTop: "1px solid #eee", background: idx === 0 ? "rgba(255,215,0,0.06)" : "transparent" }}>
                      <td style={{ ...tdBase, ...tdSticky, background: idx === 0 ? "#fdf8e8" : "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              fontSize: 11,
                              flexShrink: 0,
                              background: medal ? medal.background : "#111",
                              color: medal ? medal.color : "#fff",
                            }}
                          >
                            {idx + 1}
                          </div>
                          <Avatar username={dispName(r.user_name)} avatar={avatarByFullName?.[r.user_name]} size={30} />
                          <span style={{ fontWeight: 800, color: "#111", whiteSpace: "nowrap" }}>{dispName(r.user_name)}</span>
                        </div>
                      </td>
                      {weeks.map((w) => (
                        <td key={w} style={tdBase}>
                          {r.byWeek[w] !== undefined ? fmtPts(r.byWeek[w]) : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                      ))}
                      <td style={{ ...tdBase, ...tdTotal, color: idx === 0 ? "#b8860b" : "#111" }}>{fmtPts(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const thBase = {
  padding: "10px 12px",
  textAlign: "right",
  fontWeight: 800,
  fontSize: 12,
  color: "#333",
  borderBottom: "2px solid rgba(184,134,11,0.3)",
  whiteSpace: "nowrap",
  background: "#fdf8e8",
};

const thSticky = {
  position: "sticky",
  left: 0,
  zIndex: 2,
};

const thTotal = {
  color: "#b8860b",
  borderLeft: "2px solid rgba(184,134,11,0.3)",
};

const tdBase = {
  padding: "8px 12px",
  textAlign: "right",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const tdSticky = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  textAlign: "left",
};

const tdTotal = {
  fontWeight: 900,
  fontSize: 14,
  borderLeft: "2px solid rgba(184,134,11,0.3)",
};
