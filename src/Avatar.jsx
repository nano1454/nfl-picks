import React from "react";

const PALETTE = [
  "#e11d48", "#db2777", "#c026d3", "#7c3aed", "#4f46e5",
  "#2563eb", "#0891b2", "#059669", "#65a30d", "#d97706",
];

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({ username, avatar, size = 44 }) {
  if (avatar) {
    return (
      <img
        src={`/avatars/cut/${avatar}`}
        alt={username || "avatar"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          border: "2px solid rgba(255,255,255,0.8)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      />
    );
  }

  const letter = (username || "?").trim()[0]?.toUpperCase() || "?";
  const color = colorFromString(username || "?");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.42,
        border: "2px solid rgba(255,255,255,0.8)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {letter}
    </div>
  );
}
