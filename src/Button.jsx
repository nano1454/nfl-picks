import React, { useState } from "react";

const SIZES = {
  sm: { padding: "7px 14px", fontSize: 12 },
  md: { padding: "10px 18px", fontSize: 14 },
};

const VARIANTS = {
  primary: {
    background: "linear-gradient(160deg, #ffe98a, #ffd700, #d4a017)",
    color: "#1a1200",
    ledge: "#a97c0a",
    border: "none",
  },
  secondary: {
    background: "linear-gradient(160deg, #ffffff, #f0f0f0)",
    color: "#171717",
    ledge: "#cfcfcf",
    border: "1px solid rgba(0,0,0,0.08)",
  },
  dark: {
    background: "linear-gradient(160deg, #2b2b2b, #050505)",
    color: "#ffd700",
    ledge: "#000000",
    border: "1px solid rgba(255,215,0,0.25)",
  },
  danger: {
    background: "linear-gradient(160deg, #ff9a86, #ff5a3c)",
    color: "#3a0a00",
    ledge: "#c23f28",
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: "#0b5cff",
    ledge: null,
    border: "none",
  },
};

/** Reusable "gummy" 3D button — gradient face, bottom ledge shadow that
 * compresses on click. Variants: primary (gold), secondary (white/neutral),
 * dark (black/gold text), danger (red), ghost (plain text link, e.g.
 * inline "show more" toggles). Pass `pill` for fully-rounded nav-style buttons.
 */
export default function Button({
  variant = "secondary",
  size = "md",
  pill = false,
  disabled = false,
  style,
  children,
  ...props
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.secondary;
  const s = SIZES[size] || SIZES.md;
  const isGhost = variant === "ghost";

  const ledgeSize = isGhost || disabled ? 0 : active ? 1 : hover ? 4 : 3;
  const boxShadow =
    isGhost || disabled
      ? "none"
      : `0 ${ledgeSize}px 0 ${v.ledge}, 0 ${ledgeSize + 3}px ${8 + ledgeSize}px rgba(0,0,0,0.18)`;

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...s,
        fontWeight: isGhost ? 600 : 700,
        borderRadius: pill ? 999 : 12,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        transition: "transform 0.08s ease, box-shadow 0.12s ease, filter 0.12s ease, opacity 0.12s ease",
        background: v.background,
        color: v.color,
        border: v.border,
        boxShadow,
        opacity: disabled ? 0.5 : 1,
        transform:
          !disabled && !isGhost && active ? "translateY(2px)" : !disabled && !isGhost && hover ? "translateY(-1px)" : "none",
        filter: !disabled && !isGhost && hover ? "brightness(1.04)" : "none",
        textDecoration: isGhost ? "underline" : "none",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
