import React, { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const baselineRef = useRef(null);

  async function fetchVersion() {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.version || null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const v = await fetchVersion();
      if (!cancelled) baselineRef.current = v;
    })();

    async function check() {
      if (!baselineRef.current) return;
      const v = await fetchVersion();
      if (v && v !== baselineRef.current) setUpdateAvailable(true);
    }

    const interval = setInterval(check, CHECK_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => window.location.reload()}
      onKeyDown={(e) => e.key === "Enter" && window.location.reload()}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "10px 16px",
        background: "linear-gradient(90deg, #111 0%, #3a2e0a 55%, #111 100%)",
        color: "#ffd700",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <span>🔄 A new version of NFL Weekly Picks is available — tap to refresh</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "#ffd700",
          fontWeight: 900,
          fontSize: 16,
          cursor: "pointer",
          lineHeight: 1,
          padding: "2px 6px",
        }}
      >
        ✕
      </button>
    </div>
  );
}
