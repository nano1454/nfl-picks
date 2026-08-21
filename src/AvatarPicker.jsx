import React, { useEffect, useState } from "react";
import Button from "./Button";

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 560,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontWeight: 900, fontSize: 18, margin: 0 },
  closeBtn: {
    border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 8,
    width: 28, height: 28, cursor: "pointer", fontSize: 14, fontWeight: 800,
  },
  select: {
    padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc",
    fontSize: 14, marginBottom: 12, width: "100%", boxSizing: "border-box",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
    gap: 8, overflowY: "auto", paddingRight: 4,
  },
  thumbWrap: {
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "50%", cursor: "pointer", padding: 2,
  },
  thumb: { width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" },
};

export default function AvatarPicker({ current, onSelect, onClose }) {
  const [manifest, setManifest] = useState(null);
  const [category, setCategory] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
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
  }, [onClose]);

  useEffect(() => {
    fetch("/avatars/manifest.json", { cache: "force-cache" })
      .then((r) => r.json())
      .then((data) => {
        setManifest(data);
        setCategory(data?.categories?.[0]?.key || null);
      })
      .catch(() => setErr("Couldn't load avatars right now."));
  }, []);

  const activeCategory = manifest?.categories?.find((c) => c.key === category);

  return (
    <div style={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.headerRow}>
          <h3 style={styles.title}>Choose an Avatar</h3>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {err && <p style={{ color: "#c00", fontSize: 13 }}>{err}</p>}

        {manifest && (
          <>
            <select style={styles.select} value={category || ""} onChange={(e) => setCategory(e.target.value)}>
              {manifest.categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label} ({c.files.length})</option>
              ))}
            </select>

            <div style={{ marginBottom: 10 }}>
              <Button
                variant={current ? "secondary" : "dark"}
                size="sm"
                onClick={() => { onSelect(null); onClose(); }}
              >
                No avatar (use initials)
              </Button>
            </div>

            <div style={styles.grid}>
              {(activeCategory?.files || []).map((f) => (
                <div
                  key={f}
                  style={{
                    ...styles.thumbWrap,
                    border: current === f ? "3px solid #111" : "3px solid transparent",
                  }}
                  onClick={() => { onSelect(f); onClose(); }}
                  title={f}
                >
                  <img src={`/avatars/cut/${f}`} alt={f} style={styles.thumb} loading="lazy" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
