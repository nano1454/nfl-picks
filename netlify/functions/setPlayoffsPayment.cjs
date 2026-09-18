const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

// Playoffs' $40 buy-in is one flat payment for the whole postseason, always
// recorded against week 19 (Wild Card) regardless of which round is
// currently open -- matches PLAYOFFS_FIRST_WEEK in src/playoffsConfig.js.
const PLAYOFFS_FIRST_WEEK = 19;

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const user_name = String(event.queryStringParameters?.user_name || "").trim();
    const paid = String(event.queryStringParameters?.paid || "") === "true";

    const admin = createClient(supabaseUrl, serviceKey);

    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!user_name) return j(400, { ok: false, error: "Missing user_name." });

    // Make sure the playoffs_participants row exists -- mirrors
    // setWeekPayment.cjs's own auto-provisioning, but against the
    // independent playoffs roster so this never touches the regular-season
    // `participants` table (a playoffs-only participant must never end up
    // as a regular-season participant just from a payment toggle).
    const { error: partErr } = await admin
      .from("playoffs_participants")
      .upsert([{ user_name }], { onConflict: "user_name" });
    if (partErr) return j(500, { ok: false, error: `playoffs_participants: ${partErr.message}` });

    const { error: payErr } = await admin
      .from("week_payments")
      .upsert([{ week: PLAYOFFS_FIRST_WEEK, user_name, paid }], { onConflict: "week,user_name" });
    if (payErr) return j(500, { ok: false, error: `week_payments: ${payErr.message}` });

    return j(200, { ok: true, week: PLAYOFFS_FIRST_WEEK, user_name, paid });
  } catch (e) {
    return j(500, { ok: false, error: e?.message || String(e) });
  }
};

function j(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
