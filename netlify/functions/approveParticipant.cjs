const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

const SITE_URL = process.env.URL || "https://nflpicks.netlify.app";

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    // NOTE: "username" here is the app_users login handle -- distinct from
    // participants.user_name, which actually stores the person's full name.
    const token = String(event.queryStringParameters?.token || "");
    const username = String(event.queryStringParameters?.username || "").trim();

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!username) return j(400, { ok: false, error: "Missing username." });

    const { data: found, error: findErr } = await admin
      .from("app_users")
      .select("username, full_name, email")
      .ilike("username", username)
      .maybeSingle();
    if (findErr) return j(500, { ok: false, error: findErr.message });
    if (!found) return j(404, { ok: false, error: "No account with that username." });

    const { error: updErr } = await admin.from("app_users").update({ approved: true }).ilike("username", username);
    if (updErr) return j(500, { ok: false, error: updErr.message });

    const { error: upsertErr } = await admin
      .from("participants")
      .upsert([{ user_name: found.full_name, buy_in: 0, active: true }], { onConflict: "user_name" });
    if (upsertErr) return j(500, { ok: false, error: upsertErr.message });

    // Best-effort: a failed/skipped email should never fail the approval
    // itself, which already fully succeeded above.
    await sendApprovalEmail(found).catch((e) => console.error("approval email failed:", e));

    return j(200, { ok: true, username: found.username, full_name: found.full_name });
  } catch (e) {
    return j(500, { ok: false, error: e?.message || String(e) });
  }
};

async function sendApprovalEmail(user) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !user.email) {
    console.log("Skipping approval email (no RESEND_API_KEY or no email on file).");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NFL Weekly Picks <onboarding@resend.dev>",
      to: [user.email],
      subject: "You're approved for NFL Weekly Picks!",
      text:
        `Hi ${user.full_name},\n\n` +
        `Your NFL Weekly Picks account has been approved. You can log in now with your username @${user.username} at ${SITE_URL}.\n\n` +
        `Good luck!`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Resend send failed (${res.status}): ${body}`);
  }
}

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
