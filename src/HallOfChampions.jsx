import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Avatar from "./Avatar";
import Button from "./Button";
import { resolveWeekChampion } from "./tiebreakCascade";

const TOTAL_WEEKS = 18;

/** NFL season helper (Jan–Jul should usually be previous season) */
function getDefaultNflSeasonYear() {
  const d = new Date();
  const m = d.getMonth(); // 0=Jan
  const y = d.getFullYear();
  return m < 7 ? y - 1 : y;
}

function fmtPts(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Passing/rushing bonus picks aren't tracked as their own count anywhere --
// but each is worth exactly 0.5 points and correct_picks only ever counts
// main (straight-up) picks, so the bonus-correct count is fully derivable
// from the same two leaderboard fields the other two stat pills already use.
function correctBonusPicks(points, correctStraightPicks) {
  const bonusPoints = Number(points || 0) - Number(correctStraightPicks || 0);
  return Math.max(0, Math.round(bonusPoints / 0.5));
}

// Only meaningful when decidedBy is "TBn" -- names the round and the
// champion's winning guess vs. the actual combined score.
function tbBadgeText(champ) {
  if (!champ?.decidedBy || !/^TB\d$/.test(champ.decidedBy)) return null;
  const tbNo = Number(champ.decidedBy.slice(2));
  const round = (champ.perTB || []).find((t) => t.tbNo === tbNo);
  const row = round?.rows?.find((r) => champ.winners.includes(r.user_name));
  if (!round || !row || row.guess == null) return null;
  return `Decided by TB${tbNo} · guessed ${row.guess} (actual ${round.actual})`;
}

export default function HallOfChampions() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [season, setSeason] = useState(null);
  const [weekStatus, setWeekStatus] = useState({}); // week -> { status, gamesFinal, gamesTotal }
  const [champByWeek, setChampByWeek] = useState({}); // week -> resolveWeekChampion() result
  const [seasonChampion, setSeasonChampion] = useState(null); // { winners, total, correctPicksByUser } | null
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});

  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const s = getDefaultNflSeasonYear();
      setSeason(s);

      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setUsernameByFullName(d.usernames || {});
            setAvatarByFullName(d.avatars || {});
          }
        })
        .catch(() => {});

      // Which weeks exist and are fully FINAL -- same status computation
      // already used by History.jsx, reused here rather than re-derived.
      const histRes = await fetch(`/.netlify/functions/getSeasonHistory?season=${s}`, { cache: "no-store" });
      const hist = await histRes.json();
      if (!histRes.ok || !hist.ok) throw new Error(hist?.error || "Could not load season history.");
      const statusByWeek = {};
      for (const w of hist.weeks || []) statusByWeek[w.week] = w;
      setWeekStatus(statusByWeek);

      const weekNums = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

      // Everything needed to resolve every week's champion, in one batched
      // round trip per table rather than per-week queries.
      const [lbRes, wmRes, grRes, tbRes] = await Promise.all([
        supabase.from("leaderboard").select("user_name, week, points, correct_picks, games_final_count").eq("season", s),
        supabase.from("week_meta").select("week, tiebreakers").eq("season", s),
        supabase.from("game_results").select("game_id, week, status, home_score, away_score").eq("season", s),
        supabase.from("tiebreakers").select("user_name, week, tb_no, total, game_id").in("week", weekNums),
      ]);
      if (lbRes.error) throw lbRes.error;
      if (wmRes.error) throw wmRes.error;
      if (grRes.error) throw grRes.error;
      if (tbRes.error) throw tbRes.error;

      const lbRows = lbRes.data || [];
      const tbGameIdsByWeek = {};
      for (const w of wmRes.data || []) {
        tbGameIdsByWeek[w.week] = Array.isArray(w.tiebreakers) ? w.tiebreakers.slice(0, 3).map(String) : [];
      }
      const resultByGameId = {};
      for (const r of grRes.data || []) resultByGameId[String(r.game_id)] = r;

      const lbByWeek = {};
      for (const r of lbRows) (lbByWeek[r.week] ||= []).push(r);

      // Sum of leaderboard.points per user for weeks 1..week (inclusive) --
      // same accumulation this app already uses on WeekSummary.jsx.
      const seasonPointsThrough = (week) => {
        const totals = {};
        for (const r of lbRows) {
          if (r.week > week) continue;
          totals[r.user_name] = (totals[r.user_name] || 0) + Number(r.points || 0);
        }
        return totals;
      };

      const champs = {};
      for (const week of weekNums) {
        const st = statusByWeek[week];
        if (st?.status !== "final") continue; // not decided yet
        const weekRows = lbByWeek[week] || [];
        if (weekRows.length === 0) continue;

        // Extra safety margin beyond game_results alone: game_results can
        // show every game FINAL for a moment before the leaderboard has
        // actually been rescored against all of them (the scoring pipeline
        // runs on a delay / a manual click) -- games_final_count is written
        // by that same scoring pass, so if it hasn't caught up to this
        // week's real game count yet, treat the week as not-yet-decided
        // rather than risk crowning a champion off a stale partial score.
        const leaderboardCaughtUp = weekRows.every((r) => Number(r.games_final_count || 0) >= st.gamesTotal);
        if (!leaderboardCaughtUp) continue;

        const result = resolveWeekChampion({
          weekLeaderboardRows: weekRows,
          tbGameIds: tbGameIdsByWeek[week] || [],
          resultByGame: resultByGameId,
          guessRows: (tbRes.data || []).filter((g) => g.week === week),
          seasonPointsByUser: seasonPointsThrough(week),
        });
        if (result) champs[week] = result;
      }
      setChampByWeek(champs);

      // Every week must have actually resolved a champion (game_results
      // final AND leaderboard caught up, per the check above) -- not just
      // nominally "final" -- before the season is safe to declare decided.
      const allWeeksDecided = weekNums.every((w) => champs[w]);
      if (allWeeksDecided) {
        const totals = seasonPointsThrough(TOTAL_WEEKS);
        const names = Object.keys(totals);
        if (names.length > 0) {
          const maxTotal = Math.max(...names.map((n) => totals[n]));
          const winners = names.filter((n) => totals[n] === maxTotal);
          const correctPicksByUser = {};
          for (const r of lbRows) correctPicksByUser[r.user_name] = (correctPicksByUser[r.user_name] || 0) + Number(r.correct_picks || 0);
          setSeasonChampion({ winners, total: maxTotal, correctPicksByUser });
        } else {
          setSeasonChampion(null);
        }
      } else {
        setSeasonChampion(null);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroWeek = useMemo(() => {
    const weeks = Object.keys(champByWeek)
      .map(Number)
      .sort((a, b) => b - a);
    return weeks[0] ?? null;
  }, [champByWeek]);
  const hero = heroWeek != null ? champByWeek[heroWeek] : null;

  if (loading) return <div style={{ ...pageBg, color: "#fff", padding: 40, textAlign: "center" }}>Loading…</div>;
  if (err) return <div style={{ ...pageBg, color: "#ff8a8a", padding: 40, textAlign: "center" }}>{err}</div>;

  return (
    <div style={pageBg}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#fff" }}>🏆 Hall of Champions</h1>
            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.6)" }}>
              Season <b style={{ color: "#ffd700" }}>{season}</b> — every week creates a legend
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" pill onClick={loadAll}>
              Refresh
            </Button>
            <Link to="/">
              <Button variant="dark" size="sm" pill>← Back</Button>
            </Link>
          </div>
        </div>

        {/* ---------- Hero: newest champion ---------- */}
        <div style={heroCard}>
          {hero ? (
            <>
              <div style={heroLabel}>★ NEWEST CHAMPION · WEEK {heroWeek}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
                {hero.winners.map((u) => (
                  <Avatar key={u} username={dispName(u)} avatar={avatarByFullName[u]} size={110} />
                ))}
              </div>
              <div style={championName}>{hero.winners.map(dispName).join(" & ")}</div>
              {hero.winners.length > 1 && <div style={coChampionsNote}>🤝 Co-Champions</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
                <StatPill>{fmtPts(hero.points)} points</StatPill>
                <StatPill>{hero.correctPicksByUser?.[hero.winners[0]] ?? "—"} correct straight picks</StatPill>
                <StatPill>{correctBonusPicks(hero.points, hero.correctPicksByUser?.[hero.winners[0]])} correct P/R picks</StatPill>
                {tbBadgeText(hero) && <StatPill>{tbBadgeText(hero)}</StatPill>}
              </div>
              <div style={{ marginTop: 18 }}>
                <Link to={`/champion-week?season=${season}&week=${heroWeek}`}>
                  <Button variant="secondary" size="sm" pill>View Winning Week →</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={heroLabel}>★ HALL OF CHAMPIONS</div>
              <div style={{ ...championName, fontSize: "clamp(20px, 4vw, 30px)" }}>No champion crowned yet</div>
              <div style={{ color: "rgba(255,255,255,0.55)", marginTop: 8 }}>
                Check back once Week 1's games are all final.
              </div>
            </>
          )}
        </div>

        {/* ---------- Season Champion (only once all 18 weeks are final) ---------- */}
        {seasonChampion && (
          <div style={seasonCard}>
            <div style={heroLabel}>👑 {season} SEASON CHAMPION{seasonChampion.winners.length > 1 ? "S" : ""}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
              {seasonChampion.winners.map((u) => (
                <Avatar key={u} username={dispName(u)} avatar={avatarByFullName[u]} size={130} />
              ))}
            </div>
            <div style={{ ...championName, fontSize: "clamp(26px, 5vw, 40px)" }}>
              {seasonChampion.winners.map(dispName).join(" & ")}
            </div>
            {seasonChampion.winners.length > 1 && <div style={coChampionsNote}>🤝 Co-Champions — season ended in a tie</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
              <StatPill>{fmtPts(seasonChampion.total)} season points</StatPill>
              <StatPill>{seasonChampion.correctPicksByUser?.[seasonChampion.winners[0]] ?? "—"} correct straight picks all season</StatPill>
              <StatPill>{correctBonusPicks(seasonChampion.total, seasonChampion.correctPicksByUser?.[seasonChampion.winners[0]])} correct P/R picks all season</StatPill>
            </div>
          </div>
        )}

        {/* ---------- Champions Gallery ---------- */}
        <div style={{ marginTop: 36, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, color: "#fff", fontWeight: 800 }}>Champions Gallery</h2>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {season} Regular Season · {TOTAL_WEEKS} Weeks
          </div>
        </div>

        <div style={galleryGrid}>
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
            const champ = champByWeek[week];
            if (champ) {
              return (
                <Link key={week} to={`/champion-week?season=${season}&week=${week}`} style={{ textDecoration: "none" }}>
                  <div style={galleryCardDecided}>
                    <div style={weekLabelGold}>WEEK {week}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {champ.winners.map((u) => (
                        <Avatar key={u} username={dispName(u)} avatar={avatarByFullName[u]} size={56} />
                      ))}
                    </div>
                    <div style={galleryChampName}>{champ.winners.map(dispName).join(" & ")}</div>
                    <div style={{ color: "#ffd700", fontWeight: 700, marginTop: 2 }}>{fmtPts(champ.points)} points</div>
                  </div>
                </Link>
              );
            }
            return (
              <div key={week} style={galleryCardLocked}>
                <div style={weekLabelDim}>WEEK {week}</div>
                <div style={{ fontSize: 26, marginTop: 10, opacity: 0.5 }}>🔒</div>
                <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Awaiting champion</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatPill({ children }) {
  return <span style={statPill}>{children}</span>;
}

/* ---------- Styles (dark/gold theme, matching WhosIn.jsx's established look) ---------- */

const pageBg = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 55%, #000 100%)",
  fontFamily: "system-ui",
};

const goldText = {
  background: "linear-gradient(180deg, #fff7d6 0%, #ffd700 45%, #b8860b 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

const heroCard = {
  marginTop: 22,
  border: "1px solid rgba(255,215,0,0.35)",
  borderRadius: 20,
  padding: "32px 20px",
  textAlign: "center",
  background: "linear-gradient(180deg, rgba(255,215,0,0.06) 0%, rgba(0,0,0,0) 60%)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
};

const seasonCard = {
  ...heroCard,
  marginTop: 20,
  border: "1px solid rgba(255,215,0,0.55)",
  background: "linear-gradient(180deg, rgba(255,215,0,0.12) 0%, rgba(0,0,0,0) 65%)",
};

const heroLabel = {
  ...goldText,
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 2,
};

const championName = {
  ...goldText,
  fontWeight: 900,
  fontSize: "clamp(24px, 5vw, 38px)",
  marginTop: 8,
};

const coChampionsNote = {
  marginTop: 6,
  color: "#ffd700",
  fontWeight: 700,
  fontSize: 13,
};

const statPill = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
};

const galleryGrid = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 14,
};

const galleryCardBase = {
  borderRadius: 16,
  padding: "18px 12px",
  textAlign: "center",
};

const galleryCardDecided = {
  ...galleryCardBase,
  border: "1px solid rgba(255,215,0,0.4)",
  background: "linear-gradient(180deg, rgba(255,215,0,0.08) 0%, rgba(255,255,255,0.02) 100%)",
  cursor: "pointer",
};

const galleryCardLocked = {
  ...galleryCardBase,
  border: "1px dashed rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.02)",
};

const weekLabelGold = {
  ...goldText,
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 1.5,
};

const weekLabelDim = {
  color: "rgba(255,255,255,0.35)",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 1.5,
};

const galleryChampName = {
  color: "#fff",
  fontWeight: 800,
  marginTop: 8,
  fontSize: 14,
};
