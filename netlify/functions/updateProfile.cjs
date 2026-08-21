const { createClient } = require("@supabase/supabase-js");
const { issueAdminToken } = require("./_adminAuth.cjs");
const { hashPin, pinsMatch, newSalt } = require("./_pin.cjs");

// No server-side session exists in this app -- re-entering the current PIN
// is the re-auth, the same way login itself works.
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

    const username = String(body.username || "").trim();
    const currentPin = String(body.currentPin || "").trim();
    if (!username) return j(400, { ok: false, error: "Username is required." });
    if (!/^\d{4}$/.test(currentPin)) return j(400, { ok: false, error: "Current PIN must be exactly 4 digits." });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: found, error: findErr } = await admin
      .from("app_users")
      .select("id, username, full_name, email, pin_hash, pin_salt, is_admin")
      .ilike("username", username)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!found || !pinsMatch(currentPin, found.pin_salt, found.pin_hash)) {
      return j(401, { ok: false, error: "Incorrect current PIN." });
    }

    const updates = {};

    // Username
    if (body.newUsername !== undefined) {
      const newUsername = String(body.newUsername || "").trim();
      if (newUsername && newUsername.toLowerCase() !== found.username.toLowerCase()) {
        if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(newUsername)) {
          return j(400, { ok: false, error: "Username must be 3-24 characters (letters, numbers, _ . -)." });
        }
        const { data: clash, error: clashErr } = await admin
          .from("app_users")
          .select("id")
          .ilike("username", newUsername)
          .neq("id", found.id)
          .maybeSingle();
        if (clashErr) throw clashErr;
        if (clash) return j(409, { ok: false, error: "That username is already taken." });
        updates.username = newUsername;
      }
    }

    // Email
    if (body.newEmail !== undefined) {
      const newEmail = String(body.newEmail || "").trim();
      if (newEmail && newEmail !== (found.email || "")) {
        if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
          return j(400, { ok: false, error: "That email address doesn't look valid." });
        }
        updates.email = newEmail;
      }
    }

    // PIN
    if (body.newPin !== undefined) {
      const newPin = String(body.newPin || "").trim();
      if (newPin) {
        if (!/^\d{4}$/.test(newPin)) return j(400, { ok: false, error: "New PIN must be exactly 4 digits." });
        const salt = newSalt();
        updates.pin_hash = hashPin(newPin, salt);
        updates.pin_salt = salt;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin.from("app_users").update(updates).eq("id", found.id);
      if (updErr) {
        if (updErr.code === "23505") return j(409, { ok: false, error: "That username is already taken." });
        throw updErr;
      }
    }

    // Full name -- cascading rename across every table that duplicates it
    // as a join key (see rename_participant_full_name.sql). Handled last
    // and separately from the plain `updates` above since it needs a
    // collision check across two tables and a dedicated RPC, not a simple
    // column update.
    if (body.newFullName !== undefined) {
      const newFullName = String(body.newFullName || "").trim();
      if (newFullName && newFullName !== found.full_name) {
        const { data: nameClash, error: nameClashErr } = await admin
          .from("app_users")
          .select("id")
          .eq("full_name", newFullName)
          .neq("id", found.id)
          .maybeSingle();
        if (nameClashErr) throw nameClashErr;
        if (nameClash) return j(409, { ok: false, error: "That name is already in use by another account." });

        const { data: partClash, error: partClashErr } = await admin
          .from("participants")
          .select("user_name")
          .eq("user_name", newFullName)
          .maybeSingle();
        if (partClashErr) throw partClashErr;
        if (partClash) return j(409, { ok: false, error: "That name is already in use by another participant." });

        const { error: rpcErr } = await admin.rpc("rename_participant_full_name", {
          p_user_id: found.id,
          p_new_name: newFullName,
        });
        if (rpcErr) throw rpcErr;
      }
    }

    const { data: updated, error: reselectErr } = await admin
      .from("app_users")
      .select("username, full_name, email, is_admin")
      .eq("id", found.id)
      .maybeSingle();
    if (reselectErr) throw reselectErr;

    const isAdmin = !!updated.is_admin;
    const user = { username: updated.username, fullName: updated.full_name, email: updated.email || "", isAdmin };
    // Re-issue unconditionally when admin -- cheap, and avoids a stale token
    // if the username changed (the old token is signed over the old name).
    if (isAdmin) user.adminToken = issueAdminToken(updated.username);

    return j(200, { ok: true, user });
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
