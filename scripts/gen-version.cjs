// Writes public/version.json with a fresh value on every build, so the
// running app can detect when a newer deploy has gone live (see
// src/UpdateBanner.jsx) and prompt the user to refresh.
const fs = require("fs");
const path = require("path");

const version = new Date().toISOString();
const out = path.join(__dirname, "..", "public", "version.json");

fs.writeFileSync(out, JSON.stringify({ version }));
console.log(`Wrote ${out} (version=${version})`);
