import { supabase } from "./supabaseClient";

const BUY_IN = 20;

// Tiers: 1-9 participants = 10%, 10-19 = 15%, 20+ = 20%.
function commissionRate(n) {
  if (n <= 9) return 0.10;
  if (n <= 19) return 0.15;
  return 0.20;
}

export function calcPot(participantCount, buyIn = BUY_IN) {
  const n = Math.max(0, Number(participantCount) || 0);
  const gross = n * buyIn;
  const commissionPct = commissionRate(n);
  const commission = gross * commissionPct;
  const net = gross - commission;
  const pot = Math.round(net / 10) * 10;
  return { n, buyIn, gross, commissionPct, commission, net, pot };
}

// Counts distinct participants who saved at least one pick for a
// season/week (same try-season-then-fallback pattern already used
// elsewhere for the picks table, in case it's missing the column).
export async function countPickParticipants(season, week) {
  let rows = [];
  const q1 = await supabase.from("picks").select("user_name").eq("season", season).eq("week", week);
  if (!q1.error) {
    rows = q1.data || [];
  } else {
    const q2 = await supabase.from("picks").select("user_name").eq("week", week);
    if (q2.error) throw q2.error;
    rows = q2.data || [];
  }
  const names = new Set(rows.map((r) => String(r.user_name || "").trim()).filter(Boolean));
  return names.size;
}
