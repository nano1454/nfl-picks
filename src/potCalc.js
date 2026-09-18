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

const PLAYOFFS_BUY_IN = 40;

// Same two-tier boundary as commissionRate() above, minus the lowest (1-9)
// tier -- confirmed with Adrian: playoffs commission is 15% under 20
// participants, 20% at 20+.
function playoffsCommissionRate(n) {
  return n <= 19 ? 0.15 : 0.20;
}

// One flat $40 buy-in covers the whole playoffs (all 4 rounds), not a
// per-round charge -- so unlike calcPot() (per-week), this takes a single
// participant count for the entire playoffs roster.
export function calcPlayoffsPot(participantCount, buyIn = PLAYOFFS_BUY_IN) {
  const n = Math.max(0, Number(participantCount) || 0);
  const gross = n * buyIn;
  const commissionPct = playoffsCommissionRate(n);
  const commission = gross * commissionPct;
  const net = gross - commission;
  const pot = Math.round(net / 10) * 10;
  return { n, buyIn, gross, commissionPct, commission, net, pot };
}

// Counts active playoffs_participants -- independent of the regular-season
// `participants` roster and of any per-round pick activity, since the
// playoffs buy-in is one flat payment for the whole postseason.
// playoffs_participants has no public RLS policy (same lockdown as
// participants), so this goes through a small public Netlify function
// (service-role read) instead of a direct client-side select.
export async function countPlayoffsParticipants() {
  const res = await fetch("/.netlify/functions/getPlayoffsRoster", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data?.error || "Could not load playoffs roster");
  return (Array.isArray(data.activeParticipants) ? data.activeParticipants : []).length;
}
