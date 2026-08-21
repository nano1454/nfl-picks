import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getSession, setSession } from "./auth";
import { pageBackgroundStyle } from "./backgroundStyle";
import Button from "./Button";

const styles = {
  card: {
    maxWidth: 420,
    width: "100%",
    margin: "48px auto",
    background: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    padding: 24,
    color: "#000",
  },
  h1: { fontSize: 24, fontWeight: 800, margin: "0 0 4px" },
  muted: { color: "rgba(0,0,0,0.65)", fontSize: 13, margin: "0 0 20px" },
  sectionLabel: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: "#666", margin: "18px 0 10px" },
  field: { display: "grid", gap: 6, fontSize: 14, marginBottom: 14 },
  input: {
    padding: "10px 12px",
    border: "1px solid #9ca3af",
    borderRadius: 8,
    background: "#333",
    color: "#fff",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 15,
    letterSpacing: 1,
  },
  error: { color: "#c00", fontSize: 13, marginTop: 10 },
  success: { color: "#0a7d2c", fontSize: 13, marginTop: 10 },
};

export default function Profile() {
  const session = getSession();

  const [username, setUsername] = useState(session?.username || "");
  const [fullName, setFullName] = useState(session?.fullName || "");
  const [email, setEmail] = useState(session?.email || "");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function onDigitsOnly(setter) {
    return (e) => setter(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (!/^\d{4}$/.test(currentPin)) return setErr("Enter your current 4-digit PIN to confirm changes.");
    if (newPin && newPin !== confirmNewPin) return setErr("New PINs don't match.");
    if (newPin && !/^\d{4}$/.test(newPin)) return setErr("New PIN must be exactly 4 digits.");

    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/updateProfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session.username,
          currentPin,
          newUsername: username.trim(),
          newFullName: fullName.trim(),
          newEmail: email.trim(),
          newPin: newPin || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) throw new Error(data?.error || "Something went wrong.");

      setSession(data.user);
      setUsername(data.user.username);
      setFullName(data.user.fullName);
      setEmail(data.user.email || "");
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setSuccess("Saved!");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <div style={pageBackgroundStyle}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Profile Settings</h1>
          <p style={styles.muted}>Update your account details below.</p>

          <form onSubmit={submit}>
            <label style={styles.field}>
              <span>Username</span>
              <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </label>

            <label style={styles.field}>
              <span>Full name</span>
              <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>

            <label style={styles.field}>
              <span>Email</span>
              <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>

            <div style={styles.sectionLabel}>Change PIN (optional)</div>

            <label style={styles.field}>
              <span>New 4-digit PIN</span>
              <input
                style={styles.input}
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={onDigitsOnly(setNewPin)}
                placeholder="Leave blank to keep current PIN"
                autoComplete="new-password"
              />
            </label>

            {newPin && (
              <label style={styles.field}>
                <span>Confirm new PIN</span>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  value={confirmNewPin}
                  onChange={onDigitsOnly(setConfirmNewPin)}
                  placeholder="••••"
                  autoComplete="new-password"
                />
              </label>
            )}

            <div style={styles.sectionLabel}>Confirm</div>

            <label style={styles.field}>
              <span>Current PIN (required to save any change)</span>
              <input
                style={styles.input}
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={onDigitsOnly(setCurrentPin)}
                placeholder="••••"
                autoComplete="current-password"
              />
            </label>

            {err && <p style={styles.error}>{err}</p>}
            {success && <p style={styles.success}>{success}</p>}

            <Button type="submit" variant="primary" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </form>

          <div style={{ marginTop: 14 }}>
            <Link to="/">
              <Button variant="secondary" style={{ width: "100%" }}>
                ← Back
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
