import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";

const RADIUS = 50; // physics collision radius, px
const AVATAR_SIZE = 60;
const SPEED = 0.4; // baseline px/frame -- kept small for a slow-motion feel

export default function BouncingRoster({ people }) {
  const containerRef = useRef(null);
  const ballRefs = useRef({}); // key -> DOM node
  const stateRef = useRef([]); // [{ key, x, y, vx, vy, r }]
  const rafRef = useRef(null);

  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // (Re)initialize ball state whenever the roster changes -- preserves
  // position/velocity for anyone already animating, only seeds new entries.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    const existing = new Map(stateRef.current.map((b) => [b.key, b]));

    stateRef.current = people.map((p) => {
      const prev = existing.get(p.key);
      if (prev) return prev;
      const w = Math.max(1, width - 2 * RADIUS);
      const h = Math.max(1, height - 2 * RADIUS);
      return {
        key: p.key,
        x: RADIUS + Math.random() * w,
        y: RADIUS + Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED * 2,
        vy: (Math.random() - 0.5) * SPEED * 2,
        r: RADIUS,
      };
    });
  }, [people]);

  // Long-lived animation loop -- reads live refs each frame, so it doesn't
  // need to restart when the roster changes (see effect above).
  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;

    let bounds = container.getBoundingClientRect();
    let resizeTimer = null;

    function onResize() {
      const rect = container.getBoundingClientRect();
      // Clamp existing balls into the new bounds instead of resetting them.
      for (const b of stateRef.current) {
        b.x = Math.min(Math.max(b.x, b.r), Math.max(b.r, rect.width - b.r));
        b.y = Math.min(Math.max(b.y, b.r), Math.max(b.r, rect.height - b.r));
      }
      bounds = rect;
    }
    function debouncedResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 150);
    }
    window.addEventListener("resize", debouncedResize);

    function tick() {
      const balls = stateRef.current;
      const n = balls.length;

      for (let i = 0; i < n; i++) {
        const b = balls[i];
        b.x += b.vx;
        b.y += b.vy;
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x + b.r > bounds.width) { b.x = bounds.width - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.y + b.r > bounds.height) { b.y = bounds.height - b.r; b.vy = -Math.abs(b.vy); }
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = balls[i];
          const c = balls[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const minDist = a.r + c.r;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap;
            c.x += nx * overlap; c.y += ny * overlap;

            const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
            if (rel < 0) {
              a.vx += rel * nx; a.vy += rel * ny;
              c.vx -= rel * nx; c.vy -= rel * ny;
            }
          }
        }
      }

      for (let i = 0; i < n; i++) {
        const b = balls[i];
        const el = ballRefs.current[b.key];
        if (el) el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", alignContent: "center", height: "100%", padding: 24, overflowY: "auto" }}>
        {people.map((p) => (
          <div key={p.key} style={{ textAlign: "center", width: 90 }}>
            <Avatar username={p.username} avatar={p.avatar} size={AVATAR_SIZE} />
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {p.username}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {people.map((p) => (
        <div
          key={p.key}
          ref={(el) => {
            if (el) ballRefs.current[p.key] = el;
            else delete ballRefs.current[p.key];
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: RADIUS * 2,
            height: RADIUS * 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          <Avatar username={p.username} avatar={p.avatar} size={AVATAR_SIZE} />
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
              marginTop: 2,
              maxWidth: 110,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.username}
          </div>
        </div>
      ))}
    </div>
  );
}
