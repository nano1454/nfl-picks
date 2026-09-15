import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Avatar from "./Avatar";
import Button from "./Button";
import { logoSrc, fmtMatchup } from "./teamLogos";
import { resolveWeekChampion } from "./tiebreakCascade";

function fmtPts(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function winnerSideOf(result) {
  if (!result || String(result.status || "").toUpperCase() !== "FINAL") return null;
  const hs = Number(result.home_score);
  const as = Number(result.away_score);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  return hs > as ? "HOME" : as > hs ? "AWAY" : "TIE";
}

export default function ChampionWeekDetail() {
  const [searchParams] = useSearchParams();
  const season = Number(searchParams.get("season"));
  const week = Number(searchParams.get("week"));

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [champ, setChamp] = useState(null); // resolveWeekChampion() result | null
  const [games, setGames] = useState([]);
  const [resultByGameId, setResultByGameId] = useState({});
  const [picksByUserGame, setPicksByUserGame] = useState({});
  const [bonusByUserGame, setBonusByUserGame] = useState({}); // { user: { gameId: { passing_yards, rushing_yards } } }
  const [guessByUser, setGuessByUser] = useState({});
  const [tbGameIds, setTbGameIds] = useState([]);
  const [runnerUp, setRunnerUp] = useState(null); // { names, points } | null
  const [usernameByFullName, setUsernameByFullName] = useState({});
  const [avatarByFullName, setAvatarByFullName] = useState({});

  const dispName = (fullName) => usernameByFullName[fullName] || fullName;

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      if (!season || !week) throw new Error("Missing season/week.");

      fetch("/.netlify/functions/getUsernames", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setUsernameByFullName(d.usernames || {});
            setAvatarByFullName(d.avatars || {});
          }
        })
        .catch(() => {});

      const [lbRes, wmRes, gRes, grRes, tbRes] = await Promise.all([
        supabase.from("leaderboard").select("user_name, week, points, correct_picks, games_final_count").eq("season", season).eq("week", week),
        supabase.from("week_meta").select("tiebreakers").eq("season", season).eq("week", week).maybeSingle(),
        supabase.from("games").select("id, away, home, kickoff").eq("season", season).eq("week", week).order("kickoff", { ascending: true }),
        supabase.from("game_results").select("game_id, status, home_score, away_score, passing_winner, rushing_winner").eq("season", season).eq("week", week),
        supabase.from("tiebreakers").select("user_name, tb_no, total, game_id").eq("week", week),
      ]);
      if (lbRes.error) throw lbRes.error;
      if (wmRes.error) throw wmRes.error;
      if (gRes.error) throw gRes.error;
      if (grRes.error) throw grRes.error;
      if (tbRes.error) throw tbRes.error;

      const weekLbRows = lbRes.data || [];
      const tbIds = Array.isArray(wmRes.data?.tiebreakers) ? wmRes.data.tiebreakers.slice(0, 3).map(String) : [];
      setTbGameIds(tbIds);
      setGames(gRes.data || []);

      const resById = {};
      for (const r of grRes.data || []) resById[String(r.game_id)] = r;
      setResultByGameId(resById);

      // Same safety check as HallOfChampions.jsx: don't declare a champion
      // until the leaderboard has actually been rescored against every one
      // of this week's games -- game_results can show every game FINAL for
      // a moment before that rescoring has run.
      const gamesTotal = (gRes.data || []).length;
      const gamesFinalCount = (grRes.data || []).filter((r) => String(r.status || "").toUpperCase() === "FINAL").length;
      const weekIsSafelyFinal =
        gamesTotal > 0 &&
        gamesFinalCount === gamesTotal &&
        weekLbRows.every((r) => Number(r.games_final_count || 0) >= gamesTotal);

      if (!weekIsSafelyFinal) {
        setChamp(null);
        setLoading(false);
        return;
      }

      // Season points through this week, for the tied group -- same
      // summation used everywhere else in this app for the accumulated total.
      const { data: seasonLbRows, error: seasonErr } = await supabase
        .from("leaderboard")
        .select("user_name, points")
        .eq("season", season)
        .lte("week", week);
      if (seasonErr) throw seasonErr;
      const seasonPointsByUser = {};
      for (const r of seasonLbRows || []) {
        seasonPointsByUser[r.user_name] = (seasonPointsByUser[r.user_name] || 0) + Number(r.points || 0);
      }

      const result = resolveWeekChampion({
        weekLeaderboardRows: weekLbRows,
        tbGameIds: tbIds,
        resultByGame: resById,
        guessRows: tbRes.data || [],
        seasonPointsByUser,
      });
      setChamp(result);

      if (!result) {
        setLoading(false);
        return;
      }

      // Runner-up: the highest points among everyone NOT in the winning group
      const others = weekLbRows.filter((r) => !result.winners.includes(r.user_name));
      if (others.length > 0) {
        const runnerUpPoints = Math.max(...others.map((r) => Number(r.points || 0)));
        const runnerUpNames = others.filter((r) => Number(r.points || 0) === runnerUpPoints).map((r) => r.user_name);
        setRunnerUp({ names: runnerUpNames, points: runnerUpPoints });
      } else {
        setRunnerUp(null);
      }

      // Champion(s)' picks for every game this week
      const { data: picksRows, error: picksErr } = await supabase
        .from("picks")
        .select("user_name, game_id, pick")
        .eq("week", week)
        .in("user_name", result.winners);
      if (picksErr) throw picksErr;
      const pByUserGame = {};
      for (const r of picksRows || []) {
        const u = String(r.user_name || "").trim();
        const gid = String(r.game_id || "").trim();
        if (!u || !gid) continue;
        (pByUserGame[u] ||= {})[gid] = String(r.pick || "").trim().toUpperCase();
      }
      setPicksByUserGame(pByUserGame);

      // Champion(s)' passing/rushing bonus picks for every game this week
      const { data: bonusRows, error: bonusErr } = await supabase
        .from("bonus_picks")
        .select("user_name, game_id, category, pick")
        .eq("week", week)
        .in("user_name", result.winners);
      if (bonusErr) throw bonusErr;
      const bByUserGame = {};
      for (const r of bonusRows || []) {
        const u = String(r.user_name || "").trim();
        const gid = String(r.game_id || "").trim();
        if (!u || !gid) continue;
        ((bByUserGame[u] ||= {})[gid] ||= {})[r.category] = String(r.pick || "").trim().toUpperCase();
      }
      setBonusByUserGame(bByUserGame);

      // Guesses for everyone in the original tied group (so the "how they
      // won" comparison can show the runner-up's guess too, not just the winner's)
      const gByUser = {};
      for (const g of tbRes.data || []) {
        const u = String(g.user_name || "").trim();
        const n = Number(g.tb_no);
        if (!u || ![1, 2, 3].includes(n)) continue;
        (gByUser[u] ||= {})[n] = g.total === null || g.total === undefined ? null : Number(g.total);
      }
      setGuessByUser(gByUser);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, week]);

  if (loading) return <div style={{ ...pageBg, color: "#fff", padding: 40, textAlign: "center" }}>Loading…</div>;
  if (err) return <div style={{ ...pageBg, color: "#ff8a8a", padding: 40, textAlign: "center" }}>{err}</div>;

  if (!champ) {
    return (
      <div style={pageBg}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
          <HeaderBar season={season} week={week} onRefresh={loadAll} />
          <div style={{ marginTop: 24, color: "#fff", textAlign: "center" }}>
            No champion has been decided for this week yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 48px" }}>
        <HeaderBar season={season} week={week} onRefresh={loadAll} />

        <div style={heroCard}>
          <div style={heroLabel}>WEEK {week} CHAMPION{champ.winners.length > 1 ? "S" : ""}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
            {champ.winners.map((u) => (
              <Avatar key={u} username={dispName(u)} avatar={avatarByFullName[u]} size={96} />
            ))}
          </div>
          <div style={championName}>{champ.winners.map(dispName).join(" & ")}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            <StatPill>{fmtPts(champ.points)} points</StatPill>
            <StatPill>{champ.correctPicksByUser?.[champ.winners[0]] ?? "—"} correct picks</StatPill>
          </div>
        </div>

        <HowTheyWon champ={champ} runnerUp={runnerUp} guessByUser={guessByUser} dispName={dispName} />

        {champ.winners.map((u) => (
          <div key={u} style={{ marginTop: 24 }}>
            <h3 style={{ color: "#fff", margin: "0 0 10px" }}>
              {champ.winners.length > 1 ? `${dispName(u)}'s Picks` : "Picks This Week"}
            </h3>

            <div style={{ display: "grid", gap: 8 }}>
              {games.map((g) => {
                const pick = picksByUserGame?.[u]?.[String(g.id)];
                const result = resultByGameId[String(g.id)];
                const winnerSide = winnerSideOf(result);
                const isFinal = winnerSide !== null;
                const correct = isFinal && pick && pick === winnerSide;
                const team = pick === "AWAY" ? g.away : pick === "HOME" ? g.home : pick === "TIE" ? "TIE" : null;
                const src = team && team !== "TIE" ? logoSrc(team) : null;

                return (
                  <div key={g.id} style={pickRow(correct)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{fmtMatchup(g)}</div>
                      {isFinal && (
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                          Final: {g.away} {result.away_score} — {g.home} {result.home_score}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {src ? (
                        <img src={src} alt={team} style={{ width: 45, height: 45, objectFit: "contain" }} />
                      ) : (
                        <span style={{ color: "#fff", fontSize: 13 }}>{team || "—"}</span>
                      )}
                      <BonusBadges bonus={bonusByUserGame?.[u]?.[String(g.id)]} game={g} result={result} />
                    </div>
                  </div>
                );
              })}
            </div>

            {tbGameIds.length === 3 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>
                  TIEBREAKER GUESSES
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {tbGameIds.map((gid, i) => {
                    const result = resultByGameId[String(gid)];
                    const isFinal = String(result?.status || "").toUpperCase() === "FINAL";
                    const actual = isFinal ? Number(result.home_score) + Number(result.away_score) : null;
                    const guess = guessByUser?.[u]?.[i + 1];
                    return (
                      <StatPill key={gid}>
                        TB{i + 1}: {guess ?? "—"}
                        {actual !== null ? ` (actual ${actual})` : ""}
                      </StatPill>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderBar({ season, week, onRefresh }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
        Season <b style={{ color: "#ffd700" }}>{season}</b> · Week <b style={{ color: "#ffd700" }}>{week}</b>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" pill onClick={onRefresh}>
          Refresh
        </Button>
        <Link to="/hall-of-champions">
          <Button variant="dark" size="sm" pill>← Back</Button>
        </Link>
      </div>
    </div>
  );
}

// Small passing/rushing bonus-pick badges next to a game's main pick --
// same visual language as Results.jsx's Picks Table (purple = passing,
// orange = rushing, green ring + checkmark if that half-point was correct).
function BonusBadges({ bonus, game, result }) {
  if (!bonus || !game) return null;

  const badge = (raw, color, label, letter, categoryWinner) => {
    const pick = String(raw || "").toUpperCase();
    const team = pick === "AWAY" ? game.away : pick === "HOME" ? game.home : null;
    if (!team) return null;
    const src = logoSrc(team);
    const correct = !!categoryWinner && pick === categoryWinner;

    return (
      <div key={label} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <span
            title={`${label}: ${team}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              border: `2px solid ${color}`,
              borderRadius: 4,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {src && <img src={src} alt={team} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
          </span>
          {correct && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#16a34a",
                color: "#fff",
                fontSize: 8,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✓
            </span>
          )}
        </span>
        <span style={{ fontSize: 8, fontWeight: 800, color, letterSpacing: 0.5, marginTop: 1 }}>{letter}</span>
      </div>
    );
  };

  const passingWinner = String(result?.passing_winner || "").toUpperCase();
  const rushingWinner = String(result?.rushing_winner || "").toUpperCase();

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {badge(bonus.passing_yards, "#7c3aed", "Passing", "P", passingWinner === "AWAY" || passingWinner === "HOME" ? passingWinner : null)}
      {badge(bonus.rushing_yards, "#ea580c", "Rushing", "R", rushingWinner === "AWAY" || rushingWinner === "HOME" ? rushingWinner : null)}
    </div>
  );
}

function HowTheyWon({ champ, runnerUp, guessByUser, dispName }) {
  let text = null;

  if (champ.decidedBy === "OUTRIGHT") {
    text = runnerUp
      ? `Won outright by ${fmtPts(champ.points - runnerUp.points)} point${champ.points - runnerUp.points === 1 ? "" : "s"} over ${runnerUp.names.map(dispName).join(", ")}.`
      : "Won outright — the only participant that week.";
  } else if (/^TB\d$/.test(champ.decidedBy || "")) {
    const tbNo = Number(champ.decidedBy.slice(2));
    const round = (champ.perTB || []).find((t) => t.tbNo === tbNo);
    const champRow = round?.rows?.find((r) => champ.winners.includes(r.user_name));
    const runnerUpRow = round?.rows
      ?.filter((r) => !champ.winners.includes(r.user_name) && r.eligible)
      .sort((a, b) => a.diff - b.diff)[0];
    if (round && champRow) {
      text = `Tied on points — decided by Tiebreaker ${tbNo}. Guessed ${champRow.guess} (actual ${round.actual}, off by ${champRow.diff}).`;
      if (runnerUpRow) {
        text += ` Closest other guess was ${dispName(runnerUpRow.user_name)} at ${runnerUpRow.guess} (off by ${runnerUpRow.diff}).`;
      }
    } else {
      text = `Tied on points — decided by Tiebreaker ${tbNo}.`;
    }
  } else if (champ.decidedBy === "SEASON_POINTS") {
    text = `Tied on points and all 3 tiebreakers — decided by season total points among the tied group.`;
  } else if (champ.decidedBy === "SPLIT") {
    text = `Still tied after points, all 3 tiebreakers, and season points — declared co-champions.`;
  }

  if (!text) return null;

  return (
    <div style={howWonBox}>
      <div style={{ color: "#ffd700", fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 4 }}>HOW THEY WON</div>
      <div style={{ color: "#fff", fontSize: 14 }}>{text}</div>
    </div>
  );
}

function StatPill({ children }) {
  return <span style={statPill}>{children}</span>;
}

/* ---------- Styles (dark/gold theme, matching HallOfChampions.jsx) ---------- */

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
  marginTop: 18,
  border: "1px solid rgba(255,215,0,0.35)",
  borderRadius: 20,
  padding: "28px 18px",
  textAlign: "center",
  background: "linear-gradient(180deg, rgba(255,215,0,0.06) 0%, rgba(0,0,0,0) 60%)",
};

const heroLabel = {
  ...goldText,
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 2,
};

const championName = {
  ...goldText,
  fontWeight: 900,
  fontSize: "clamp(22px, 4.5vw, 32px)",
  marginTop: 8,
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

const howWonBox = {
  marginTop: 16,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.03)",
};

function pickRow(correct) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: correct ? "1px solid rgba(22,163,74,0.5)" : "1px solid rgba(255,255,255,0.08)",
    background: correct ? "rgba(22,163,74,0.12)" : "rgba(255,255,255,0.03)",
  };
}

