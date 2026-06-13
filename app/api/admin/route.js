import { getAdmin, getUserFromToken } from "../../lib/supabaseAdmin";
import { sendMail, tpl } from "../../lib/mailer";

export const runtime = "nodejs";

/*
  Admin panel API — gated by the ADMIN_EMAILS env var (comma-separated).
  Example in Vercel:  ADMIN_EMAILS=you@digistick.in,team@digistick.in
  The caller must be a normally signed-in Supabase user whose email is on that list.
  All reads use the service-role client, so admins see across every account.
*/

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

function avg(scores) {
  if (!scores) return null;
  const vals = ["performance", "seo", "accessibility", "bestPractices"].map((k) => scores[k]).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

async function listAllUsers(admin) {
  // Paginate through auth users (1000/page covers v1 comfortably; loops if you grow past it).
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
    if (page > 10) break; // hard stop at 10k users — revisit pagination then
  }
  return users;
}

export async function POST(req) {
  const admin = getAdmin();
  if (!admin) return Response.json({ error: "Backend not configured." }, { status: 503 });

  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!isAdminEmail(user.email)) return Response.json({ error: "Not authorized." }, { status: 403 });

  const { action, payload } = await req.json();

  try {
    /* ---- Combined dashboard load: users fetched ONCE, powers clients + bookings + inbox ---- */
    if (action === "overview" || action === "loadAll") {
      const [users, sitesQ, scansQ, reportsQ, msgsQ, bookingsQ] = await Promise.all([
        listAllUsers(admin),
        admin.from("sites").select("*").order("created_at", { ascending: false }),
        admin.from("scans").select("id,site_id,user_id,overall,created_at").order("created_at", { ascending: false }).limit(2000),
        admin.from("reports").select("id,user_id,site_id,created_at"),
        admin.from("admin_messages").select("*").order("created_at", { ascending: true }).limit(2000),
        admin.from("service_bookings").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      const sites = sitesQ.data || [];
      const scans = scansQ.data || [];
      const reports = reportsQ.data || [];
      const msgs = msgsQ.data || [];
      const emailOf = Object.fromEntries(users.map((u) => [u.id, u.email]));

      const weekAgo = Date.now() - 7 * 864e5;
      const proSites = sites.filter((s) => s.is_pro);

      const clients = users
        .map((u) => {
          const uSites = sites.filter((s) => s.user_id === u.id);
          const uScans = scans.filter((s) => s.user_id === u.id);
          const latest = uScans[0];
          const lastActivity = latest?.created_at || u.last_sign_in_at || u.created_at;
          return {
            id: u.id,
            email: u.email,
            phone: u.user_metadata?.phone || u.phone || u.user_metadata?.phone_number || null,
            name: u.user_metadata?.name || u.user_metadata?.full_name || null,
            created_at: u.created_at,
            last_activity: lastActivity,
            verified: !!u.email_confirmed_at,
            sites: uSites.map((s) => ({ id: s.id, url: s.url, is_pro: s.is_pro, lead_status: s.lead_status || "new", latest_score: scans.find((x) => x.site_id === s.id)?.overall ?? null })),
            scans: uScans.length,
            is_pro: uSites.some((s) => s.is_pro),
            messages: msgs.filter((m) => m.user_id === u.id).length,
          };
        })
        .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));

      // Bookings with email
      const bookings = (bookingsQ.data || []).map((b) => ({ ...b, email: emailOf[b.user_id] || b.user_id.slice(0, 8) }));

      // Threads with email
      const byUser = {};
      msgs.forEach((m) => { (byUser[m.user_id] = byUser[m.user_id] || []).push(m); });
      const threads = Object.entries(byUser).map(([uid, ms]) => ({
        user_id: uid,
        email: emailOf[uid] || uid.slice(0, 8),
        messages: ms,
        last: ms[ms.length - 1],
        needsReply: ms[ms.length - 1]?.sender === "user",
      })).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

      return Response.json({
        stats: {
          users: users.length,
          newUsers7d: users.filter((u) => new Date(u.created_at).getTime() > weekAgo).length,
          withPhone: clients.filter((c) => c.phone).length,
          verified: clients.filter((c) => c.verified).length,
          sites: sites.length,
          scans: scans.length,
          proSites: proSites.length,
          revenue: (reports.length || proSites.length) * 799,
          conversion: users.length ? Math.round((clients.filter((c) => c.is_pro).length / users.length) * 100) : 0,
          messagesSent: msgs.length,
        },
        clients,
        bookings,
        threads,
      });
    }

    /* ---- Single client deep-dive ---- */
    if (action === "clientDetail") {
      const uid = payload?.user_id;
      if (!uid) return Response.json({ error: "user_id required" }, { status: 400 });
      const [sitesQ, scansQ, reportsQ, msgsQ, uQ] = await Promise.all([
        admin.from("sites").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        admin.from("scans").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(60),
        admin.from("reports").select("id,site_id,created_at").eq("user_id", uid),
        admin.from("admin_messages").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        admin.auth.admin.getUserById(uid),
      ]);
      return Response.json({
        user: uQ?.data?.user ? { id: uid, email: uQ.data.user.email, created_at: uQ.data.user.created_at } : { id: uid },
        sites: sitesQ.data || [],
        scans: (scansQ.data || []).map((s) => ({ ...s, overall: s.overall ?? avg(s.scores) })),
        reports: reportsQ.data || [],
        messages: msgsQ.data || [],
      });
    }

    /* ---- Lead pipeline stage ---- */
    if (action === "setLeadStatus") {
      const { site_id, status } = payload || {};
      const allowed = ["new", "contacted", "proposal", "won", "lost"];
      if (!site_id || !allowed.includes(status)) return Response.json({ error: "Invalid payload" }, { status: 400 });
      const { error } = await admin.from("sites").update({ lead_status: status }).eq("id", site_id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    /* ---- Push a message / recommendation to a client ---- */
    if (action === "sendMessage") {
      const { user_id, site_id, title, body, kind, file_url, file_name } = payload || {};
      if (!user_id || !body?.trim()) return Response.json({ error: "user_id and message are required" }, { status: 400 });
      const { data, error } = await admin.from("admin_messages").insert({
        user_id, site_id: site_id || null, title: title.trim(), body: body.trim(),
        kind: ["note", "recommendation", "offer"].includes(kind) ? kind : "note",
      }).select().single();
      if (error) throw error;

      // Email notification to the client (best-effort)
      const { data: target } = await admin.auth.admin.getUserById(user_id);
      if (target?.user?.email) {
        const preview = body.trim().slice(0, 220) + (body.trim().length > 220 ? "…" : "");
        await sendMail({
          to: target.user.email,
          subject: title?.trim() ? `Digistick: ${title.trim()}` : "New message from the Digistick team",
          html: tpl({
            heading: title?.trim() || "You have a new message",
            body: `${preview.replace(/\n/g, "<br>")}<br><br>Reply to us right from your dashboard — we&rsquo;ll get back within a few hours.`,
            ctaText: "Open Messages", ctaUrl: (process.env.APP_BASE_URL || "https://sitecheck.digistick.in") + "/dashboard",
          }),
        });
      }
      return Response.json({ ok: true, message: data });
    }

    /* ---- Service bookings (allotments) ---- */
    if (action === "listBookings") {
      const [bq, users] = await Promise.all([
        admin.from("service_bookings").select("*").order("created_at", { ascending: false }).limit(500),
        listAllUsers(admin),
      ]);
      const emailOf = Object.fromEntries(users.map((u) => [u.id, u.email]));
      return Response.json({ bookings: (bq.data || []).map((b) => ({ ...b, email: emailOf[b.user_id] || b.user_id.slice(0, 8) })) });
    }

    if (action === "setBookingStatus") {
      const { booking_id, status } = payload || {};
      const allowed = ["paid", "confirmed", "completed", "cancelled"];
      if (!booking_id || !allowed.includes(status)) return Response.json({ error: "Invalid payload" }, { status: 400 });
      const { error } = await admin.from("service_bookings").update({ status }).eq("id", booking_id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    /* ---- Inbox: all message threads incl. customer replies ---- */
    if (action === "listThreads") {
      const [mq, users] = await Promise.all([
        admin.from("admin_messages").select("*").order("created_at", { ascending: true }).limit(2000),
        listAllUsers(admin),
      ]);
      const emailOf = Object.fromEntries(users.map((u) => [u.id, u.email]));
      const byUser = {};
      (mq.data || []).forEach((m) => {
        (byUser[m.user_id] = byUser[m.user_id] || []).push(m);
      });
      const threads = Object.entries(byUser).map(([uid, msgs]) => ({
        user_id: uid,
        email: emailOf[uid] || uid.slice(0, 8),
        messages: msgs,
        last: msgs[msgs.length - 1],
        needsReply: msgs[msgs.length - 1]?.sender === "user",
      })).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
      return Response.json({ threads });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Admin request failed." }, { status: 500 });
  }
}
