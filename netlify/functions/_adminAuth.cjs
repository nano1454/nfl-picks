const crypto = require("crypto");

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function sign(username, issuedAt, secret) {
  return crypto.createHmac("sha256", secret).update(`${username}|${issuedAt}`).digest("hex");
}

// Called at login time (by auth.cjs) once we already know the account is an admin.
function issueAdminToken(username) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET.");
  const issuedAt = Date.now();
  const sig = sign(username, issuedAt, secret);
  return Buffer.from(`${username}|${issuedAt}|${sig}`).toString("base64url");
}

// Verifies the token's signature + expiry, then re-checks is_admin in the
// database right now (so revoking admin status takes effect immediately,
// not just when the token eventually expires).
async function requireAdmin(admin, token) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return null;

  let username, issuedAtStr, sig;
  try {
    const decoded = Buffer.from(String(token), "base64url").toString("utf8");
    [username, issuedAtStr, sig] = decoded.split("|");
  } catch {
    return null;
  }
  if (!username || !issuedAtStr || !sig) return null;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > TOKEN_MAX_AGE_MS) return null;

  const expected = sign(username, issuedAt, secret);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const { data, error } = await admin.from("app_users").select("username, is_admin").ilike("username", username).maybeSingle();
  if (error || !data || !data.is_admin) return null;

  return { username: data.username };
}

exports.issueAdminToken = issueAdminToken;
exports.requireAdmin = requireAdmin;
