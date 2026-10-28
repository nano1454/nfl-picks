const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const id = String(event.queryStringParameters?.id || "").trim();
    const action = String(event.queryStringParameters?.action || "").trim();
    const amountParam = event.queryStringParameters?.amount;

    const admin = createClient(supabaseUrl, serviceKey);
    const adminInfo = await requireAdmin(admin, token);
    if (!adminInfo) return j(401, { ok: false, error: "Unauthorized." });

    if (!id) return j(400, { ok: false, error: "Missing id." });
    if (action !== "approve" && action !== "reject") return j(400, { ok: false, error: "action must be approve or reject." });

    const update = {
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminInfo.username,
    };

    // Lets the admin correct a participant's typo (e.g. self-reported $30,
    // only $20 actually came in) as part of the same approve action.
    if (amountParam !== undefined && amountParam !== "") {
      const amount = Number(amountParam);
      if (!Number.isFinite(amount) || amount < 0) return j(400, { ok: false, error: "amount must be a number >= 0." });
      update.amount = amount;
    }

    const { error: updErr } = await admin.from("preseason_deposits").update(update).eq("id", id);
    if (updErr) return j(500, { ok: false, error: updErr.message });

    return j(200, { ok: true, id, ...update });
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
