// netlify/functions/auth.js
const { createClient } = require("@supabase/supabase-js");
const { issueAdminToken } = require("./_adminAuth.cjs");
const { sendEmail, SITE_URL } = require("./_resend.cjs");
const { hashPin, pinsMatch, newSalt } = require("./_pin.cjs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return j(405, { ok: false, error: "Method not allowed." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return j(400, { ok: false, error: "Invalid JSON body." });
    }

    const action = String(body.action || "");
    const username = String(body.username || "").trim();
    const pin = String(body.pin || "").trim();

    if (!username) return j(400, { ok: false, error: "Username is required." });
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
      return j(400, { ok: false, error: "Username must be 3-24 characters (letters, numbers, _ . -)." });
    }
    if (!/^\d{4}$/.test(pin)) return j(400, { ok: false, error: "PIN must be exactly 4 digits." });

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "signup") {
      const fullName = String(body.fullName || "").trim();
      if (!fullName) return j(400, { ok: false, error: "Full name is required." });

      const email = String(body.email || "").trim();
      if (!email) return j(400, { ok: false, error: "Email is required." });
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return j(400, { ok: false, error: "That email address doesn't look valid." });
      }

      const { data: existing, error: findErr } = await admin
        .from("app_users")
        .select("id")
        .ilike("username", username)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing) return j(409, { ok: false, error: "That username is already taken." });

      const salt = newSalt();
      const pinHash = hashPin(pin, salt);

      const { error: insErr } = await admin
        .from("app_users")
        .insert([{ username, full_name: fullName, pin_hash: pinHash, pin_salt: salt, email: email || null, approved: false }]);
      if (insErr) {
        if (insErr.code === "23505") return j(409, { ok: false, error: "That username is already taken." });
        throw insErr;
      }

      // participants row is created once an admin approves this signup, not here.

      // Best-effort: let admins know someone's waiting, without blocking the
      // signup itself. Resend's shared sandbox sender can only deliver to the
      // Resend account's own verified address, which is exactly what admin
      // accounts' emails are here -- no custom domain needed for this one.
      const { data: admins } = await admin.from("app_users").select("email").eq("is_admin", true);
      const adminEmails = (admins || []).map((a) => a.email).filter(Boolean);
      await sendEmail({
        to: adminEmails,
        subject: "New signup pending approval — NFL Weekly Picks",
        text:
          `${fullName} (@${username}, ${email}) just signed up for NFL Weekly Picks and is waiting on your approval.\n\n` +
          `Approve or reject at ${SITE_URL}/admin`,
      });

      return j(200, { ok: true, pending: true });
    }

    if (action === "login") {
      const { data: found, error: findErr } = await admin
        .from("app_users")
        .select("username, full_name, email, pin_hash, pin_salt, is_admin, approved")
        .ilike("username", username)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!found || !pinsMatch(pin, found.pin_salt, found.pin_hash)) {
        return j(401, { ok: false, error: "Incorrect username or PIN." });
      }

      if (!found.approved) {
        return j(403, { ok: false, pending: true, error: "Your account is waiting on admin approval. Check back soon!" });
      }

      const isAdmin = !!found.is_admin;
      const user = { username: found.username, fullName: found.full_name, email: found.email || "", isAdmin };
      if (isAdmin) user.adminToken = issueAdminToken(found.username);

      return j(200, { ok: true, user });
    }

    return j(400, { ok: false, error: "Unknown action." });
  } catch (e) {
    return j(500, { ok: false, error: String(e?.message || e) });
  }
};

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
