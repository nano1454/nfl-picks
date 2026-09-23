import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { to: "/results", label: "View Picks Table" },
  { to: "/leaderboard", label: "Live Leaderboard" },
  { to: "/whos-in", label: "Who's In" },
  { to: "/hall-of-champions", label: "🏆 Hall of Champions" },
  { to: "/team-stats", label: "📊 NFL Team Stats" },
  { to: "/rules", label: "Rules" },
  { to: "/reglas", label: "Reglas" },
  { to: "/history", label: "Season History" },
];

export default function NavDrawer({ open, onClose, onLogout, paymentMenu }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 998,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        role="dialog"
        aria-label="Menu"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: "82vw",
          background: "linear-gradient(180deg, #0a0a0a 0%, #1c1c1c 100%)",
          zIndex: 999,
          boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.2, 0.9, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span style={{ color: "#ffd700", fontWeight: 900, fontSize: 17 }}>🏈 NFL Weekly Picks</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 18,
              fontWeight: 800,
              cursor: "pointer",
              lineHeight: 1,
              width: 32,
              height: 32,
            }}
          >
            ✕
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", padding: "8px 0", overflowY: "auto", flex: 1 }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={onClose}
              style={{
                padding: "14px 20px",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {l.label}
            </Link>
          ))}

          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {paymentMenu}
          </div>
        </nav>

        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            style={{
              width: "100%",
              padding: "12px",
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
