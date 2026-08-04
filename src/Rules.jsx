import React from "react";
import { Link } from "react-router-dom";

export default function Rules() {
  return (
    <div
      style={{
        background: "url('/background.png') center / cover no-repeat fixed",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: "100%",
          background: "rgba(255,255,255,0.93)",
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          padding: "32px 36px",
          fontFamily: "system-ui, sans-serif",
          color: "#111",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>🏈 NFL Weekly Picks Pool</h1>
            <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>Rules, Instructions & How to Play</p>
          </div>
          <Link to="/">
            <button style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              ← Back to Picks
            </button>
          </Link>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #eee", margin: "20px 0" }} />

        {/* Overview */}
        <Section title="📋 Overview">
          <p>
            Each week, participants predict the winner of every scheduled NFL game, plus a bonus
            half-point pick for which team beats the point spread on each game. The participant
            with the most total points at the end of the week wins the weekly pot. In the event of
            a tie, tiebreaker scores determine the winner.
          </p>
        </Section>

        {/* How to Submit */}
        <Section title="📝 How to Submit Your Picks">
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              Log in with your username and 4-digit PIN (create an account the first time — your
              full name is tied to your account, so it's always entered correctly).
            </li>
            <li>Enter your <b>email address</b> (used to send you a copy of your picks).</li>
            <li>
              For every game, select your predicted <b>winner</b> — and which team you think will
              <b> beat the point spread</b> (shown next to each team's name) for a bonus 0.5 points.
            </li>
            <li>Enter your <b>total points prediction</b> for all three tiebreaker games.</li>
            <li>Click <b>"Submit Picks"</b> before the deadline. You're done!</li>
          </ol>
          <Callout type="warning">
            ⚠️ Double-check everything before submitting — resubmitting to change an individual
            pick isn't currently supported, so it's best to get it right the first time.
          </Callout>
        </Section>

        {/* Deadline & Locking */}
        <Section title="⏰ Deadline & Game Locks">
          <p>There are <b>two types of locks</b> to be aware of:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <b>Weekly deadline</b> — A fixed cutoff set by the admin each week (usually before
              the first game). Once the deadline passes, the entire pick sheet is locked and no
              new submissions are accepted.
            </li>
            <li>
              <b>Individual game locks</b> — Each game (and its spread pick) automatically locks
              <b> 1 hour before kickoff</b>. If a specific game is already locked when you submit,
              you must still pick all remaining unlocked games — you cannot submit with a missing
              pick for a started game.
            </li>
          </ul>
          <Callout type="warning">
            ⚠️ Do not wait until the last minute. If the deadline passes or a game kicks off before
            you submit, your picks will not be accepted for that week.
          </Callout>
          <p style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
            Once a game locks, its column in the <b>View Picks Table</b> reveals everyone's pick
            for that game. If someone didn't submit a pick, the NFL logo shows in their spot instead.
          </p>
        </Section>

        {/* Scoring */}
        <Section title="🏆 Scoring">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><b>1 point</b> for each correctly predicted game winner.</li>
            <li><b>+0.5 bonus point</b> for each correct "beat the spread" pick.</li>
            <li><b>0 points</b> for an incorrect pick or a missed game.</li>
            <li>The participant with the <b>most points</b> at the end of the week wins.</li>
          </ul>
          <p style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            The spread is a number that levels the matchup — a team favored by "-3.5" needs to win
            by more than 3.5 points to "cover"; the underdog at "+3.5" covers by losing by less than
            that, or by winning outright. It's frozen as soon as the week's schedule is posted, so
            everyone picks against the same number no matter when they submit.
          </p>
          <p style={{ marginTop: 12 }}>
            Example: If there are 16 games and you pick 11 winners correctly plus 6 spread picks
            correctly, your score is 11 + (6 × 0.5) = <b>14</b>.
          </p>
        </Section>

        {/* Tiebreakers */}
        <Section title="🔢 Tiebreakers (Price is Right Rules)">
          <p>
            Three games each week are designated as <b>tiebreaker games</b>. For each, you predict
            the <b>total combined score</b> of both teams (e.g., if the final score is 24–17, the
            total is <b>41</b>).
          </p>
          <p style={{ marginTop: 12 }}>
            Tiebreakers are only used when two or more participants finish with the <b>same number
            of correct picks</b>. The tiebreaker winner is determined by these rules:
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 8 }}>
            <li>
              The participant whose total prediction is <b>closest to the actual combined score
              without going over</b> wins the tiebreak.
            </li>
            <li>
              If your prediction <b>exceeds</b> the actual combined score, your tiebreaker entry
              is <b>void</b> — it does not count.
            </li>
            <li>
              If all tied participants go over, the tiebreaker is a push and the pot is split.
            </li>
          </ul>
          <Callout>
            💡 Think of it like <b>The Price is Right</b> — closest without going over wins. A
            guess of 40 beats a guess of 45 if the actual total is 41, and a guess of 42 is void.
          </Callout>
          <p style={{ marginTop: 12 }}>
            Tiebreakers are evaluated in order (TB1, TB2, TB3). If TB1 does not resolve the tie,
            TB2 is checked, then TB3.
          </p>
        </Section>

        {/* Buy-in & Prize */}
        <Section title="💵 Buy-In & Weekly Prize">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Each participant pays a <b>weekly buy-in</b> to enter that week's pool.</li>
            <li>The participant with the <b>most correct picks</b> wins the entire weekly pot.</li>
            <li>Payment must be confirmed by the admin before results are finalized.</li>
            <li>Buy-in amounts and prize details are communicated by the pool organizer each week.</li>
            <li>
              Use the <b>Payment Options</b> button in the site header to pay via Venmo, Cash App,
              PayPal, or Zelle.
            </li>
          </ul>
          <Callout type="warning">
            ⚠️ If payment is not received before the deadline, the admin reserves the right to
            remove your picks for that week.
          </Callout>
        </Section>

        {/* Tips */}
        <Section title="💬 Tips for New Participants">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Submit early — don't risk missing the deadline or a game locking.</li>
            <li>For tiebreakers, go slightly under your gut feeling — going over voids your entry.</li>
            <li>Your full name is tied to your account, so it's always consistent — no more worrying about typing it differently.</li>
            <li>Check each team's win-loss record and point spread, shown right on the picks page, before making your picks.</li>
            <li>Check the <b>Live Leaderboard</b> during the week to see how you're doing as games go final.</li>
          </ul>
        </Section>

        {/* Footer */}
        <hr style={{ border: "none", borderTop: "2px solid #eee", margin: "24px 0 16px" }} />
        <p style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
          Questions? Reach out to the pool organizer. Good luck! 🏈
        </p>

        {/* Print button */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          button { display: none !important; }
          div[style*="background: url"] { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 10px", color: "#111" }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#222" }}>{children}</div>
    </div>
  );
}

function Callout({ children, type = "info" }) {
  const bg = type === "warning" ? "rgba(200,80,0,0.07)" : "rgba(0,100,200,0.07)";
  const border = type === "warning" ? "rgba(200,80,0,0.3)" : "rgba(0,100,200,0.25)";
  return (
    <div style={{
      marginTop: 12,
      padding: "10px 14px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      fontSize: 14,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}
