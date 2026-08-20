const SITE_URL = process.env.URL || "https://nflpicks.netlify.app";

// Best-effort email send via Resend's plain REST API (no SDK dependency).
// Never throws -- a missing/invalid RESEND_API_KEY or a failed send just
// logs and returns, so callers can fire-and-forget without risking the
// actual request they're handling.
async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!apiKey || recipients.length === 0) {
    console.log(`Skipping email "${subject}" (no RESEND_API_KEY or no recipients).`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NFL Weekly Picks <onboarding@resend.dev>",
        to: recipients,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Resend send failed (${res.status}): ${body}`);
    }
  } catch (e) {
    console.error("Resend send threw:", e?.message || e);
  }
}

exports.sendEmail = sendEmail;
exports.SITE_URL = SITE_URL;
