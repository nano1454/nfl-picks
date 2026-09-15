import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";

export default function WeekSummary() {
  const [searchParams] = useSearchParams();
  const season = Number(searchParams.get("season"));
  const week = Number(searchParams.get("week"));

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]); // [{ user_name, weekPoints, accumPoints }]
  const [usernameByFullName, setUsernameByFullName] = useState({});

  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      if (!season || !week) throw new Error("Missing season/week.");

      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) setUsernameByFullName(d.usernames || {});
        })
        .catch(() => {});

      // Every leaderboard row for this season, from week 1 through the
      // requested week -- lets us total each participant's points across
      // every week they've played, not just this one.
      const { data, error } = await supabase
        .from("leaderboard")
        .select("user_name, week, points")
        .eq("season", season)
        .lte("week", week);

      if (error) throw error;

      const totals = {}; // user_name -> { weekPoints, accumPoints }
      for (const r of data || []) {
        const name = String(r.user_name || "").trim();
        if (!name) continue;
        const pts = Number(r.points || 0);
        if (!totals[name]) totals[name] = { weekPoints: 0, accumPoints: 0 };
        totals[name].accumPoints += pts;
        if (Number(r.week) === week) totals[name].weekPoints += pts;
      }

      const list = Object.entries(totals)
        .map(([user_name, t]) => ({ user_name, ...t }))
        .sort((a, b) => b.accumPoints - a.accumPoints || dispName(a.user_name).localeCompare(dispName(b.user_name)));

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
  }, [season, week]);

  if (loading) return <div style={{ maxWidth: 700, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 700, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 700, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Week {week} Summary</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{season}</b> — accumulated points through Week {week}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadAll}>
            Refresh
          </Button>
          <Link to="/history">
            <Button variant="dark" size="sm">← Back</Button>
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, color: "#666" }}>No results yet for this week.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: "left" }}>Participant</th>
                <th style={th}>Week {week}</th>
                <th style={th}>Season Total (Wk 1–{week})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.user_name} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{dispName(r.user_name)}</td>
                  <td style={td}>{fmt(r.weekPoints)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(r.accumPoints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const th = {
  padding: "8px 10px",
  textAlign: "right",
  fontWeight: 800,
  fontSize: 13,
  color: "#111",
  borderBottom: "1px solid #ddd",
};

const td = {
  padding: "8px 10px",
  textAlign: "right",
  fontSize: 14,
};
