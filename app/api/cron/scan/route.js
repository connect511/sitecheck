import { getAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json). Re-scans sites whose schedule is due,
// saves the new scan, and emails an alert if the overall score dropped.
// Protected by CRON_SECRET so only Vercel can trigger it.

function dueForScan(site) {
  if (!site.is_pro || site.scan_freq === "off" || !site.scan_freq) return false;
  if (!site.last_auto_scan) return true;
  const last = new Date(site.last_auto_scan).getTime();
  const days = (Date.now() - last) / 86400000;
  return site.scan_freq === "weekly" ? days >= 7 : days >= 30;
}

function avg(s) {
  if (!s) return null;
  const v = ["performance", "seo", "accessibility", "bestPractices"].map((k) => s[k]).filter((x) => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

async function sendAlert(email, site, oldScore, newScore) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !email) return;
  const from = process.env.ALERT_FROM_EMAIL || "SiteCheck <alerts@digistick.in>";
  const drop = oldScore - newScore;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      from, to: email,
      subject: `⚠ ${site.url} health dropped ${drop} points`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#dc2626">Your store's health score dropped</h2>
        <p><b>${site.url}</b> fell from <b>${oldScore}</b> to <b>${newScore}</b> (−${drop}).</p>
        <p>Log in to your SiteCheck dashboard to see what changed and how to fix it.</p>
        <p><a href="https://sitecheck.digistick.in/dashboard" style="background:#2563eb;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block">Open dashboard</a></p>
        <p style="color:#888;font-size:12px">SiteCheck by Digistick</p></div>`,
    }),
  }).catch(() => {});
}

async function runAudit(url, origin) {
  const res = await fetch(origin + "/api/audit", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
  });
  return res.ok ? res.json() : null;
}

export async function GET(req) {
  // auth: require the cron secret
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== "Bearer " + process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = getAdmin();
  if (!admin) return Response.json({ error: "DB not configured" }, { status: 503 });

  const origin = process.env.APP_BASE_URL || new URL(req.url).origin;
  const { data: sites } = await admin.from("sites").select("*");
  const due = (sites || []).filter(dueForScan);
  let scanned = 0, alerted = 0;

  for (const site of due) {
    const d = await runAudit(site.url, origin);
    if (!d) continue;
    const scores = d.pagespeed?.scores; const overall = avg(scores);
    await admin.from("scans").insert({ user_id: site.user_id, site_id: site.id, scores, checks: d.seo?.checks, overall });
    await admin.from("sites").update({ last_auto_scan: new Date().toISOString() }).eq("id", site.id);
    scanned++;

    // compare to previous scan for drop alert
    if (site.alerts_on) {
      const { data: prevScans } = await admin.from("scans").select("overall,created_at").eq("site_id", site.id).order("created_at", { ascending: false }).limit(2);
      if (prevScans && prevScans.length >= 2) {
        const newest = prevScans[0].overall, prev = prevScans[1].overall;
        if (prev != null && newest != null && newest < prev - 3) { // 3+ point drop
          await sendAlert(site.alert_email || null, site, prev, newest);
          alerted++;
        }
      }
    }
  }
  return Response.json({ ok: true, due: due.length, scanned, alerted });
}
