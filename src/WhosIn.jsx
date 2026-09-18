import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Button from "./Button";
import BouncingRoster from "./BouncingRoster";
import { calcPot, countPickParticipants, calcPlayoffsPot, countPlayoffsParticipants } from "./potCalc";
import { isPlayoffWeek, PLAYOFFS_FIRST_WEEK } from "./playoffsConfig";

export default function WhosIn() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [week, setWeek] = useState(null);
  const [people, setPeople] = useState([]);
  const [potInfo, setPotInfo] = useState(null);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/.netlify/functions/getweek", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || "Could not load week");

      const season = Number(data.season);
      const weekNum = Number(data.week);
      setWeek(weekNum);

      const playoffs = isPlayoffWeek(weekNum);

      // Playoffs is a sticky, cumulative roster: once someone's picked
      // anything in any playoff round, they stay listed through week 22 --
      // unlike the regular season, which is scoped to just the current
      // week. So games/picks below span every playoff round played so far
      // (weeks 19..weekNum) instead of just weekNum, and the active roster
      // comes from the independent playoffs_participants table instead of
      // the regular-season roster getweek.cjs returns.
      let activeParticipants;
      if (playoffs) {
        // playoffs_participants has no public RLS policy (same lockdown as
        // participants), so this goes through a small public function
        // (service-role read) instead of a direct client-side select.
        const ppRes = await fetch("/.netlify/functions/getPlayoffsRoster", { cache: "no-store" });
        const ppData = await ppRes.json();
        if (!ppRes.ok || !ppData.ok) throw new Error(ppData?.error || "Could not load playoffs roster");
        activeParticipants = Array.isArray(ppData.activeParticipants) ? ppData.activeParticipants : [];
      } else {
        activeParticipants = Array.isArray(data.activeParticipants) ? data.activeParticipants : [];
      }

      const gamesQuery = supabase.from("games").select("id").eq("season", season);
      const { data: games, error: gErr } = playoffs
        ? await gamesQuery.gte("week", PLAYOFFS_FIRST_WEEK).lte("week", weekNum)
        : await gamesQuery.eq("week", weekNum);
      if (gErr) throw gErr;
      const gameIds = new Set((games || []).map((g) => String(g.id)));
      const gameCount = gameIds.size;

      let picks = [];
      {
        const picksQuery = supabase.from("picks").select("user_name, game_id").eq("season", season);
        const q1 = playoffs
          ? await picksQuery.gte("week", PLAYOFFS_FIRST_WEEK).lte("week", weekNum)
          : await picksQuery.eq("week", weekNum);
        if (!q1.error) {
          picks = q1.data || [];
        } else {
          const picksFallback = supabase.from("picks").select("user_name, game_id");
          const q2 = playoffs
            ? await picksFallback.gte("week", PLAYOFFS_FIRST_WEEK).lte("week", weekNum)
            : await picksFallback.eq("week", weekNum);
          if (q2.error) throw q2.error;
          picks = q2.data || [];
        }
      }

      // Per-user pick tallies. "Who's In" means at least one pick made this
      // week (participants pick game-by-game up until each game's own
      // kickoff, so requiring full completion excluded anyone still mid-week).
      const picksByUser = {};
      for (const p of picks) {
        const name = String(p.user_name || "").trim();
        const gid = String(p.game_id || "");
        if (!name || !gameIds.has(gid)) continue;
        (picksByUser[name] ||= new Set()).add(gid);
      }

      const fullNames = activeParticipants.map((n) => String(n || "").trim()).filter(Boolean);

      const submittedNames = gameCount === 0 ? [] : fullNames.filter((name) => (picksByUser[name]?.size || 0) >= 1);

      const uRes = await fetch("/.netlify/functions/getUsernames", { cache: "no-store" });
      const uData = await uRes.json().catch(() => ({}));
      const usernames = uData?.ok ? uData.usernames || {} : {};
      const avatars = uData?.ok ? uData.avatars || {} : {};

      setPeople(
        submittedNames.map((fullName) => ({
          key: fullName,
          username: usernames[fullName] || fullName,
          avatar: avatars[fullName] || null,
        }))
      );

      if (playoffs) {
        const n = await countPlayoffsParticipants();
        setPotInfo(calcPlayoffsPot(n));
      } else {
        const n = await countPickParticipants(season, weekNum);
        setPotInfo(calcPot(n));
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

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(/who_is_in_bg.jpg) center center / cover no-repeat, linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 55%, #000 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", flexWrap: "wrap", gap: 8, zIndex: 20 }}>
        <Link to="/">
          <Button variant="secondary" size="sm" pill>← Back</Button>
        </Link>
        <Button variant="secondary" size="sm" pill onClick={loadAll} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10,
          pointerEvents: "none",
          padding: "0 12px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(24px, 5vw, 40px)",
            fontWeight: 900,
            letterSpacing: 0.5,
            background: "linear-gradient(180deg, #fff7d6 0%, #ffd700 45%, #b8860b 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            textShadow: "0 2px 14px rgba(0,0,0,0.5)",
          }}
        >
          Who's In for Week {week ?? "…"}
        </h1>
        {potInfo && (
          <div style={{ marginTop: 6, color: "#fff", fontSize: 18, fontWeight: 800, textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
            🏆 {isPlayoffWeek(week) ? "Playoffs' Pot" : "This week's pot"}: ${potInfo.pot.toFixed(2)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {loading ? (
          <div style={{ color: "#fff", textAlign: "center", paddingTop: 140 }}>Loading…</div>
        ) : err ? (
          <div style={{ color: "#ff8a8a", textAlign: "center", paddingTop: 140, padding: "140px 16px 0" }}>{err}</div>
        ) : people.length === 0 ? (
          <div style={{ color: "#fff", textAlign: "center", paddingTop: 150, fontSize: 16 }}>
            No one's made a pick yet this week — check back soon!
          </div>
        ) : (
          <BouncingRoster people={people} />
        )}
      </div>
    </div>
  );
}
