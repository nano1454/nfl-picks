import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { getSession } from "./auth";
import Button from "./Button";
import Avatar from "./Avatar";

// Duplicated on purpose -- same small helper App.jsx/TeamStats.jsx/
// CumulativePoints.jsx/HallOfChampions.jsx/History.jsx each keep their own
// copy of rather than sharing. Returns the season that just played (Jan-Jul
// off-season) or is currently playing (Aug-Dec); the Season Fund always
// targets the *next* one, so callers add 1.
function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  return m < 7 ? y - 1 : y;
}

function fmtMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function SeasonFund() {
  const session = getSession();
  const isAdmin = !!session?.isAdmin && !!session?.adminToken;
  const myFullName = session?.fullName || "";
  const season = getDefaultNflSeasonYear() + 1;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [settingsRes, depositsRes, usernamesRes] = await Promise.all([
        supabase.from("preseason_tracker_settings").select("season, enabled, target_amount").eq("season", season).maybeSingle(),
        supabase
          .from("preseason_deposits")
          .select("id, user_name, amount, status, note, submitted_at")
          .eq("season", season)
          .order("submitted_at", { ascending: true }),
        fetch("/.netlify/functions/getUsernames", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (depositsRes.error) throw depositsRes.error;

      setSettings(settingsRes.data || { season, enabled: false, target_amount: 540 });
      setDeposits(depositsRes.data || []);
      setUsernameByFullName(usernamesRes?.ok ? usernamesRes.usernames || {} : {});
      setAvatarByFullName(usernamesRes?.ok ? usernamesRes.avatars || {} : {});
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

  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  const rows = useMemo(() => {
    const byUser = {};
    for (const d of deposits) {
      const name = String(d.user_name || "").trim();
      if (!name) continue;
      const row = (byUser[name] ||= { user_name: name, approvedTotal: 0, pending: [] });
      const amt = Number(d.amount || 0);
      if (d.status === "approved") row.approvedTotal += amt;
      else if (d.status === "pending") row.pending.push(d);
    }
    return Object.values(byUser).sort((a, b) => {
      if (b.approvedTotal !== a.approvedTotal) return b.approvedTotal - a.approvedTotal;
      return dispName(a.user_name).localeCompare(dispName(b.user_name));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposits, usernameByFullName]);

  const myPending = deposits.filter((d) => d.user_name === myFullName && d.status === "pending");

  async function submitDeposit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Enter a deposit amount greater than $0.");
    if (!myFullName) return alert("Not signed in.");

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("preseason_deposits")
        .insert([{ season, user_name: myFullName, amount: amt, note: note.trim() || null, status: "pending" }]);
      if (error) throw error;
      setAmount("");
      setNote("");
      await loadAll();
    } catch (e) {
      alert(`Could not submit deposit: ${String(e?.message || e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, color: "red" }}>{err}</div>;

  const enabled = !!settings?.enabled;
  const target = Number(settings?.target_amount || 540);

  if (!enabled && !isAdmin) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui", textAlign: "center" }}>
        <Link to="/">
          <Button variant="dark" size="sm">← Back</Button>
        </Link>
        <h1 style={{ marginTop: 24 }}>🏈 Season Fund</h1>
        <p style={{ color: "#666" }}>Coming soon — check back during the off-season.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <style>{`
        @keyframes sfBarShimmer { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>🏈 Season Fund</h1>
          <p style={{ margin: "6px 0 0", color: "#666" }}>
            Deposit toward next season's {fmtMoney(target)} buy-in at your own pace — no more week-by-week chasing.
          </p>
        </div>
        <Link to="/">
          <Button variant="dark" size="sm">← Back</Button>
        </Link>
      </div>

      {!enabled && isAdmin && (
        <div style={{ margin: "14px 0", padding: 10, border: "1px dashed #b8860b", borderRadius: 10, background: "rgba(255,215,0,0.06)", fontSize: 13, color: "#7a5c14" }}>
          Preview mode — this page is still hidden from participants. Turn it on from Admin when you're ready.
        </div>
      )}

      {/* Submit a deposit */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Submit a deposit</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="Amount (e.g. 20)"
            style={{ padding: 10, width: 160 }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional, e.g. Venmo)"
            style={{ padding: 10, width: 220 }}
          />
          <Button variant="primary" onClick={submitDeposit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
        <p style={{ margin: "8px 0 0", color: "#666", fontSize: 12 }}>
          Your deposit sits as pending until it's confirmed received — then it'll count toward your bar below.
        </p>

        {myPending.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {myPending.map((d) => (
              <div key={d.id} style={{ fontSize: 13, color: "#946200" }}>
                + {fmtMoney(d.amount)} pending{d.note ? ` (${d.note})` : ""} — awaiting confirmation
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bars */}
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        {rows.length === 0 ? (
          <p style={{ color: "#666" }}>No deposits yet — be the first!</p>
        ) : (
          rows.map((r) => {
            const pctTrue = Math.min(100, (r.approvedTotal / target) * 100);
            const pctBar = Math.max(r.approvedTotal > 0 ? 2 : 0, pctTrue);
            const paidInFull = r.approvedTotal >= target;
            const pendingTotal = r.pending.reduce((s, d) => s + Number(d.amount || 0), 0);

            return (
              <div
                key={r.user_name}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  border: paidInFull ? "1px solid rgba(184,134,11,0.5)" : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  background: "#f0f0f0",
                  boxShadow: paidInFull ? "0 4px 18px rgba(184,134,11,0.18)" : "0 4px 14px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${pctBar}%`,
                    background: "linear-gradient(90deg, #111 0%, #7a5c14 55%, #ffd700 100%)",
                    transition: "width 650ms cubic-bezier(0.2, 0.9, 0.2, 1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "45%",
                      height: "100%",
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                      animation: "sfBarShimmer 1.8s ease-in-out infinite",
                    }}
                  />
                </div>

                <div style={{ position: "relative", padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(255,255,255,0.88)",
                      borderRadius: 999,
                      padding: "4px 12px 4px 4px",
                    }}
                  >
                    <Avatar username={dispName(r.user_name)} avatar={avatarByFullName?.[r.user_name]} size={32} />
                    <div style={{ fontWeight: 800, color: "#111" }}>{dispName(r.user_name)}</div>
                  </div>

                  <div style={{ flex: 1 }} />

                  {paidInFull && (
                    <div
                      style={{
                        fontWeight: 800,
                        color: "#b8860b",
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        background: "rgba(255,255,255,0.88)",
                        borderRadius: 999,
                        padding: "4px 10px",
                      }}
                    >
                      🏈 Paid in full!
                    </div>
                  )}

                  <div style={{ textAlign: "right", background: "rgba(255,255,255,0.88)", borderRadius: 10, padding: "4px 10px" }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: paidInFull ? "#b8860b" : "#111" }}>
                      {fmtMoney(r.approvedTotal)} / {fmtMoney(target)}
                    </div>
                    {pendingTotal > 0 && (
                      <div style={{ fontSize: 11, color: "#946200" }}>+ {fmtMoney(pendingTotal)} pending</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
