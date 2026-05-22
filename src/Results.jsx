import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

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

function fmtMatchup(g) {
  const away = String(g?.away || "").trim();
  const home = String(g?.home || "").trim();
  return away && home ? `${away} @ ${home}` : String(g?.id || "");
}

/** True when the global deadline has passed */
function isDeadlinePassed(deadlineIso, nowTs) {
  if (!deadlineIso) return false;
  const ms = new Date(deadlineIso).getTime();
  return Number.isFinite(ms) && nowTs >= ms;
}

/** True when a single game has locked (1 hour before kickoff — same rule as picks page) */
function isGameLockedNow(game, nowTs) {
  if (!game?.kickoff) return false;
  const kickMs = new Date(game.kickoff).getTime();
  return Number.isFinite(kickMs) && nowTs >= kickMs - 60 * 60 * 1000;
}

export default function Results() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meta, setMeta] = useState({ season: null, week: null });
  const [games, setGames] = useState([]);
  const [deadline, setDeadline] = useState(null);

  const [picksRows, setPicksRows] = useState([]); // { user_name, game_id, pick }
  const [tbGameIds, setTbGameIds] = useState([]); // 3 ids
  const [tbRows, setTbRows] = useState([]); // { user_name, tb_no, game_id, total }

  const [nowTs, setNowTs] = useState(() => Date.now());

  // tick so the page can auto-switch from “hidden” to “shown”
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      // 1) Get current week/season from server
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

      // 2) Get games for this week (so table columns are correct)
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("id, season, week, away, home, kickoff")
        .eq("season", season)
        .eq("week", week)
        .order("kickoff", { ascending: true });

      if (gErr) throw gErr;
      setGames(g || []);

      // 3) week_meta for deadline + tiebreakers
      const { data: wm, error: wmErr } = await supabase
        .from("week_meta")
        .select("deadline, tiebreakers")
        .eq("season", season)
        .eq("week", week)
        .maybeSingle();

      if (wmErr) throw wmErr;

      setDeadline(wm?.deadline || null);

      const tbIds = Array.isArray(wm?.tiebreakers) ? wm.tiebreakers.slice(0, 3).map(String) : [];
      setTbGameIds(tbIds);

      // 4) picks for this week (try season column first; fallback if table doesn’t have it)
      let picks = [];
      {
        const q1 = await supabase.from("picks").select("user_name, game_id, pick").eq("season", season).eq("week", week);
        if (!q1.error) {
          picks = q1.data || [];
        } else {
          const q2 = await supabase.from("picks").select("user_name, game_id, pick").eq("week", week);
          if (q2.error) throw q2.error;
          picks = q2.data || [];
        }
      }
      setPicksRows(picks);

      // 5) tiebreakers guesses (optional—only if you want the TB columns like your screenshot)
      // If your tiebreakers table doesn’t have season, we filter by week only (same as current code base)
      const { data: tb, error: tbErr } = await supabase
        .from("tiebreakers")
        .select("user_name, tb_no, game_id, total")
        .eq("week", week);

      if (tbErr) {
        // Non-fatal (table can still work)
        console.warn("tiebreakers load warning:", tbErr);
        setTbRows([]);
      } else {
        setTbRows(tb || []);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // realtime refresh if picks change (optional but nice)
  useEffect(() => {
    if (!meta.season || !meta.week) return;

    const pCh = supabase
      .channel("results_picks_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    const wmCh = supabase
      .channel("results_week_meta_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "week_meta", filter: `season=eq.${meta.season},week=eq.${meta.week}` },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pCh);
      supabase.removeChannel(wmCh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.season, meta.week]);

  // True once the global weekly deadline has passed
  const deadlineLocked = useMemo(
    () => isDeadlinePassed(deadline, nowTs),
    [deadline, nowTs]
  );

  // Set of game IDs whose picks are now visible (locked 1 hr before kickoff, or deadline passed)
  const lockedGameIds = useMemo(() => {
    const s = new Set();
    for (const g of games) {
      if (deadlineLocked || isGameLockedNow(g, nowTs)) s.add(String(g.id));
    }
    return s;
  }, [games, deadlineLocked, nowTs]);

  // Table frame appears as soon as ANY game has locked
  const isAnyLocked = deadlineLocked || lockedGameIds.size > 0;

  // ---- Build table model ----
  const gameById = useMemo(() => {
    const m = {};
    for (const g of games || []) m[String(g.id)] = g;
    return m;
  }, [games]);

  const users = useMemo(() => {
    const set = new Set();
    for (const r of picksRows || []) {
      const u = String(r.user_name || "").trim();
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [picksRows]);

  const pickByUserGame = useMemo(() => {
    const m = {}; // m[user][gameId] = pick
    for (const r of picksRows || []) {
      const u = String(r.user_name || "").trim();
      const gid = String(r.game_id || "").trim();
      const pick = String(r.pick || "").trim();
      if (!u || !gid) continue;
      if (!m[u]) m[u] = {};
      m[u][gid] = pick;
    }
    return m;
  }, [picksRows]);

  const tbByUserNo = useMemo(() => {
    const m = {}; // m[user][tbNo] = total
    for (const r of tbRows || []) {
      const u = String(r.user_name || "").trim();
      const no = Number(r.tb_no);
      if (!u || ![1, 2, 3].includes(no)) continue;
      if (!m[u]) m[u] = {};
      m[u][no] = r.total;
    }
    return m;
  }, [tbRows]);

  // helper: render a pick cell (logo)
  function renderPickCell(userName, gid) {
    const raw = pickByUserGame?.[userName]?.[gid];
    const pick = String(raw || "").toUpperCase();
    const g = gameById[gid];

    if (!pick || !g) return <span style={{ color: "#999" }}>—</span>;

    if (pick === "TIE") return <span style={styles.tiePill}>TIE</span>;

    // pick is AWAY/HOME
    const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : null;
    const src = team ? logoSrc(team) : null;

    if (!team || !src) return <span style={{ fontSize: 12 }}>{team || pick}</span>;

    return (
      <img
        src={src}
        alt={team}
        title={team}
        style={{ width: 28, height: 28, objectFit: "contain", display: "block", margin: "0 auto" }}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    );
  }

  if (loading) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  const lockLabel = deadline
    ? `Submission deadline: ${new Date(deadline).toLocaleString()}`
    : "Picks reveal column-by-column as each game locks (1 hr before kickoff)";

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>View Picks Table</h1>
          <div style={{ marginTop: 6, color: "#555" }}>
            Season <b>{meta.season}</b> • Week <b>{meta.week}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>{lockLabel}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadAll} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Refresh
          </button>
          <Link to="/">
            <button style={{ padding: "8px 12px", cursor: "pointer" }}>← Back</button>
          </Link>
        </div>
      </div>

      {!isAnyLocked ? (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14, background: "#fff" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>🔒 Picks are hidden until games start locking.</div>
          <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
            Each game’s picks will appear here 1 hour before its kickoff. Check back once the first game of the week locks.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thStickyLeft}>#</th>
                  <th style={thStickyName}>Participant</th>

                  {(games || []).map((g, idx) => {
                    const gameLocked = lockedGameIds.has(String(g.id));
                    const lockTime = g.kickoff
                      ? new Date(new Date(g.kickoff).getTime() - 60 * 60 * 1000)
                      : null;
                    return (
                      <th key={g.id} style={th}>
                        Game {idx + 1}
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginTop: 2 }}>
                          {fmtMatchup(g)}
                        </div>
                        {gameLocked ? (
                          <div style={{ fontSize: 10, color: "#b00", marginTop: 3, fontWeight: 700 }}>🔒 LOCKED</div>
                        ) : lockTime ? (
                          <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>
                            Locks {lockTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}

                  {tbGameIds.length === 3 ? (
                    tbGameIds.map((gid, i) => {
                      const g = gameById[gid];
                      const gameLocked = lockedGameIds.has(String(gid));
                      return (
                        <th key={`tb_${i + 1}`} style={th}>
                          TB{i + 1}
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginTop: 2 }}>
                            {g ? fmtMatchup(g) : gid}
                          </div>
                          {gameLocked && (
                            <div style={{ fontSize: 10, color: "#b00", marginTop: 3, fontWeight: 700 }}>🔒 LOCKED</div>
                          )}
                        </th>
                      );
                    })
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={(games?.length || 0) + 2 + (tbGameIds.length === 3 ? 3 : 0)} style={{ padding: 14, color: "#666" }}>
                      No picks found for this week yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <tr key={u} style={{ borderTop: "1px solid #eee" }}>
                      <td style={tdNum}>{i + 1}</td>
                      <td style={tdName}>{u}</td>

                      {(games || []).map((g) => {
                        const gameLocked = lockedGameIds.has(String(g.id));
                        return (
                          <td key={`${u}_${g.id}`} style={tdCenter}>
                            {gameLocked
                              ? renderPickCell(u, String(g.id))
                              : <span title="Picks hidden until game locks" style={{ color: "#ccc", fontSize: 16 }}>🔒</span>
                            }
                          </td>
                        );
                      })}

                      {tbGameIds.length === 3 ? (
                        [1, 2, 3].map((tbNo) => {
                          const gid = tbGameIds[tbNo - 1];
                          const gameLocked = lockedGameIds.has(String(gid));
                          return (
                            <td key={`${u}_tb_${tbNo}`} style={tdCenter}>
                              {gameLocked
                                ? (tbByUserNo?.[u]?.[tbNo] ?? <span style={{ color: "#999" }}>—</span>)
                                : <span title="Picks hidden until game locks" style={{ color: "#ccc", fontSize: 16 }}>🔒</span>
                              }
                            </td>
                          );
                        })
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#777", textAlign: "center" }}>
            🔒 = picks still hidden (game hasn’t locked yet) &nbsp;·&nbsp; This table updates automatically as games lock.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- table styles ---------- */
const th = {
  padding: "10px 8px",
  textAlign: "center",
  fontWeight: 900,
  fontSize: 12,
  color: "#111",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const thStickyLeft = {
  ...th,
  position: "sticky",
  left: 0,
  background: "#fff",
  zIndex: 3,
  textAlign: "right",
  width: 42,
};

const thStickyName = {
  ...th,
  position: "sticky",
  left: 42,
  background: "#fff",
  zIndex: 3,
  textAlign: "left",
  minWidth: 180,
};

const tdCenter = {
  padding: "10px 8px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdNum = {
  ...tdCenter,
  position: "sticky",
  left: 0,
  background: "#fff",
  zIndex: 2,
  textAlign: "right",
  fontWeight: 800,
  color: "#444",
};

const tdName = {
  ...tdCenter,
  position: "sticky",
  left: 42,
  background: "#fff",
  zIndex: 2,
  textAlign: "left",
  fontWeight: 800,
};

const styles = {
  tiePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    minWidth: 28,
    padding: "0 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    color: "#111",
    fontSize: 12,
    fontWeight: 800,
  },
};