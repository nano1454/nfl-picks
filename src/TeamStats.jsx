import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "./Button";
import { logoSrc } from "./teamLogos";
import PageBanner from "./PageBanner";

function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  return m < 7 ? y - 1 : y;
}

const MAX_REGULAR_SEASON_WEEK = 18;

export default function TeamStats() {
  const [season] = useState(getDefaultNflSeasonYear());
  const [week, setWeek] = useState(1);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Default the week picker to wherever the live pool currently is (clamped
  // to the regular season -- this page doesn't cover playoff weeks 19-22).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/.netlify/functions/getweek", { cache: "no-store" });
        const data = await res.json();
        if (data?.ok) {
          const w = Number(data.week);
          if (Number.isFinite(w)) setWeek(Math.min(Math.max(w, 1), MAX_REGULAR_SEASON_WEEK));
        }
      } catch {
        // default of week 1 is fine if this fails
      }
    })();
  }, []);

  async function loadStats() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/.netlify/functions/getTeamStats?season=${season}&week=${week}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Could not load team stats (HTTP ${res.status})`);
      setTeams(data.teams || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, week]);

  return (
    <div style={{ fontFamily: "system-ui" }}>
      <PageBanner src="/team_stats_banner.png" alt="NFL Team Stats — Stats. Trends. Insights." />
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>🏈 NFL Team Stats</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{season}</b> — records entering the week shown, plus that week's own passing/rushing yards.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", fontWeight: 700 }}
          >
            {Array.from({ length: MAX_REGULAR_SEASON_WEEK }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={loadStats}>Refresh</Button>
          <Link to="/">
            <Button variant="dark" size="sm">← Back</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 18, color: "#666" }}>Loading…</div>
      ) : err ? (
        <div style={{ marginTop: 18, color: "red" }}>{err}</div>
      ) : (
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
            gap: 12,
          }}
        >
          {teams.map((t) => (
            <TeamCard key={t.abbr} team={t} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function TeamCard({ team }) {
  const src = logoSrc(team.team);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 14,
        padding: "14px 10px",
        background: "#fff",
        boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {src && (
        <img
          src={src}
          alt={team.team}
          style={{ width: 56, height: 56, objectFit: "contain", display: "block" }}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div style={{ marginTop: 8, fontWeight: 800, fontSize: 13, color: "#111", lineHeight: 1.25 }}>
        {team.team}
      </div>
      {team.opponent && (
        <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: "#888" }}>
          @ {team.opponent}
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontWeight: 900,
          fontSize: 15,
          color: "#111",
          background: "rgba(0,0,0,0.05)",
          borderRadius: 999,
          padding: "3px 12px",
        }}
      >
        {team.record}
      </div>

      {team.bye ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: 800,
            color: "#8a5a00",
            background: "rgba(255,180,0,0.15)",
            border: "1px solid rgba(255,180,0,0.4)",
            borderRadius: 999,
            padding: "2px 10px",
          }}
        >
          BYE
        </div>
      ) : team.stats_pending ? (
        <div style={{ marginTop: 8, fontSize: 11, color: "#999" }}>Stats pending</div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: "#444", lineHeight: 1.6 }}>
          <div>
            <span style={{ color: "#7c3aed", fontWeight: 800 }}>Pass</span> {team.passing_yards} yds
          </div>
          <div>
            <span style={{ color: "#ea580c", fontWeight: 800 }}>Rush</span> {team.rushing_yards} yds
          </div>
        </div>
      )}
    </div>
  );
}
