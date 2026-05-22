import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  try {
    const url = new URL(req.url);

    const pin = String(url.searchParams.get("pin") || "");
    const season = Number(url.searchParams.get("season") || "");
    const week = Number(url.searchParams.get("week") || "");
    const days = Number(url.searchParams.get("days") || "30");

    if (!process.env.ADMIN_PIN) return json(500, { ok: false, error: "Missing ADMIN_PIN." });
    if (pin !== String(process.env.ADMIN_PIN)) return json(401, { ok: false, error: "Unauthorized (bad pin)." });

    if (!season || !week) return json(400, { ok: false, error: "Missing season/week." });

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Load games for that season/week
    const { data: games, error } = await admin
      .from("games")
      .select("id,kickoff")
      .eq("season", season)
      .eq("week", week);

    if (error) throw error;
    if (!games?.length) return json(404, { ok: false, error: "No games found to shift." });

    const ms = days * 24 * 60 * 60 * 1000;

    // Update each game (UPDATE, not UPSERT)
    let shifted = 0;
    for (const g of games) {
      const nextKickoff = g.kickoff
        ? new Date(new Date(g.kickoff).getTime() + ms).toISOString()
        : new Date(Date.now() + ms).toISOString();

      const { error: upErr } = await admin
        .from("games")
        .update({ kickoff: nextKickoff })
        .eq("id", g.id);

      if (upErr) throw upErr;
      shifted++;
    }

    return json(200, { ok: true, season, week, shifted, days });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
