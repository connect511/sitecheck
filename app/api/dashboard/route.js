import { getAdmin, getUserFromToken } from "../../lib/supabaseAdmin";
import { findMember } from "../../lib/servicesCatalog";
import { sendMail, tpl, inrFmt } from "../../lib/mailer";

export const runtime = "nodejs";

const APP = process.env.APP_BASE_URL || "https://sitecheck.digistick.in";



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

    if (action === "dedupeSites") {
      // Merge duplicate sites (same host) created before the find-or-create fix.
      const { data: all } = await admin.from("sites").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      const seen = {}; const removed = [];
      for (const s of all || []) {
        const key = s.url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
        if (seen[key]) {
          // move this duplicate's scans/reports to the kept site, then delete the dup
          const keepId = seen[key];
          await admin.from("scans").update({ site_id: keepId }).eq("site_id", s.id).eq("user_id", user.id);
          await admin.from("reports").update({ site_id: keepId }).eq("site_id", s.id).eq("user_id", user.id);
          if (s.is_pro) await admin.from("sites").update({ is_pro: true }).eq("id", keepId);
          await admin.from("sites").delete().eq("id", s.id).eq("user_id", user.id);
          removed.push(s.id);
        } else { seen[key] = s.id; }
      }
      return Response.json({ ok: true, removed: removed.length });
    }

    if (action === "addSite") {
      const { url, label } = payload || {};
      if (!url) return Response.json({ error: "URL required." }, { status: 400 });
      // Normalize so the same store isn't added twice (galloy.in == https://galloy.in/ == www.galloy.in)
      const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
      // Look for an existing site for this user that matches the normalized host.
      const { data: existing } = await admin.from("sites").select("*").eq("user_id", user.id);
      const match = (existing || []).find((s) => s.url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase() === clean);
      if (match) return Response.json({ site: match, existing: true });
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

      // find-or-create this site for the user (robust host match)
      const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
      const { data: allSites } = await admin.from("sites").select("*").eq("user_id", user.id);
      let site = (allSites || []).find((s) => s.url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase() === clean);
      if (!site) {
        const ins = await admin.from("sites").insert({ user_id: user.id, url, is_pro: true }).select().single();
        site = ins.data;
      } else {
        await admin.from("sites").update({ is_pro: true }).eq("id", site.id).eq("user_id", user.id);
      }
      if (site) await admin.from("reports").insert({ user_id: user.id, site_id: site.id, payload: report || {} });

      // Purchase confirmation email (never blocks the unlock)
      await sendMail({
        to: user.email,
        subject: "Payment received — your Growth Plan is unlocked",
        html: tpl({
          heading: "Your Growth Plan is unlocked 🎉",
          body: `Payment confirmed for <b>${clean}</b>.<br><br>You now have full Pro access: written fixes, the install-ready Shopify file, your 14-day plan, Theme Audit, App Stack, Ads Strategy, score history and the AI Growth Consultant.<br><br><b>Amount paid:</b> ₹799 &middot; Order ${orderId}`,
          ctaText: "Open my Growth Plan", ctaUrl: APP + "/dashboard",
        }),
      });
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

    if (action === "bookService") {
      const { service_key, member_id, phone, site_id } = payload || {};
      const hit = findMember(service_key, member_id);
      if (!hit) return Response.json({ error: "Invalid service selection." }, { status: 400 });
      if (!phone || String(phone).replace(/\D/g, "").length < 10) return Response.json({ error: "A valid phone number is required." }, { status: 400 });

      const appId = process.env.CASHFREE_APP_ID;
      const secret = process.env.CASHFREE_SECRET_KEY;
      if (!appId || !secret) return Response.json({ error: "Payments are not configured yet." }, { status: 503 });

      // 1) create the booking row (pending)
      const { data: booking, error: bErr } = await admin.from("service_bookings").insert({
        user_id: user.id, site_id: site_id || null,
        service_key, service_name: hit.service.name,
        member_id, member_name: hit.member.name,
        price: hit.member.price, advance_amount: hit.advance,
        phone: String(phone).trim(), status: "pending",
      }).select().single();
      if (bErr) throw bErr;

      // 2) create the Cashfree order for the 10% advance (amount fixed server-side)
      const orderId = "ds_book_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const base = process.env.APP_BASE_URL || "";
      const body = {
        order_id: orderId,
        order_amount: hit.advance,
        order_currency: "INR",
        customer_details: {
          customer_id: "cust_" + user.id.slice(0, 12),
          customer_email: user.email || "guest@digistick.in",
          customer_phone: String(phone).replace(/\D/g, "").slice(-10) || "9999999999",
        },
        order_meta: { return_url: base + "/dashboard?booking=" + booking.id + "&order_id={order_id}" },
        order_note: "Advance (10%) — " + hit.service.name + " with " + hit.member.name,
      };
      const res = await fetch(cfBase() + "/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-version": "2023-08-01", "x-client-id": appId, "x-client-secret": secret },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        await admin.from("service_bookings").delete().eq("id", booking.id);
        return Response.json({ error: data.message || "Could not start checkout." }, { status: 502 });
      }
      await admin.from("service_bookings").update({ order_id: orderId }).eq("id", booking.id);
      return Response.json({ booking_id: booking.id, orderId, paymentSessionId: data.payment_session_id, amount: hit.advance, env: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox" });
    }

    if (action === "confirmBooking") {
      const { booking_id, orderId } = payload || {};
      const { data: booking } = await admin.from("service_bookings").select("*").eq("id", booking_id).eq("user_id", user.id).single();
      if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
      if (booking.status !== "pending") return Response.json({ ok: true, booking }); // already processed
      if (booking.order_id && orderId && booking.order_id !== orderId) return Response.json({ error: "Order mismatch." }, { status: 400 });
      const paid = await verifyCashfreePaid(booking.order_id || orderId);
      if (!paid) return Response.json({ error: "Payment not verified yet. If money was deducted, it will reflect shortly — contact support otherwise." }, { status: 402 });
      const { data: updated } = await admin.from("service_bookings").update({ status: "paid" }).eq("id", booking.id).select().single();

      // Confirmation to the customer
      await sendMail({
        to: user.email,
        subject: `Booking confirmed — ${booking.service_name}`,
        html: tpl({
          heading: "Your booking is confirmed ✓",
          body: `<b>${booking.service_name}</b> with <b>${booking.member_name}</b> is locked in.<br><br>
                 <b>Advance paid:</b> ${inrFmt(booking.advance_amount)} (30%)<br>
                 <b>Total service price:</b> ${inrFmt(booking.price)}<br>
                 <b>Order:</b> ${booking.order_id}<br><br>
                 Our team will call you on <b>${booking.phone}</b> within 24 hours for the kickoff. The advance is fully adjustable against your final invoice.`,
          ctaText: "View my bookings", ctaUrl: APP + "/dashboard",
        }),
      });
      // Heads-up to the Digistick team inbox
      await sendMail({
        to: process.env.SMTP_USER,
        subject: `NEW BOOKING: ${booking.service_name} — ${user.email}`,
        html: tpl({
          heading: "New service booking",
          body: `<b>${booking.service_name}</b> with ${booking.member_name}<br>Client: ${user.email}<br>Phone: ${booking.phone}<br>Advance: ${inrFmt(booking.advance_amount)} / Total: ${inrFmt(booking.price)}<br>Order: ${booking.order_id}`,
          ctaText: "Open admin panel", ctaUrl: APP + "/admin",
        }),
      });
      return Response.json({ ok: true, booking: updated });
    }

    if (action === "myBookings") {
      const { data } = await admin.from("service_bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return Response.json({ bookings: data || [] });
    }

    if (action === "confirmTheme") {
      const { orderId } = payload || {};
      if (!orderId || !orderId.includes("_theme_")) return Response.json({ error: "Invalid order." }, { status: 400 });
      const paid = await verifyCashfreePaid(orderId);
      if (!paid) return Response.json({ error: "Payment not verified yet." }, { status: 402 });
      await sendMail({
        to: user.email,
        subject: "Payment received — your theme is ready to download",
        html: tpl({
          heading: "Your theme is ready 🎉",
          body: `Payment confirmed — <b>₹3,999</b> &middot; Order ${orderId}.<br><br>Your conversion-ready theme is unlocked. Download it from your dashboard&rsquo;s <b>Theme Audit</b> tab, then upload it in Shopify under Online Store &rarr; Themes &rarr; Add theme.`,
          ctaText: "Download my theme", ctaUrl: APP + "/dashboard",
        }),
      });
      return Response.json({ ok: true });
    }

    if (action === "getReport") {
      const { report_id } = payload || {};
      if (!report_id) return Response.json({ error: "report_id required" }, { status: 400 });
      const { data, error } = await admin.from("reports").select("payload").eq("id", report_id).eq("user_id", user.id).single();
      if (error || !data) return Response.json({ error: "Report not found." }, { status: 404 });
      return Response.json({ payload: data.payload || {} });
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
