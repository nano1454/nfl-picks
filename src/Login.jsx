import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setSession } from "./auth";
import { pageBackgroundStyle } from "./backgroundStyle";

const styles = {
  card: {
    maxWidth: 380,
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
  tabs: { display: "flex", gap: 8, marginBottom: 18 },
  tab: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.9)",
    color: "#111",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  tabActive: { background: "#111", color: "#fff", border: "1px solid #111" },
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
  btnPrimary: {
    padding: "10px 16px",
    border: "none",
    borderRadius: 10,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    width: "100%",
    marginTop: 4,
  },
  error: { color: "#c00", fontSize: 13, marginTop: 10 },
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function onDigitsOnly(setter) {
    return (e) => setter(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    const uname = username.trim();
    if (!uname) return setErr("Enter a username.");
    if (!/^\d{4}$/.test(pin)) return setErr("PIN must be exactly 4 digits.");

    if (mode === "signup") {
      if (!fullName.trim()) return setErr("Full name is required so the admin knows who you are.");
      if (pin !== confirmPin) return setErr("PINs don't match.");
    }

    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          username: uname,
          fullName: fullName.trim(),
          pin,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Something went wrong.");
      }

      setSession(data.user);
      navigate(from, { replace: true });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageBackgroundStyle}>
      <div style={styles.card}>
        <h1 style={styles.h1}>NFL Weekly Picks</h1>
        <p style={styles.muted}>
          {mode === "login" ? "Log in to make your picks." : "Create an account to make your picks."}
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => {
              setMode("login");
              setErr("");
            }}
          >
            Log In
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            onClick={() => {
              setMode("signup");
              setErr("");
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit}>
          <label style={styles.field}>
            <span>Username</span>
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jsmith"
              autoComplete="username"
            />
          </label>

          {mode === "signup" && (
            <label style={styles.field}>
              <span>Full name (shown to admin)</span>
              <input
                style={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </label>
          )}

          <label style={styles.field}>
            <span>4-digit PIN</span>
            <input
              style={styles.input}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={onDigitsOnly(setPin)}
              placeholder="••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {mode === "signup" && (
            <label style={styles.field}>
              <span>Confirm PIN</span>
              <input
                style={styles.input}
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={onDigitsOnly(setConfirmPin)}
                placeholder="••••"
                autoComplete="new-password"
              />
            </label>
          )}

          {err && <p style={styles.error}>{err}</p>}

          <button type="submit" style={styles.btnPrimary} disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
