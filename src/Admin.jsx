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

  // Schedule import UI
  const [importSeason, setImportSeason] = useState(String(new Date().getFullYear()));
  const [importWeek, setImportWeek] = useState(""); // auto-fill after week loads
  const [importingSchedule, setImportingSchedule] = useState(false);

  // Deadline UI
  const [deadlineLocal, setDeadlineLocal] = useState(""); // datetime-local string
  const [savedDeadlineIso, setSavedDeadlineIso] = useState(""); // from DB
  const [savingDeadline, setSavingDeadline] = useState(false);

  // A2: collapse/expand per row
  const [expandedMissing, setExpandedMissing] = useState(() => ({})); // { [user_name]: true/false }

  // A1: import names button state
  const [importingNames, setImportingNames] = useState(false);

  // Add participant inputs
  const [newName, setNewName] = useState("");
  const [newBuyIn, setNewBuyIn] = useState("");

  // Keep a copy of the PIN used to unlock so the import button always has it
  const [sessionPin, setSessionPin] = useState("");

  const adminPin = import.meta.env.VITE_ADMIN_PIN || "";

  const [runningResults, setRunningResults] = useState(false);

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

  async function importScheduleNow() {
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) {
      alert("PIN is missing. Unlock again and then try importing.");
      return;
    }

    const season = Number(String(importSeason).trim());
    const week = Number(String(importWeek).trim());

    if (!season || !week) {
      alert("Enter a valid season and week.");
      return;
    }

    setImportingSchedule(true);
    try {
      const url = `/.netlify/functions/importSchedule?season=${season}&week=${week}&pin=${encodeURIComponent(
        pinToUse
      )}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      console.log("importSchedule response:", { status: res.status, data });

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Import failed (HTTP ${res.status})`);
      }

      alert(
        `✅ Imported Week ${week}, ${season}\nGames: ${data.imported_games}\nTBs: ${(data.tiebreakers || []).join(
          ", "
        )}`
      );

      await loadAll();
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setImportingSchedule(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setErr("");

    try {
      // 1) Load week payload from Netlify function
      async function fetchWeekPayload() {
        const urlsToTry = ["/.netlify/functions/getweek", "/.netlify/functions/getWeek"];

        let lastText = "";
        for (const u of urlsToTry) {
          const res = await fetch(u, { cache: "no-store" });
          const text = await res.text();
          lastText = text;

          if (!res.ok) continue;

          try {
            return JSON.parse(text);
          } catch {
            throw new Error(`Week endpoint returned non-JSON from ${u}: ${text.slice(0, 140)}`);
          }
        }

        throw new Error(
          `Could not load week data from getweek/getWeek. Last response: ${lastText.slice(0, 140)}`
        );
      }

      const data = await fetchWeekPayload();
      if (!data.ok) throw new Error(data.error || "Could not load week data");

      const games = Array.isArray(data.games) ? data.games : [];
      const wkNum = Number(data.week || 0);
      const tbIds = Array.isArray(data.tiebreakers) ? data.tiebreakers.slice(0, 3) : [];

      setWeekMeta({ week: wkNum, games, tbIds });

      // Auto-fill week in import UI (only if not manually overridden yet)
      setImportWeek((prev) => (prev ? prev : String(wkNum || "")));

      // ✅ Load saved deadline from week_meta (for UI display)
      // We use importSeason as the "season" selector for admin tools.
      const seasonForAdmin = Number(String(importSeason || "").trim());
      if (seasonForAdmin && wkNum) {
        const { data: wm, error: wmErr } = await supabase
          .from("week_meta")
          .select("deadline")
          .eq("season", seasonForAdmin)
          .eq("week", wkNum)
          .maybeSingle();

        if (!wmErr) {
          const iso = wm?.deadline ? String(wm.deadline) : "";
          setSavedDeadlineIso(iso);
          // If admin hasn't typed anything yet, prefill picker with saved deadline
          setDeadlineLocal((prev) => {
            if (prev) return prev;
            if (!iso) return "";
            // Convert ISO -> datetime-local display
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, "0");
            const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
              d.getHours()
            )}:${pad(d.getMinutes())}`;
            return localStr;
          });
        }
      }

      // 2) Load participants + this week's payment status (server-side, PIN-gated —
      //    these two tables have no public policies, only the service role can touch them)
      const pinToUse = (sessionPin || pin || "").trim();
      if (!pinToUse) throw new Error("PIN missing. Unlock again.");

      const adminDataRes = await fetch(
        `/.netlify/functions/getAdminParticipants?week=${wkNum}&pin=${encodeURIComponent(pinToUse)}`,
        { cache: "no-store" }
      );
      const adminData = await adminDataRes.json().catch(() => ({}));
      if (!adminDataRes.ok || !adminData.ok) {
        throw new Error(adminData?.error || `Could not load participants (HTTP ${adminDataRes.status})`);
      }
      setParticipants(adminData.participants || []);

      const payMap = {};
      for (const [name, paid] of Object.entries(adminData.payments || {})) payMap[normalizeName(name)] = !!paid;
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

      const hasTB1 = tbs[1]?.total !== undefined && tbs[1]?.total !== null && String(tbs[1]?.total).trim() !== "";
      const hasTB2 = tbs[2]?.total !== undefined && tbs[2]?.total !== null && String(tbs[2]?.total).trim() !== "";
      const hasTB3 = tbs[3]?.total !== undefined && tbs[3]?.total !== null && String(tbs[3]?.total).trim() !== "";

      const tbCount = [hasTB1, hasTB2, hasTB3].filter(Boolean).length;
      const submitted = picksCount === gameCount && tbCount === 3;

      const missingGameIds = (weekMeta.games || [])
        .map((g) => g.id)
        .filter((gameId) => !picks[gameId]);

      const missingMatchups = missingGameIds.map((gameId) => {
        const g = (weekMeta.games || []).find((x) => x.id === gameId);
        if (!g) return String(gameId);
        return `${g.away} @ ${g.home}`;
      });

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
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    try {
      const url =
        `/.netlify/functions/setWeekPayment?week=${wk}` +
        `&user_name=${encodeURIComponent(user_name)}` +
        `&paid=${!!nextPaid}` +
        `&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed (HTTP ${res.status})`);

      setPayments((m) => ({ ...m, [user_name]: !!nextPaid }));
    } catch (e) {
      alert(`Could not update paid status: ${String(e?.message || e)}`);
    }
  }

  async function removeParticipant(user_name) {
    if (!window.confirm(`Remove "${user_name}" from the dropdown list?\n\nTheir picks history is NOT deleted — they just won't appear in the returning participant dropdown.`)) return;
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    try {
      const url =
        `/.netlify/functions/setParticipantActive?user_name=${encodeURIComponent(user_name)}` +
        `&active=false&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed (HTTP ${res.status})`);
      await loadAll();
    } catch (e) {
      alert(`Could not remove participant: ${String(e?.message || e)}`);
    }
  }

  async function addParticipant() {
    const name = normalizeName(newName);
    if (!name) return alert("Enter a participant name.");
    const buyIn = newBuyIn === "" ? 0 : Number(newBuyIn);
    if (Number.isNaN(buyIn) || buyIn < 0) return alert("Buy-in must be a number (0 or more).");

    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    try {
      const url =
        `/.netlify/functions/upsertParticipant?user_name=${encodeURIComponent(name)}` +
        `&buy_in=${buyIn}&active=true&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed (HTTP ${res.status})`);

      setNewName("");
      setNewBuyIn("");
      await loadAll();
    } catch (e) {
      alert(`Could not add participant: ${String(e?.message || e)}`);
    }
  }

  async function setCurrentWeekNow() {
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    const season = Number(String(importSeason).trim());
    const week = Number(String(importWeek).trim());
    if (!season || !week) return alert("Enter a valid season/week first.");

    try {
      const url = `/.netlify/functions/setCurrentWeek?season=${season}&week=${week}&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed (HTTP ${res.status})`);

      alert(`✅ Set current week: Season ${season} Week ${week}`);
      await loadAll();
    } catch (e) {
      alert(String(e?.message || e));
    }
  }

  async function runResultsNow() {
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN is missing. Unlock again.");

    const season = Number(String(importSeason).trim());
    const week = Number(String(weekMeta.week || "").trim());

    setRunningResults(true);
    try {
      const url = `/.netlify/functions/recalcLeaderboard?season=${season}&week=${week}&pin=${encodeURIComponent(pinToUse)}`;

      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();

      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || `updateResults failed (HTTP ${res.status})`);
      }

      alert("✅ Results processed. Leaderboard should update now.");
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setRunningResults(false);
    }
  }


  async function removePicksForUser(user_name) {
    const wk = Number(weekMeta.week);
    if (!window.confirm(`Remove all picks and tiebreakers for ${user_name} in Week ${wk}?`)) return;

    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    try {
      const url = `/.netlify/functions/removeUserPicks?week=${wk}&user_name=${encodeURIComponent(user_name)}&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.error || `Failed (HTTP ${res.status})`);
      await loadAll();
      alert(`Picks and tiebreakers for ${user_name} (Week ${wk}) have been removed.`);
    } catch (e) {
      alert(`Could not remove picks: ${String(e?.message || e)}`);
    }
  }

  async function importNamesFromWeek() {
    if (!weekMeta.week) return alert("Week not loaded yet.");
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    setImportingNames(true);
    try {
      const url = `/.netlify/functions/importParticipantNames?week=${weekMeta.week}&pin=${encodeURIComponent(pinToUse)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed (HTTP ${res.status})`);

      const added = data.added || [];
      if (added.length === 0) {
        alert("No new names found to add.");
        return;
      }

      alert(`Added ${added.length} new participant(s):\n${added.join(", ")}`);
      await loadAll();
    } catch (e) {
      alert(`Could not import names: ${String(e?.message || e)}`);
    } finally {
      setImportingNames(false);
    }
  }

  // ✅ Save deadline via Netlify function
  async function saveDeadlineNow() {
    const pinToUse = (sessionPin || pin || "").trim();
    if (!pinToUse) return alert("PIN missing. Unlock again.");

    const season = Number(String(importSeason).trim());
    const week = Number(String(weekMeta.week || importWeek || "").trim());

    if (!season || !week) return alert("Season/week not ready.");
    if (!deadlineLocal) return alert("Pick a deadline date/time first.");

    const iso = new Date(deadlineLocal).toISOString();
    if (Number.isNaN(new Date(iso).getTime())) return alert("Invalid deadline.");

    setSavingDeadline(true);
    try {
      const url =
        `/.netlify/functions/setDeadline?season=${season}` +
        `&week=${week}` +
        `&deadline=${encodeURIComponent(iso)}` +
        `&pin=${encodeURIComponent(pinToUse)}`;

      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();

      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || `setDeadline failed (HTTP ${res.status})`);
      }

      setSavedDeadlineIso(data.deadline || iso);
      alert(`✅ Deadline saved for Season ${season} Week ${week}\n${data.deadline || iso}`);

      await loadAll();
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setSavingDeadline(false);
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
              if (pin === String(adminPin)) {
                setUnlocked(true);
                setSessionPin(pin);
              } else {
                alert("Wrong PIN.");
              }
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

      {/* Step 1 — Import Week Schedule */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Step 1 — Import Week Schedule</h3>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={importSeason}
            onChange={(e) => setImportSeason(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Season (e.g., 2025)"
            style={{ padding: 10, width: 160 }}
          />

          <input
            value={importWeek}
            onChange={(e) => setImportWeek(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Week (e.g., 1)"
            style={{ padding: 10, width: 140 }}
          />

          <button onClick={importScheduleNow} disabled={importingSchedule} style={{ padding: "10px 14px", cursor: "pointer" }}>
            {importingSchedule ? "Importing…" : "Import games"}
          </button>

          <button onClick={setCurrentWeekNow} style={{ padding: "10px 14px", cursor: "pointer" }}>
            Set as current week
          </button>
        </div>

        <p style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
          Pulls week schedule from nflverse and writes it into Supabase (server-side).
        </p>
      </div>

      {/* Step 2 — Set Weekly Deadline */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Step 2 — Set Weekly Deadline</h3>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#666" }}>
            Current saved deadline:{" "}
            <b>{savedDeadlineIso ? new Date(savedDeadlineIso).toLocaleString() : "— (not set)"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <input
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            style={{ padding: 10 }}
          />

          <button
            onClick={saveDeadlineNow}
            disabled={savingDeadline}
            style={{ padding: "10px 14px", cursor: "pointer" }}
          >
            {savingDeadline ? "Saving…" : "Save deadline"}
          </button>

          <div style={{ fontSize: 12, color: "#666" }}>
            Locks the entire pick sheet at this time. Uses your local time, saved as UTC.
          </div>
        </div>
      </div>

      {/* Step 3 — Add / Activate Participant */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Step 3 — Add / Activate Participant</h3>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#555" }}>
          🔄 Participants added here (with <b>active = true</b>) will appear in the <b>Returning Participant</b> dropdown on the picks page,
          letting them select their name to avoid typos that would break their history.
        </p>
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
          <button onClick={importNamesFromWeek} disabled={importingNames} style={{ padding: "10px 14px", cursor: "pointer" }}>
            {importingNames ? "Importing…" : "Import names from this week’s submissions"}
          </button>
        </div>

        {/* Active participants list */}
        {participants.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
              Active in dropdown ({participants.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {participants.map((p) => (
                <div key={p.user_name} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#f4f4f4", border: "1px solid #ddd",
                  borderRadius: 20, padding: "4px 10px 4px 12px",
                  fontSize: 13,
                }}>
                  <span>{p.user_name}</span>
                  <button
                    onClick={() => removeParticipant(p.user_name)}
                    title={`Remove ${p.user_name} from dropdown`}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#c00", fontWeight: 900, fontSize: 14,
                      lineHeight: 1, padding: "0 2px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#999" }}>
              Removing a name only hides it from the dropdown — their picks history stays intact.
            </p>
          </div>
        )}
      </div>

      {/* Step 4 — Monitor Submissions */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Step 4 — Monitor Submissions</h3>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, color: "#555" }}>Submitted</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.submitted.length}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, color: "#555" }}>Missing</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.missing.length}</div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
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
                <th style={thCenter}>Actions</th>
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
                        <input type="checkbox" checked={r.paid} onChange={(e) => togglePaid(r.user_name, e.target.checked)} />
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
                                  <button type="button" onClick={() => toggleExpanded(r.user_name)} style={linkBtnStyle}>
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
                    <td style={tdCenter}>
                      {r.picksCount === 0 && r.tbCount === 0 ? (
                        <span style={{ color: "#bbb", fontSize: 13 }}>—</span>
                      ) : (
                        <button
                          onClick={() => removePicksForUser(r.user_name)}
                          style={{ padding: "4px 10px", cursor: "pointer", color: "#c00", borderColor: "#c00", background: "transparent", borderRadius: 4 }}
                        >
                          Remove
                        </button>
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

      {/* Step 5 — Process Results */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Step 5 — Process Results</h3>
        <p style={{ margin: "0 0 10px", color: "#666", fontSize: 13 }}>
          Run after games go final to score picks and update the leaderboard. Safe to run multiple times.
        </p>
        <button onClick={runResultsNow} disabled={runningResults} style={{ padding: "10px 14px", cursor: "pointer" }}>
          {runningResults ? "Running…" : "Run Results Processor"}
        </button>
      </div>
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