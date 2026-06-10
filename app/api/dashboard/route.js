import { getAdmin, getUserFromToken } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";

function cfBase() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

// Server-side check that a Cashfree order is genuinely PAID before unlocking Pro.
async function verifyCashfreePaid(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) return false; // payments not configured → cannot verify → do not unlock
  try {
    const res = await fetch(cfBase() + "/orders/" + encodeURIComponent(orderId), {
      headers: { "x-api-version": "2023-08-01", "x-client-id": appId, "x-client-secret": secret },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.order_status === "PAID";
  } catch { return false; }
}

function avg(scores) {
  if (!scores) return null;
  const vals = ["performance", "seo", "accessibility", "bestPractices"].map((k) => scores[k]).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export async function POST(req) {
  const admin = getAdmin();
  if (!admin) return Response.json({ error: "Dashboard backend not configured." }, { status: 503 });

  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { action, payload } = await req.json();

  try {
    if (action === "list") {
      const { data: sites } = await admin.from("sites").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      const siteIds = (sites || []).map((s) => s.id);
      let scans = [], reports = [];
      if (siteIds.length) {
        const { data: sc } = await admin.from("scans").select("*").in("site_id", siteIds).order("created_at", { ascending: false });
        scans = sc || [];
        const { data: rp } = await admin.from("reports").select("id,site_id,created_at").in("site_id", siteIds).order("created_at", { ascending: false });
        reports = rp || [];
      }
      return Response.json({ sites: sites || [], scans, reports });
    }

    if (action === "saveSettings") {
      const { site_id, scan_freq, alerts_on } = payload || {};
      const patch = {};
      if (scan_freq !== undefined) patch.scan_freq = scan_freq;
      if (alerts_on !== undefined) patch.alerts_on = alerts_on;
      if (alerts_on) patch.alert_email = user.email;
      await admin.from("sites").update(patch).eq("id", site_id).eq("user_id", user.id);
      return Response.json({ ok: true });
    }

    if (action === "removeSite") {
      const { site_id } = payload || {};
      await admin.from("sites").delete().eq("id", site_id).eq("user_id", user.id);
      return Response.json({ ok: true });
    }

    if (action === "addSite") {
      const { url, label } = payload || {};
      if (!url) return Response.json({ error: "URL required." }, { status: 400 });
      const { data, error } = await admin.from("sites").insert({ user_id: user.id, url, label: label || null }).select().single();
      if (error) throw error;
      return Response.json({ site: data });
    }

    if (action === "unlockPro") {
      const { url, report, orderId } = payload || {};
      if (!url || !orderId) return Response.json({ error: "Missing url or order." }, { status: 400 });

      // SECURITY: verify the payment really succeeded with Cashfree before unlocking.
      const ok = await verifyCashfreePaid(orderId);
      if (!ok) return Response.json({ error: "Payment not verified." }, { status: 402 });

      // find-or-create this site for the user
      const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      let { data: site } = await admin.from("sites").select("*").eq("user_id", user.id).ilike("url", "%" + clean + "%").maybeSingle();
      if (!site) {
        const ins = await admin.from("sites").insert({ user_id: user.id, url, is_pro: true }).select().single();
        site = ins.data;
      } else {
        await admin.from("sites").update({ is_pro: true }).eq("id", site.id).eq("user_id", user.id);
      }
      if (site) await admin.from("reports").insert({ user_id: user.id, site_id: site.id, payload: report || {} });
      return Response.json({ ok: true, pro: true });
    }

    if (action === "saveScan") {
      const { site_id, scores, checks } = payload || {};
      const { data, error } = await admin.from("scans").insert({
        user_id: user.id, site_id, scores, checks, overall: avg(scores),
      }).select().single();
      if (error) throw error;
      return Response.json({ scan: data });
    }

    if (action === "saveReport") {
      const { site_id, report } = payload || {};
      // mark the site pro and save the report
      if (site_id) await admin.from("sites").update({ is_pro: true }).eq("id", site_id).eq("user_id", user.id);
      const { data, error } = await admin.from("reports").insert({ user_id: user.id, site_id: site_id || null, payload: report }).select().single();
      if (error) throw error;
      return Response.json({ report: data });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e.message || e).slice(0, 200) }, { status: 500 });
  }
}
