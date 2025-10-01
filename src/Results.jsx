import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

/* Copy of your logo map (keep in sync with App.jsx) */
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
const logoSrc = (team) => (teamLogoSlug[team] ? `/logos/${teamLogoSlug[team]}.png` : null);

/* Team name → short code for TB headers */
function abbr(name) {
  const m = {
    "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF","Carolina Panthers":"CAR",
    "Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL","Denver Broncos":"DEN",
    "Detroit Lions":"DET","Green Bay Packers":"GB","Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX",
    "Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LAR","Miami Dolphins":"MIA",
    "Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG","New York Jets":"NYJ",
    "Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB",
    "Tennessee Titans":"TEN","Washington Commanders":"WSH"
  };
  return m[name] || name;
}

export default function Results() {
  const [weekMeta, setWeekMeta] = useState({ week: 0, games: [], tbIds: [] });
  const [tbShort, setTbShort] = useState([]); // ["SEA@ARI", "GB@DAL", "CIN@DEN"] style
  const [rows, setRows] = useState([]); // [{ user_name, picks: { [gameId]: 'AWAY'|'HOME'|'TIE' }, tbs: {1:{game_id,total},2:{...},3:{...}} }]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 1) Load current week.json
        const res = await fetch("/week.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not load week.json (${res.status})`);
        const week = await res.json();

        const games = Array.isArray(week.games) ? week.games : [];
        const wkNum = Number(week.week); // force number
        const tbIds = Array.isArray(week.tiebreakers) ? week.tiebreakers.slice(0, 3) : [];

        setWeekMeta({ week: wkNum, games, tbIds });

        // Build TB header short labels like SEA@ARI
        const tbShortLabels = tbIds.map((id) => {
          const g = games.find((x) => x.id === id);
          if (!g) return id;
          return `${abbr(g.away)}@${abbr(g.home)}`;
        });
        setTbShort(tbShortLabels);

        // 2) Fetch picks for this week
        const { data: pickData, error: pickErr } = await supabase
          .from("picks")
          .select("user_name, game_id, pick")
          .eq("week", wkNum);
        if (pickErr) throw pickErr;

        // 3) Fetch tiebreakers for this week
        const { data: tbData, error: tbErr } = await supabase
          .from("tiebreakers")
          .select("user_name, tb_no, game_id, total")
          .eq("week", wkNum);
        if (tbErr) throw tbErr;

        // 4) Group by participant
        const byUser = new Map();

        // Picks
        for (const r of pickData || []) {
          const name = (r.user_name && r.user_name.trim()) || "Unknown";
          if (!byUser.has(name)) byUser.set(name, { user_name: name, picks: {}, tbs: {} });
          byUser.get(name).picks[r.game_id] = r.pick;
        }

        // Tiebreakers
        for (const t of tbData || []) {
          const name = (t.user_name && t.user_name.trim()) || "Unknown";
          if (!byUser.has(name)) byUser.set(name, { user_name: name, picks: {}, tbs: {} });
          const n = Number(t.tb_no);
          byUser.get(name).tbs[n] = { game_id: t.game_id, total: Number(t.total) };
        }

        // Sort participants A→Z
        const list = Array.from(byUser.values()).sort((a, b) => a.user_name.localeCompare(b.user_name));
        setRows(list);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Wrap><h2>Loading results…</h2></Wrap>;
  if (err)      return <Wrap><p style={{ color: "red" }}>{err}</p></Wrap>;

  return (
    <Wrap>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Week {weekMeta.week} — Selections by Participant</h1>
        <Link to="/"><button style={styles.btn}>← Back to Picks</button></Link>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thLeft}>Participant</th>
              {weekMeta.games.map((g, i) => (
                <th key={g.id} style={styles.thCenter}>Game {i + 1}</th>
              ))}
              {/* TB headers with matchup short codes */}
              <th style={styles.thCenter}>TB1{tbShort[0] ? ` (${tbShort[0]})` : ""}</th>
              <th style={styles.thCenter}>TB2{tbShort[1] ? ` (${tbShort[1]})` : ""}</th>
              <th style={styles.thCenter}>TB3{tbShort[2] ? ` (${tbShort[2]})` : ""}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_name}>
                <td style={styles.tdLeft}>{r.user_name}</td>

                {/* Game picks (logos or Tie text) */}
                {weekMeta.games.map((g) => {
                  const pick = r.picks[g.id];
                  let team = null;
                  if (pick === "AWAY") team = g.away;
                  else if (pick === "HOME") team = g.home;
                  else if (pick === "TIE") team = "Tie";

                  return (
                    <td key={g.id} style={styles.tdCenter}>
                      {team && team !== "Tie" && logoSrc(team) ? (
                        <img src={logoSrc(team)} alt={team} style={{ width: 28, height: 28 }} />
                      ) : (
                        <span style={{ fontSize: 12, color: "#333" }}>{team || ""}</span>
                      )}
                    </td>
                  );
                })}

                {/* TB1–TB3 totals (cell title shows full matchup) */}
                {[1,2,3].map((n) => {
                  const tb = r.tbs[n];
                  let title = "";
                  if (tb?.game_id) {
                    const g = weekMeta.games.find(x => x.id === tb.game_id);
                    if (g) title = `${g.away} @ ${g.home}`;
                  }
                  return (
                    <td key={`tb_${n}_${r.user_name}`} style={styles.tdCenter} title={title}>
                      {typeof tb?.total === "number" ? tb.total : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      
    </Wrap>
  );
}

function Wrap({ children }) {
  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      {children}
    </div>
  );
}

const styles = {
  btn: {
    padding: "8px 12px",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    border: "1px solid #ddd"
  },
  thLeft:   { textAlign: "left",  padding: "10px 8px", background: "#111", color: "#fff", position: "sticky", left: 0 },
  thCenter: { textAlign: "center", padding: "10px 8px", background: "#111", color: "#fff" },
  tdLeft:   { textAlign: "left",  padding: "8px", borderTop: "1px solid #eee", position: "sticky", left: 0, background: "#fafafa" },
  tdCenter: { textAlign: "center", padding: "8px", borderTop: "1px solid #eee" }
};
