import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

function normalizeName(s) {
  return (s || "").trim();
}

export default function Admin() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [weekMeta, setWeekMeta] = useState({ week: 0, games: [], tbIds: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [participants, setParticipants] = useState([]); // [{user_name,buy_in,active}]
  const [payments, setPayments] = useState({}); // { [user_name]: boolean }
  const [picksByUser, setPicksByUser] = useState({}); // { [user_name]: { [game_id]: pick } }
  const [tbsByUser, setTbsByUser] = useState({}); // { [user_name]: {1:{total},2:{total},3:{total}} }

  // A2: collapse/expand per row
  const [expandedMissing, setExpandedMissing] = useState(() => ({})); // { [user_name]: true/false }

  // A1: import names button state
  const [importingNames, setImportingNames] = useState(false);

  // Add participant inputs
  const [newName, setNewName] = useState("");
  const [newBuyIn, setNewBuyIn] = useState("");

  const adminPin = import.meta.env.VITE_ADMIN_PIN || "";

  useEffect(() => {
    setUnlocked(false);
  }, []);

  function formatMissingMatchups(matchups, showAll) {
    const list = Array.isArray(matchups) ? matchups : [];
    if (showAll || list.length <= 2) return { text: list.join(", "), moreCount: 0 };
    const firstTwo = list.slice(0, 2);
    return { text: firstTwo.join(", "), moreCount: list.length - 2 };
  }

  function toggleExpanded(user_name) {
    setExpandedMissing((m) => ({ ...m, [user_name]: !m[user_name] }));
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      // 1) Load week.json (same pattern as App/Results)
      const res = await fetch("/week.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load week.json (${res.status})`);
      const week = await res.json();

      const games = Array.isArray(week.games) ? week.games : [];
      const wkNum = Number(week.week);
      const tbIds = Array.isArray(week.tiebreakers) ? week.tiebreakers.slice(0, 3) : [];
      setWeekMeta({ week: wkNum, games, tbIds });

      // 2) Load participants (active only)
      const { data: partData, error: partErr } = await supabase
        .from("participants")
        .select("user_name, buy_in, active")
        .eq("active", true)
        .order("user_name", { ascending: true });

      if (partErr) throw partErr;
      setParticipants(partData || []);

      // 3) Load week payments
      const { data: payData, error: payErr } = await supabase
        .from("week_payments")
        .select("user_name, paid")
        .eq("week", wkNum);

      if (payErr) throw payErr;
      const payMap = {};
      for (const r of payData || []) payMap[normalizeName(r.user_name)] = !!r.paid;
      setPayments(payMap);

      // 4) Load picks for the week
      const { data: pickData, error: pickErr } = await supabase
        .from("picks")
        .select("user_name, game_id, pick")
        .eq("week", wkNum);

      if (pickErr) throw pickErr;

      const pb = {};
      for (const r of pickData || []) {
        const name = normalizeName(r.user_name) || "Unknown";
        if (!pb[name]) pb[name] = {};
        pb[name][r.game_id] = r.pick;
      }
      setPicksByUser(pb);

      // 5) Load tiebreakers for the week
      const { data: tbData, error: tbErr } = await supabase
        .from("tiebreakers")
        .select("user_name, tb_no, total")
        .eq("week", wkNum);

      if (tbErr) throw tbErr;

      const tbm = {};
      for (const t of tbData || []) {
        const name = normalizeName(t.user_name) || "Unknown";
        const n = Number(t.tb_no);
        if (!tbm[name]) tbm[name] = {};
        tbm[name][n] = { total: t.total };
      }
      setTbsByUser(tbm);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const gameCount = weekMeta.games.length;

  const summary = useMemo(() => {
    const rows = (participants || []).map((p) => {
      const name = normalizeName(p.user_name);
      const picks = picksByUser[name] || {};
      const tbs = tbsByUser[name] || {};
      const picksCount = Object.keys(picks).length;

      const hasTB1 =
        tbs[1]?.total !== undefined &&
        tbs[1]?.total !== null &&
        String(tbs[1]?.total).trim() !== "";
      const hasTB2 =
        tbs[2]?.total !== undefined &&
        tbs[2]?.total !== null &&
        String(tbs[2]?.total).trim() !== "";
      const hasTB3 =
        tbs[3]?.total !== undefined &&
        tbs[3]?.total !== null &&
        String(tbs[3]?.total).trim() !== "";

      const tbCount = [hasTB1, hasTB2, hasTB3].filter(Boolean).length;

      const submitted = picksCount === gameCount && tbCount === 3;

      // Missing picks (list of matchups)
      const missingGameIds = (weekMeta.games || [])
        .map((g) => g.id)
        .filter((gameId) => !picks[gameId]);

      const missingMatchups = missingGameIds.map((gameId) => {
        const g = (weekMeta.games || []).find((x) => x.id === gameId);
        if (!g) return String(gameId);
        return `${g.away} @ ${g.home}`;
      });

      // Missing TB numbers
      const missingTBs = [];
      if (!hasTB1) missingTBs.push("TB1");
      if (!hasTB2) missingTBs.push("TB2");
      if (!hasTB3) missingTBs.push("TB3");

      return {
        user_name: name,
        buy_in: Number(p.buy_in || 0),
        paid: !!payments[name],
        picksCount,
        tbCount,
        submitted,
        missingMatchups,
        missingTBs,
      };
    });

    const submitted = rows.filter((r) => r.submitted);
    const missing = rows.filter((r) => !r.submitted);

    return { rows, submitted, missing };
  }, [participants, payments, picksByUser, tbsByUser, gameCount, weekMeta.games]);

  async function togglePaid(user_name, nextPaid) {
    const wk = Number(weekMeta.week);
    try {
      // Ensure participant exists (should already, but safe)
      await supabase.from("participants").upsert([{ user_name }], { onConflict: "user_name" });

      const { error } = await supabase
        .from("week_payments")
        .upsert([{ week: wk, user_name, paid: !!nextPaid }], { onConflict: "week,user_name" });

      if (error) throw error;

      setPayments((m) => ({ ...m, [user_name]: !!nextPaid }));
    } catch (e) {
      alert(`Could not update paid status: ${String(e?.message || e)}`);
    }
  }

  async function addParticipant() {
    const name = normalizeName(newName);
    if (!name) return alert("Enter a participant name.");
    const buyIn = newBuyIn === "" ? 0 : Number(newBuyIn);
    if (Number.isNaN(buyIn) || buyIn < 0) return alert("Buy-in must be a number (0 or more).");

    try {
      const { error } = await supabase
        .from("participants")
        .upsert([{ user_name: name, buy_in: buyIn, active: true }], { onConflict: "user_name" });
      if (error) throw error;

      setNewName("");
      setNewBuyIn("");
      await loadAll();
    } catch (e) {
      alert(`Could not add participant: ${String(e?.message || e)}`);
    }
  }

  async function importNamesFromWeek() {
    if (!weekMeta.week) return alert("Week not loaded yet.");

    setImportingNames(true);
    try {
      const names = new Set();
      for (const n of Object.keys(picksByUser || {})) names.add(normalizeName(n));
      for (const n of Object.keys(tbsByUser || {})) names.add(normalizeName(n));
      names.delete("");

      const existing = new Set((participants || []).map((p) => normalizeName(p.user_name)));
      const toAdd = [...names].filter((n) => n && !existing.has(n));

      if (toAdd.length === 0) {
        alert("No new names found to add.");
        return;
      }

      const rows = toAdd.map((user_name) => ({ user_name, buy_in: 0, active: true }));

      const { error } = await supabase.from("participants").upsert(rows, { onConflict: "user_name" });
      if (error) throw error;

      alert(`Added ${toAdd.length} new participant(s):\n${toAdd.join(", ")}`);
      await loadAll();
    } catch (e) {
      alert(`Could not import names: ${String(e?.message || e)}`);
    } finally {
      setImportingNames(false);
    }
  }

  // PIN gate UI
  if (!unlocked) {
    return (
      <div style={{ maxWidth: 680, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ marginTop: 0 }}>Admin</h1>
        <p style={{ color: "#444" }}>Enter your admin PIN to view the dashboard.</p>

        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Admin PIN"
          style={{ padding: 10, width: "100%", maxWidth: 280 }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              if (!adminPin) return alert("No VITE_ADMIN_PIN is set in env vars.");
              if (pin === String(adminPin)) setUnlocked(true);
              else alert("Wrong PIN.");
            }}
            style={{ padding: "10px 14px", cursor: "pointer" }}
          >
            Unlock
          </button>

          <Link to="/">
            <button style={{ padding: "10px 14px", cursor: "pointer" }}>← Back</button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>Loading admin…</div>;
  if (err) return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Admin — Week {weekMeta.week}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadAll} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Refresh
          </button>
          <Link to="/">
            <button style={{ padding: "8px 12px", cursor: "pointer" }}>← Back</button>
          </Link>
        </div>
      </div>

      <p style={{ color: "#555", marginTop: 8 }}>
        Submitted means: <b>{gameCount}</b> picks + <b>3</b> tiebreakers totals.
      </p>

      {/* Add participant */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Add / Activate Participant</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            style={{ padding: 10, minWidth: 220 }}
          />
          <input
            value={newBuyIn}
            onChange={(e) => setNewBuyIn(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Buy-in (optional)"
            style={{ padding: 10, width: 160 }}
          />
          <button onClick={addParticipant} style={{ padding: "10px 14px", cursor: "pointer" }}>
            Save
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            onClick={importNamesFromWeek}
            disabled={importingNames}
            style={{ padding: "10px 14px", cursor: "pointer" }}
          >
            {importingNames ? "Importing…" : "Import names from this week’s submissions"}
          </button>
        </div>
      </div>

      {/* Submitted / Missing counts */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Submitted</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.submitted.length}</div>
        </div>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Missing</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.missing.length}</div>
        </div>
      </div>

      {/* Main table */}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thLeft}>Participant</th>
              <th style={thCenter}>Picks</th>
              <th style={thCenter}>TBs</th>
              <th style={thCenter}>Submitted</th>
              <th style={thCenter}>Buy-in</th>
              <th style={thCenter}>Paid</th>
              <th style={thLeft}>Missing details</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => {
              const showAll = !!expandedMissing[r.user_name];
              const { text, moreCount } = formatMissingMatchups(r.missingMatchups, showAll);

              return (
                <tr key={r.user_name}>
                  <td style={tdLeft}>{r.user_name}</td>
                  <td style={tdCenter}>
                    {r.picksCount}/{gameCount}
                  </td>
                  <td style={tdCenter}>{r.tbCount}/3</td>
                  <td style={tdCenter}>{r.submitted ? "✅" : "—"}</td>
                  <td style={tdCenter}>${r.buy_in.toFixed(2)}</td>
                  <td style={tdCenter}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={r.paid}
                        onChange={(e) => togglePaid(r.user_name, e.target.checked)}
                      />
                      {r.paid ? "Paid" : "No"}
                    </label>
                  </td>

                  <td style={tdLeft}>
                    {r.submitted ? (
                      "—"
                    ) : (
                      <>
                        {r.missingMatchups?.length > 0 && (
                          <div>
                            <b>Missing picks:</b> {text}
                            {moreCount > 0 && (
                              <>
                                {" "}
                                <span style={{ color: "#555" }}>+{moreCount} more…</span>{" "}
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(r.user_name)}
                                  style={linkBtnStyle}
                                >
                                  Show all
                                </button>
                              </>
                            )}
                            {showAll && r.missingMatchups.length > 2 && (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(r.user_name)}
                                  style={{ ...linkBtnStyle, marginLeft: 8 }}
                                >
                                  Show less
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {r.missingTBs?.length > 0 && (
                          <div>
                            <b>Missing TBs:</b> {r.missingTBs.join(", ")}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: "#666", marginTop: 14, fontSize: 13 }}>
        (No emails are shown here — only <code>user_name</code>.)
      </p>
    </div>
  );
}

const thLeft = { textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const thCenter = { textAlign: "center", padding: "10px 8px", borderBottom: "2px solid #ddd", whiteSpace: "nowrap" };
const tdLeft = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const tdCenter = { textAlign: "center", padding: "10px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };

const linkBtnStyle = {
  border: "none",
  background: "transparent",
  color: "#0b5cff",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  fontSize: 12,
};
