import React from "react";

// Full-bleed page-top banner, shared by App.jsx/Results.jsx/Leaderboard.jsx/
// TeamStats.jsx. Rendered as a CSS background (not an <img> with
// object-fit: cover) specifically so the banner never gets cropped -- the
// whole image (including the tagline text near its edges) always stays
// visible, just scaled down to fit a shorter strip. backgroundColor
// matches the banners' own black background so any letterbox space blends
// in seamlessly instead of showing as an empty margin.
export default function PageBanner({ src, alt, height = 80 }) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        width: "100%",
        height,
        backgroundColor: "#000",
        backgroundImage: `url(${src})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    />
  );
}
