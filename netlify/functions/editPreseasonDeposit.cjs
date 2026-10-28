const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("./_adminAuth.cjs");

// Lets the admin correct a deposit's amount/note after it's already been
// approved or rejected (reviewPreseasonDeposit.cjs only touches amount as
// part of the initial approve/reject action). Service-role write, so it's
// never gated by the public RLS policies -- those only ever govern what a
// participant's own browser session can do.
exports.handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl) return j(500, { ok: false, error: "Missing SUPABASE_URL." });
    if (!serviceKey) return j(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." });

    const token = String(event.queryStringParameters?.token || "");
    const id = String(event.queryStringParameters?.id || "").trim();
    const amountParam = event.queryStringParameters?.amount;
    const noteParam = event.queryStringParameters?.note;

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await requireAdmin(admin, token))) return j(401, { ok: false, error: "Unauthorized." });
    if (!id) return j(400, { ok: false, error: "Missing id." });

    const update = {};
    if (amountParam !== undefined && amountParam !== "") {
      const amount = Number(amountParam);
      if (!Number.isFinite(amount) || amount < 0) return j(400, { ok: false, error: "amount must be a number >= 0." });
      update.amount = amount;
    }
    if (noteParam !== undefined) update.note = String(noteParam);
    if (Object.keys(update).length === 0) return j(400, { ok: false, error: "Nothing to update." });

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
