"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthModal from "../AuthModal";

/* ============ Navigation ============ */
const NAV = [
  ["Dashboard", "▦"], ["Growth Opportunities", "🚀"], ["Revenue Leaks", "💸"], ["Ads Strategy", "📣"],
  ["Competitors", "⚔"], ["Recommendations", "✨"], ["Messages", "💬"], ["Fix Kit", "🎁"], ["History", "📈"], ["Settings", "⚙"],
];
const MOBILE_NAV = [["Dashboard", "🏠", "Home"], ["Revenue Leaks", "🚀", "Growth"], ["Ads Strategy", "📣", "Ads"], ["Recommendations", "🧰", "Tools"], ["Settings", "👤", "Profile"]];

/* Placeholder theme showcase — replace preview links + add real .zip assets before launch. */
const THEMES = [
  { id: "velocity", name: "Velocity", tag: "Best for D2C", cls: "thm-v", preview: "https://themes.shopify.com/", desc: "High-converting all-rounder with urgency, trust badges and a sticky mobile cart.", features: ["Sticky add-to-cart", "Trust & COD badges", "Speed-optimized"], uplift: "+18–25% conversion uplift" },
  { id: "momentum", name: "Momentum", tag: "Best for fashion", cls: "thm-m", preview: "https://themes.shopify.com/", desc: "Visual-first layout built for apparel and lifestyle brands that sell on imagery.", features: ["Lookbook galleries", "Size-guide ready", "Reviews built in"], uplift: "+15–20% conversion uplift" },
  { id: "pulse", name: "Pulse", tag: "Best for single-product", cls: "thm-p", preview: "https://themes.shopify.com/", desc: "Long-form landing-page style theme made to convert cold traffic into buyers.", features: ["Exit-intent offer", "FAQ + social proof", "Email capture"], uplift: "+20–30% on cold traffic" },
];

/* Digistick services marketplace */
const SERVICES = [
  { ic: "⚡", name: "Store Speed Optimization", desc: "We take your Performance score above 85 — images, scripts, theme code, the works.", price: "From ₹4,999", cls: "sv-blue" },
  { ic: "🔍", name: "SEO Optimization", desc: "Full on-page + technical SEO sprint: metas, schema, structure, content depth.", price: "From ₹9,999", cls: "sv-purple" },
  { ic: "🛒", name: "CRO Upgrade", desc: "Trust, urgency, reviews, sticky cart — every conversion gap on your list, installed.", price: "From ₹7,999", cls: "sv-amber" },
  { ic: "📣", name: "Meta Ads Management", desc: "Full-funnel campaign setup and management — creatives, audiences, scaling.", price: "From ₹15,000/mo", cls: "sv-green" },
  { ic: "🏆", name: "Complete Growth Package", desc: "Speed + SEO + CRO + Ads under one roof. Your store, run like our best clients.", price: "Custom", cls: "sv-dark" },
];

/* ============ Helpers ============ */
function color(v) {
  if (v == null) return "var(--g-muted)";
  if (v >= 90) return "var(--g-success)";
  if (v >= 50) return "#d97706";
  return "var(--g-danger)";
}
function overallColor(v) {
  if (v == null) return "var(--g-muted)";
  if (v >= 70) return "var(--g-success)";
  if (v >= 50) return "#d97706";
  return "var(--g-danger)";
}
function band(v) {
  if (v == null) return "—";
  if (v >= 85) return "Excellent";
  if (v >= 70) return "Good";
  if (v >= 50) return "Needs work";
  return "Poor";
}
function inr(n) { return "₹" + (n || 0).toLocaleString("en-IN"); }
function hostOf(u) { return (u || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }

/* Deterministic per-domain revenue-leak estimate — same logic as the homepage so the numbers agree. */
function computeLeak(url, checks, scores) {
  if (!checks || !checks.length) return null;
  const failed = checks.filter((c) => !c.ok);
  const failedCro = failed.filter((c) => c.cat === "cro").length;
  const failedSeo = failed.filter((c) => c.cat !== "cro").length;
  const perf = scores?.performance;
  let base = failedCro * 9000 + failedSeo * 4500;
  if (perf != null && perf < 50) base += 12000;
  else if (perf != null && perf < 90) base += 6000;
  const host = hostOf(url) || "x";
  let seed = 0; for (let i = 0; i < host.length; i++) seed = (seed * 31 + host.charCodeAt(i)) % 1000;
  const variance = 1 + (seed / 1000) * 0.6;
  let est = Math.round(base * variance);
  est = Math.max(25000, Math.min(est, 100000));
  est = Math.round(est / 500) * 500;
  return est;
}

/* Split the leak across failed checks proportionally to their weight, so the action plan's ₹ figures add up. */
function recoveryPerCheck(leak, failed) {
  if (!leak || !failed.length) return {};
  const totalW = failed.reduce((a, c) => a + (c.weight || 1) + (c.cat === "cro" ? 1 : 0), 0);
  const out = {};
  failed.forEach((c) => {
    const w = (c.weight || 1) + (c.cat === "cro" ? 1 : 0);
    out[c.label] = Math.round((leak * 0.65) * (w / totalW) / 100) * 100;
  });
  return out;
}

/* Conversion score = % of CRO checks passing; Mobile experience derived from performance. */
function deriveScores(checks, scores) {
  const cro = checks.filter((c) => c.cat === "cro");
  const croPass = cro.filter((c) => c.ok).length;
  const conversion = cro.length ? Math.round((croPass / cro.length) * 100) : null;
  const perf = scores?.performance;
  const mobile = perf == null ? null : Math.max(5, Math.min(100, Math.round(perf * 0.9 + (scores?.bestPractices || perf) * 0.1)));
  return { conversion, mobile };
}

/* Rule-based Shopify app recommendation engine driven by the actual failed checks. */
function recommendApps(failed, scores) {
  const has = (re) => failed.some((c) => re.test(c.label) || re.test(c.detail || ""));
  const apps = [];
  if (has(/review|social proof|testimonial/i)) apps.push({ name: "Judge.me", ic: "⭐", why: "Your scan found no product reviews — the #1 trust signal Indian buyers check before paying.", impact: 9, diff: "Easy", gain: "₹6,000–₹12,000/mo", link: "https://apps.shopify.com/judgeme" });
  if (has(/review|ugc|photo/i)) apps.push({ name: "Loox", ic: "📸", why: "Photo reviews convert better than text for visual products — pairs well with UGC ads.", impact: 8, diff: "Easy", gain: "₹4,000–₹9,000/mo", link: "https://apps.shopify.com/loox" });
  if ((scores?.performance ?? 100) < 75 || has(/image|alt|lcp|speed/i)) apps.push({ name: "TinyIMG", ic: "🗜", why: "Heavy images are dragging your speed score — auto-compression recovers load time without design loss.", impact: 8, diff: "Easy", gain: "₹3,000–₹8,000/mo", link: "https://apps.shopify.com/tinyimg" });
  if (has(/urgency|scarcity|cart|upsell|checkout/i)) apps.push({ name: "ReConvert", ic: "🔁", why: "Missing post-purchase upsell — recover margin on every order you're already winning.", impact: 7, diff: "Medium", gain: "₹5,000–₹10,000/mo", link: "https://apps.shopify.com/reconvert" });
  apps.push({ name: "Klaviyo", ic: "✉️", why: "Abandoned-cart and welcome flows typically recover 8–12% of lost checkouts on D2C stores.", impact: 9, diff: "Medium", gain: "₹8,000–₹20,000/mo", link: "https://apps.shopify.com/klaviyo-email-marketing" });
  return apps.slice(0, 5);
}

/* Industry medians for the competitor view */
const INDUSTRY = { performance: 55, seo: 78, accessibility: 80, bestPractices: 85 };

/* ============ Small components ============ */
function Gauge({ value, size = 132, stroke = 10, light = false }) {
  const r = size / 2 - stroke - 2, c = 2 * Math.PI * r, pct = value == null ? 0 : value / 100;
  const col = light ? "#fff" : overallColor(value);
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "rgba(255,255,255,.25)" : "var(--g-line)"} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="gauge-c">
        <div className="gauge-v" style={{ color: col }}>{value ?? "—"}</div>
        <div className="gauge-b" style={light ? { color: "rgba(255,255,255,.8)" } : {}}>{light ? "Growth Score" : band(value)}</div>
      </div>
    </div>
  );
}

function Spark({ scans }) {
  const pts = scans.slice(0, 12).reverse().map((s) => s.overall || 0);
  if (pts.length < 2) return <div className="spark-empty">Not enough scans yet — re-scan after each fix to build your trend.</div>;
  const w = 460, h = 90, max = 100, step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#sg)" opacity="0.15" />
      <path d={d} fill="none" stroke="var(--g-primary)" strokeWidth="2.5" />
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--g-primary)" /><stop offset="100%" stopColor="var(--g-primary)" stopOpacity="0" /></linearGradient></defs>
    </svg>
  );
}

function CompareBar({ label, you, them, themLabel }) {
  return (
    <div className="cb">
      <div className="cb-label">{label}</div>
      <div className="cb-rows">
        <div className="cb-row"><span className="cb-who">You</span><div className="cb-bar"><span className="cb-fill you" style={{ width: (you || 0) + "%" }} /></div><b style={{ color: color(you) }}>{you ?? "—"}</b></div>
        <div className="cb-row"><span className="cb-who">{themLabel}</span><div className="cb-bar"><span className="cb-fill them" style={{ width: (them || 0) + "%" }} /></div><b>{them ?? "—"}</b></div>
      </div>
    </div>
  );
}

/* AI Growth Consultant — floating assistant wired to the existing /api/chat route, Pro-gated like the report chat. */
const PRESETS = ["How can I improve sales?", "Which app should I install first?", "Which theme should I use?", "How much should I spend on ads?", "What is my biggest growth opportunity?"];
function Consultant({ open, onClose, isPro, context, onUpgrade }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I'm your growth consultant. I can see your latest scan — ask me anything about improving sales, speed, SEO or ads." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const userTurns = msgs.filter((m) => m.role === "user").length;
  const capped = userTurns >= 8;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  async function send(text) {
    const t = (text || input).trim();
    if (!t || busy || capped) return;
    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context }) });
      const j = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.reply || "Sorry, try again." }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "Network issue — please try again." }]); }
    finally { setBusy(false); }
  }
  if (!open) return null;
  return (
    <div className="ai-panel">
      <div className="ai-head"><span className="ai-dot" /> AI Growth Consultant<button className="ai-x" onClick={onClose}>✕</button></div>
      {!isPro ? (
        <div className="ai-gate">
          <div className="ai-gate-ic">🔒</div>
          <b>The AI consultant is a Pro feature</b>
          <p>Unlock the ₹799 Growth Plan to chat with an assistant that understands your actual scan data.</p>
          <button className="g-btn-primary" onClick={onUpgrade}>Unlock Pro — ₹799</button>
        </div>
      ) : (
        <>
          <div className="ai-msgs">
            {msgs.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.content}</div>)}
            {busy && <div className="ai-msg assistant typing">Thinking…</div>}
            <div ref={endRef} />
          </div>
          {userTurns === 0 && <div className="ai-presets">{PRESETS.map((p) => <button key={p} onClick={() => send(p)}>{p}</button>)}</div>}
          <div className="ai-input">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={capped ? "Message limit reached" : "Ask about your store…"} disabled={capped || busy} />
            <button onClick={() => send()} disabled={capped || busy}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [scans, setScans] = useState([]);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("Dashboard");
  const [newUrl, setNewUrl] = useState("");
  const [compUrl, setCompUrl] = useState("");
  const [compData, setCompData] = useState(null);
  const [busy, setBusy] = useState("");
  const [reports, setReports] = useState([]);
  const [launchLeft, setLaunchLeft] = useState("48:00:00");
  const [aiOpen, setAiOpen] = useState(false);
  const [done, setDone] = useState({}); // action-plan checkmarks, persisted per site
  const [inbox, setInbox] = useState([]); // messages pushed by Digistick admins
  const configured = supabaseConfigured();

  // Load admin messages — RLS lets each user read only their own.
  const loadInbox = useCallback(async () => {
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.from("admin_messages").select("*").order("created_at", { ascending: false });
    if (data) setInbox(data);
  }, []);

  // Opening the Messages tab marks unread items as read.
  useEffect(() => {
    if (tab !== "Messages") return;
    const unread = inbox.filter((m) => !m.read_at);
    if (!unread.length) return;
    const sb = getSupabase(); if (!sb) return;
    const now = new Date().toISOString();
    sb.from("admin_messages").update({ read_at: now }).is("read_at", null).then(() => {
      setInbox((ms) => ms.map((m) => m.read_at ? m : { ...m, read_at: now }));
    });
  }, [tab, inbox]);

  // Launch discount countdown — 7 days from first visit (stored per browser so it's consistent, not fake-resetting)
  useEffect(() => {
    let end;
    try {
      const saved = window.localStorage.getItem("ds_launch_end");
      if (saved) end = parseInt(saved, 10);
      else { end = Date.now() + 7 * 24 * 3600 * 1000; window.localStorage.setItem("ds_launch_end", String(end)); }
    } catch { end = Date.now() + 7 * 24 * 3600 * 1000; }
    const tick = () => {
      const ms = Math.max(0, end - Date.now());
      const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
      setLaunchLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Action-plan progress persistence
  useEffect(() => {
    if (!active) return;
    try { setDone(JSON.parse(window.localStorage.getItem("ds_plan_" + active) || "{}")); } catch { setDone({}); }
  }, [active]);
  const toggleDone = (label) => {
    setDone((d) => {
      const next = { ...d, [label]: !d[label] };
      try { window.localStorage.setItem("ds_plan_" + active, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const token = useCallback(async () => {
    const sb = getSupabase(); if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  }, []);

  const api = useCallback(async (action, payload) => {
    const t = await token();
    const res = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ action, payload }) });
    return res.json();
  }, [token]);

  const loadData = useCallback(async () => {
    const r = await api("list");
    if (r.sites) { setSites(r.sites); setScans(r.scans || []); setReports(r.reports || []); if (!active && r.sites[0]) setActive(r.sites[0].id); }
  }, [api, active]);

  // One-time cleanup of any duplicate sites from before the find-or-create fix.
  const dedupedRef = useRef(false);
  const loadDataDeduped = useCallback(async () => {
    if (!dedupedRef.current) { dedupedRef.current = true; try { await api("dedupeSites"); } catch {} }
    await loadData();
  }, [api, loadData]);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => { setUser(data?.user || null); setLoading(false); if (data?.user) { loadDataDeduped(); loadInbox(); } });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { setUser(session?.user || null); if (session?.user) { loadDataDeduped(); loadInbox(); } });
    return () => sub?.subscription?.unsubscribe();
  }, [configured]); // eslint-disable-line

  // Internal scan flow: arriving from the homepage with ?scan=URL runs the scan inside the dashboard.
  const scanQueuedRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);

    // Payment return: ?order_id=...&unlock=URL → verify + flip site to Pro.
    const orderId = params.get("order_id");
    const unlockUrl = params.get("unlock");
    if (orderId && unlockUrl && !scanQueuedRef.current) {
      scanQueuedRef.current = true;
      window.history.replaceState({}, "", "/dashboard");
      (async () => {
        setBusy("unlocking");
        try {
          const r = await api("unlockPro", { url: unlockUrl, orderId });
          if (r.ok) await loadData();
          else alert(r.error || "We couldn't verify that payment. If money was deducted, contact support.");
        } finally { setBusy(""); }
      })();
      return;
    }

    const toScan = params.get("scan");
    if (toScan && !scanQueuedRef.current) {
      scanQueuedRef.current = true;
      window.history.replaceState({}, "", "/dashboard");
      (async () => {
        setBusy("scanning");
        try {
          const r = await api("addSite", { url: toScan });
          if (r.site) {
            setActive(r.site.id); setTab("Dashboard");
            const d = await scan(r.site.url);
            if (d) await api("saveScan", { site_id: r.site.id, scores: d.pagespeed?.scores, checks: d.seo?.checks });
            await loadData();
          }
        } finally { setBusy(""); }
      })();
    }
  }, [user]); // eslint-disable-line

  async function scan(url) {
    const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    return res.ok ? res.json() : null;
  }
  async function runScan(siteUrl, siteId) {
    setBusy("scanning");
    try { const d = await scan(siteUrl); if (d) { await api("saveScan", { site_id: siteId, scores: d.pagespeed?.scores, checks: d.seo?.checks }); await loadData(); } }
    finally { setBusy(""); }
  }

  // Internal checkout — opens Cashfree right inside the dashboard, returns here.
  async function unlockPro(siteUrl) {
    setBusy("checkout");
    try {
      const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: siteUrl, product: "report", returnTo: "dashboard" }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error((json && json.error) || "Could not start checkout.");
      await loadCashfreeSDK();
      const cashfree = window.Cashfree({ mode: json.env === "production" ? "production" : "sandbox" });
      cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { alert(e.message); setBusy(""); }
  }
  async function addSite() {
    if (!newUrl.trim()) return; setBusy("adding");
    const r = await api("addSite", { url: newUrl.trim() }); setNewUrl("");
    if (r.site) { await loadData(); setActive(r.site.id); await runScan(r.site.url, r.site.id); }
    setBusy("");
  }
  async function runCompetitor() {
    if (!compUrl.trim()) return; setBusy("comp");
    try { const d = await scan(compUrl.trim()); setCompData(d ? { url: compUrl.trim(), scores: d.pagespeed?.scores } : null); }
    finally { setBusy(""); }
  }
  async function logout() { const sb = getSupabase(); await sb?.auth.signOut(); setUser(null); setSites([]); setScans([]); }

  if (loading) return <div className="gcc"><div className="gcc-load">Loading your Growth Command Center…</div></div>;

  if (!configured) return (
    <div className="gcc"><div className="gcc-gate">
      <h2>Dashboard not configured</h2>
      <p>Add your Supabase keys in Vercel to enable accounts, then redeploy.</p>
      <a className="g-btn-primary" href="/">← Back to scanner</a>
    </div></div>
  );

  if (!user) return (
    <div className="gcc"><div className="gcc-gate">
      <div className="g-logo">DIGI<span>STICK</span><i>SITECHECK</i></div>
      <h2>Your Growth Command Center</h2>
      <p>Log in to see how much revenue your store is leaking, why, and exactly what to fix next.</p>
      <button className="g-btn-primary" onClick={() => setAuthOpen(true)}>Log in / Sign up</button>
      <a className="gcc-back" href="/">← Back to free scanner</a>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={setUser} />}
    </div></div>
  );

  /* ===== Derived growth data — everything below renders from the real scan ===== */
  const activeSite = sites.find((s) => s.id === active);
  const siteScans = scans.filter((s) => s.site_id === active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latest = siteScans[0];
  const prev = siteScans[1];
  const checks = latest?.checks || [];
  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);
  const isPro = activeSite?.is_pro;
  const delta = latest && prev ? (latest.overall - prev.overall) : null;
  const siteReports = reports.filter((r) => r.site_id === active);
  const priority = [...failed].sort((a, b) => (b.weight || 1) - (a.weight || 1));

  const leak = latest ? computeLeak(activeSite?.url, checks, latest.scores) : null;
  const recovery = leak ? Math.round(leak * 0.65 / 500) * 500 : null;
  const perCheck = recoveryPerCheck(leak, failed);
  const { conversion, mobile } = deriveScores(checks, latest?.scores || {});
  const planItems = priority.slice(0, 6);
  const doneCount = planItems.filter((c) => done[c.label]).length;
  const planPct = planItems.length ? Math.round((doneCount / planItems.length) * 100) : 0;
  const apps = recommendApps(failed, latest?.scores);
  const adReadiness = latest ? Math.round(((latest.scores?.performance || 0) * 0.4 + (conversion || 0) * 0.4 + (latest.scores?.seo || 0) * 0.2)) : null;
  const status = !latest ? "Not scanned yet" : latest.overall >= 85 ? "Excellent — ready to scale" : latest.overall >= 70 ? "Good but losing conversions" : latest.overall >= 50 ? "Leaking revenue — fix soon" : "Critical — losing buyers daily";
  const chatContext = latest ? { url: activeSite?.url, scores: latest.scores, conversion, failed: failed.map((c) => c.label).slice(0, 12), leak } : null;

  /* Activity timeline from real events */
  const activity = [
    ...siteScans.slice(0, 6).map((s, i) => {
      const older = siteScans[i + 1];
      const d = older ? s.overall - older.overall : null;
      return { t: s.created_at, ic: d != null && d > 0 ? "📈" : "🔍", text: d != null && d !== 0 ? `Scan completed — growth score ${d > 0 ? "up" : "down"} ${Math.abs(d)} pts to ${s.overall}` : `Store scanned — growth score ${s.overall}` };
    }),
    ...siteReports.map((r) => ({ t: r.created_at, ic: "🎁", text: "Growth Plan (fix-kit) unlocked — recommendations saved to this account" })),
  ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);

  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="gcc">
      {/* ===== Sidebar ===== */}
      <aside className="g-side">
        <a href="/" className="g-logo">DIGI<span>STICK</span><i>SITECHECK</i></a>
        <div className="g-site-pick">
          {sites.map((s) => (
            <button key={s.id} className={`g-site ${active === s.id ? "on" : ""}`} onClick={() => { setActive(s.id); setTab("Dashboard"); setCompData(null); }}>
              <span className="g-site-dot" style={{ background: color(scans.filter((x) => x.site_id === s.id)[0]?.overall) }} />
              <span className="g-site-url">{hostOf(s.label || s.url)}</span>
              {s.is_pro && <span className="g-site-pro">PRO</span>}
            </button>
          ))}
          <div className="g-site-add">
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSite()} placeholder="+ add store" />
            <button onClick={addSite} disabled={busy === "adding"}>{busy === "adding" ? "…" : "Add"}</button>
          </div>
        </div>
        <nav className="g-nav">
          {NAV.map(([t, ic]) => (
            <button key={t} className={`g-nav-item ${tab === t ? "on" : ""}`} onClick={() => go(t)}>
              <span className="gni-ic">{ic}</span>{t}
              {t === "Revenue Leaks" && failed.length > 0 && <span className="gni-badge">{failed.length}</span>}
              {t === "Messages" && inbox.filter((m) => !m.read_at).length > 0 && <span className="gni-badge">{inbox.filter((m) => !m.read_at).length}</span>}
              {t === "Messages" && inbox.filter((m) => !m.read_at).length > 0 && <span className="gni-badge">{inbox.filter((m) => !m.read_at).length}</span>}
              {["History", "Settings"].includes(t) && !isPro && <span className="gni-lock">🔒</span>}
            </button>
          ))}
        </nav>
        <div className="g-side-foot">
          {activeSite && !isPro && (
            <div className="g-plan">
              <div className="g-plan-tag">FREE PLAN</div>
              <p>Unlock your full Growth Plan — fixes, history, AI consultant.</p>
              <div className="g-plan-price"><s>₹1,499</s> ₹799</div>
              <div className="g-plan-timer">🔥 Launch price ends in {launchLeft}</div>
              <button className="g-btn-accent" onClick={() => unlockPro(activeSite.url)}>Upgrade now</button>
            </div>
          )}
          {activeSite && isPro && <div className="g-plan pro"><div className="g-plan-tag ok">✓ PRO ACTIVE</div><p>All growth features unlocked for this store.</p></div>}
          <div className="g-acct"><span>{user.email}</span><button onClick={logout}>Log out</button></div>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <main className="g-main">
        {(busy === "scanning" || busy === "unlocking") && (
          <div className="g-scanning">
            <div className="g-spinner" />
            <h3>{busy === "unlocking" ? "Confirming your payment…" : `Scanning ${hostOf(activeSite?.url || newUrl || "your store")}…`}</h3>
            <p>{busy === "unlocking" ? "Verifying with the payment provider and unlocking Pro." : "Running Lighthouse, parsing SEO, checking accessibility & conversion. About 30 seconds."}</p>
            <div className="g-scan-bar"><span /></div>
          </div>
        )}

        {busy !== "scanning" && busy !== "unlocking" && !activeSite && (
          <div className="g-empty big"><h3>Add your first store</h3><p>Enter a URL in the sidebar. We&apos;ll scan it and show you exactly where it&apos;s leaking revenue.</p></div>
        )}

        {busy !== "scanning" && busy !== "unlocking" && activeSite && (
          <>
            <div className="g-head">
              <div>
                <h1>{hostOf(activeSite.url)}</h1>
                <span className="g-head-sub">{latest ? `Last scanned ${new Date(latest.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Not scanned yet"} · {siteScans.length} scan{siteScans.length !== 1 ? "s" : ""}</span>
              </div>
              <button className="g-rescan" onClick={() => runScan(activeSite.url, activeSite.id)} disabled={busy === "scanning"}>↻ Re-scan now</button>
            </div>

            {!latest && tab !== "Settings" && <div className="g-empty"><h3>No scan yet</h3><p>Hit &quot;Re-scan now&quot; to run the first audit on this store.</p></div>}

            {/* ============ DASHBOARD ============ */}
            {latest && tab === "Dashboard" && (
              <>
                {/* HERO — Revenue Leak Alert */}
                <div className="g-hero">
                  <div className="g-hero-l">
                    <div className="g-hero-alert"><span className="g-pulse" /> REVENUE LEAK ALERT</div>
                    <div className="g-hero-leak">{inr(leak)}<span>/month</span></div>
                    <div className="g-hero-rec">Potential recovery <b>+{inr(recovery)}/month</b></div>
                    <div className="g-hero-status">Store status: <b>{status}</b></div>
                    <div className="g-hero-ctas">
                      <button className="g-btn-accent" onClick={() => go("Revenue Leaks")}>Fix My Store</button>
                      {!isPro
                        ? <button className="g-btn-ghost" onClick={() => unlockPro(activeSite.url)}>Unlock Growth Plan</button>
                        : <button className="g-btn-ghost" onClick={() => go("Fix Kit")}>Open Growth Plan</button>}
                      <a className="g-btn-ghost" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book Digistick</a>
                    </div>
                  </div>
                  <div className="g-hero-r">
                    <Gauge value={latest.overall} size={150} stroke={11} light />
                    {delta != null && <div className={`g-delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs last scan</div>}
                  </div>
                </div>

                {/* GROWTH SCORE CARDS */}
                <div className="g-cards4">
                  {[
                    ["⚡", "Speed Score", latest.scores?.performance, `Revenue impact ~${inr(Math.round((leak || 0) * 0.3 / 500) * 500)}/mo`, "Recovery: fix images & scripts"],
                    ["🔍", "SEO Score", latest.scores?.seo, "Traffic potential: +25–40% organic", "Metas, schema & structure"],
                    ["🛒", "Conversion Score", conversion, `Potential sales increase +${Math.max(5, Math.round((100 - (conversion || 0)) / 3))}%`, `${checks.filter((c) => c.cat === "cro" && !c.ok).length} CRO gaps open`],
                    ["📱", "Mobile Experience", mobile, `Mobile revenue impact ~${inr(Math.round((leak || 0) * 0.45 / 500) * 500)}/mo`, "70%+ of Indian D2C traffic is mobile"],
                  ].map(([ic, lbl, v, impact, sub]) => (
                    <div className="g-card g-score" key={lbl}>
                      <div className="g-score-top"><span className="g-score-ic">{ic}</span><span className="g-score-band" style={{ color: color(v) }}>{band(v)}</span></div>
                      <div className="g-score-v" style={{ color: color(v) }}>{v ?? "—"}<span>/100</span></div>
                      <div className="g-score-l">{lbl}</div>
                      <div className="g-score-bar"><span style={{ width: (v || 0) + "%", background: color(v) }} /></div>
                      <div className="g-score-impact">{impact}</div>
                      <div className="g-score-sub">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* ACTION PLAN + ACTIVITY */}
                <div className="g-2col">
                  <div className="g-card">
                    <div className="g-card-h"><h3>Today&apos;s action plan</h3><span className="g-chip">{doneCount}/{planItems.length} done</span></div>
                    <div className="g-progress"><span style={{ width: planPct + "%" }} /><i>{planPct}% complete{planPct === 100 ? " 🎉" : ""}</i></div>
                    {planItems.length === 0 && <div className="g-empty sm"><p>Every check passed — your store is in great shape. Re-scan weekly to keep it that way.</p></div>}
                    {planItems.map((c) => (
                      <label className={`g-task ${done[c.label] ? "done" : ""}`} key={c.label}>
                        <input type="checkbox" checked={!!done[c.label]} onChange={() => toggleDone(c.label)} />
                        <div className="g-task-body"><b>{c.label}</b><span>{c.detail}</span></div>
                        <span className="g-task-rec">+{inr(perCheck[c.label])}<i>recovery</i></span>
                      </label>
                    ))}
                    {failed.length > planItems.length && <button className="g-link" onClick={() => go("Revenue Leaks")}>See all {failed.length} leaks →</button>}
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Recent activity</h3></div>
                    <div className="g-timeline">
                      {activity.length === 0 && <p className="g-dim">Activity will appear here as you scan and fix.</p>}
                      {activity.map((a, i) => (
                        <div className="g-tl-item" key={i}>
                          <span className="g-tl-ic">{a.ic}</span>
                          <div><p>{a.text}</p><time>{new Date(a.t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div>
                        </div>
                      ))}
                    </div>
                    <div className="g-card-h" style={{ marginTop: 18 }}><h3>Score trend</h3>{!isPro && <span className="g-lock">PRO</span>}</div>
                    {isPro ? <Spark scans={siteScans} /> : <button className="g-trend-locked" onClick={() => unlockPro(activeSite.url)}>Unlock Pro to track your score over time →</button>}
                  </div>
                </div>
              </>
            )}

            {/* ============ GROWTH OPPORTUNITIES ============ */}
            {latest && tab === "Growth Opportunities" && (
              <>
                <div className="g-sec-h"><h2>Growth opportunities</h2><p>Ranked by revenue impact for {hostOf(activeSite.url)} — every item comes from your actual scan.</p></div>
                <div className="g-cards3">
                  <div className="g-card g-opp"><div className="g-opp-ic ob">🛒</div><h3>Close your CRO gaps</h3><p>{checks.filter((c) => c.cat === "cro" && !c.ok).length} conversion elements missing. Worth ~{inr(Math.round((leak || 0) * 0.45 / 500) * 500)}/mo.</p><button className="g-link" onClick={() => go("Revenue Leaks")}>View leaks →</button></div>
                  <div className="g-card g-opp"><div className="g-opp-ic oa">⚡</div><h3>Speed up mobile</h3><p>Performance is {latest.scores?.performance ?? "—"}/100. Every second of load time costs ~7% of conversions.</p><button className="g-link" onClick={() => go("Recommendations")}>Get tools →</button></div>
                  <div className="g-card g-opp"><div className="g-opp-ic og">📣</div><h3>Start paid traffic right</h3><p>Your ad readiness is {adReadiness ?? "—"}/100. Fix the leaks first, then scale with a structured funnel.</p><button className="g-link" onClick={() => go("Ads Strategy")}>See ads plan →</button></div>
                </div>
                <div className="g-card">
                  <div className="g-card-h"><h3>Quick wins this week</h3><span className="g-chip">{Math.min(5, priority.length)} items</span></div>
                  {priority.slice(0, 5).map((c, i) => (
                    <div className="g-row" key={c.label}><span className="g-rank">{i + 1}</span><div><b>{c.label}</b><span>{c.detail}</span></div><span className="g-task-rec">+{inr(perCheck[c.label])}<i>est/mo</i></span></div>
                  ))}
                  {priority.length === 0 && <p className="g-dim">No open issues — you&apos;re ready to scale traffic.</p>}
                </div>
              </>
            )}

            {/* ============ REVENUE LEAKS ============ */}
            {latest && tab === "Revenue Leaks" && (
              <>
                <div className="g-sec-h"><h2>Revenue leaks</h2><p>Estimated {inr(leak)}/month at stake · {failed.length} open issue{failed.length !== 1 ? "s" : ""} · check items off as you fix them</p></div>
                <div className="g-progress big"><span style={{ width: planPct + "%" }} /><i>{planPct}% of your top plan complete</i></div>
                {priority.length === 0 && <div className="g-empty"><h3>No leaks 🎉</h3><p>Every check passed on the last scan.</p></div>}
                {priority.map((c, i) => (
                  <div className="g-leak" key={c.label}>
                    <label className="g-leak-check"><input type="checkbox" checked={!!done[c.label]} onChange={() => toggleDone(c.label)} /></label>
                    <span className="g-rank">{i + 1}</span>
                    <div className="g-leak-body">
                      <b>{c.label}</b><span>{c.detail}</span>
                      {(c.fix || c.why) && <details><summary>How to fix</summary><p>{c.why ? <><b>Why it matters:</b> {c.why}<br /></> : null}<b>Fix:</b> {c.fix || "Open the relevant section in your store editor and apply the change. The ₹799 Growth Plan gives you copy-paste code for this."}</p></details>}
                    </div>
                    <div className="g-leak-meta">
                      <span className={`g-impact ${(c.weight || 1) >= 3 ? "high" : (c.weight || 1) >= 2 ? "med" : "low"}`}>{(c.weight || 1) >= 3 ? "High" : (c.weight || 1) >= 2 ? "Medium" : "Low"} impact</span>
                      <span className="g-task-rec">+{inr(perCheck[c.label])}<i>recovery</i></span>
                    </div>
                  </div>
                ))}
                {!isPro && failed.length > 0 && (
                  <div className="g-upsell"><div><b>Want these fixed for you?</b><p>The ₹799 Growth Plan writes your fixes, gives you an install-ready Shopify file, and a 14-day plan.</p></div><button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Unlock Growth Plan — ₹799</button></div>
                )}
                {passed.length > 0 && <div className="g-card"><div className="g-card-h"><h3>Passing ({passed.length})</h3></div><div className="g-passes">{passed.map((c) => <span key={c.label}>✓ {c.label}</span>)}</div></div>}
              </>
            )}

            {/* ============ ADS STRATEGY ============ */}
            {latest && tab === "Ads Strategy" && (
              <>
                <div className="g-sec-h"><h2>Ads strategy center</h2><p>Built from your store&apos;s readiness — fix conversion gaps before scaling spend.</p></div>
                <div className="g-2col">
                  <div className="g-card g-ads-ready">
                    <div className="g-card-h"><h3>Ad readiness score</h3></div>
                    <div className="g-ads-gauge"><Gauge value={adReadiness} size={120} /></div>
                    <p className="g-dim center">{adReadiness >= 75 ? "Your store converts well enough to scale paid traffic profitably." : adReadiness >= 55 ? "Run small budgets while you close the CRO gaps — every fix lowers your CAC." : "Fix your leaks before spending — paid traffic to a leaking store burns money."}</p>
                    <div className="g-budget">💰 Recommended starting budget <b>₹500/day</b></div>
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Campaign structure</h3></div>
                    {[["❄️ Cold campaign", "60% budget · broad + interest audiences", "Objective: purchases. Test 3 creatives, kill losers in 4 days."],
                      ["🔁 Retargeting", "25% budget · site visitors & cart abandoners", "Urgency + social-proof angles. Your COD/return badges matter most here."],
                      ["👯 Lookalike", "15% budget · 1–3% of purchasers", "Switch on only after 50+ purchases for a clean seed audience."]].map(([t, a, d]) => (
                      <div className="g-row" key={t}><div><b>{t}</b><span>{a}</span><span className="g-dim">{d}</span></div></div>
                    ))}
                  </div>
                </div>
                <div className="g-cards3">
                  <div className="g-card"><div className="g-card-h"><h3>🎯 Suggested audiences</h3></div><ul className="g-list"><li>Interest stacks around your niche + “online shopping”</li><li>Engaged Instagram shoppers, 24–44</li><li>Cart abandoners (7-day window)</li><li>Past buyers — for upsell campaigns</li></ul></div>
                  <div className="g-card"><div className="g-card-h"><h3>🎬 Creative angles</h3></div><ul className="g-list"><li>Problem → product demo in first 3 seconds</li><li>UGC unboxing with COD trust callout</li><li>Founder story — why you built this</li><li>Before/after or social-proof compilation</li></ul></div>
                  <div className="g-card"><div className="g-card-h"><h3>🪝 Video hooks</h3></div><ul className="g-list"><li>&quot;I stopped buying ___ from big brands because…&quot;</li><li>&quot;POV: your ___ finally arrives and it&apos;s actually good&quot;</li><li>&quot;3 signs you&apos;re overpaying for ___&quot;</li><li>&quot;Don&apos;t buy ___ before watching this&quot;</li></ul></div>
                </div>
                <div className="g-upsell"><div><b>Want ads run by professionals?</b><p>Digistick manages full-funnel Meta campaigns for D2C brands — creatives, audiences, scaling.</p></div><a className="g-btn-primary" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book a strategy call</a></div>
              </>
            )}

            {/* ============ COMPETITORS ============ */}
            {tab === "Competitors" && (
              <>
                <div className="g-sec-h"><h2>Competitor analysis</h2><p>Compare against any store, plus the industry average for D2C.</p></div>
                <div className="g-card">
                  <div className="g-comp-input"><input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCompetitor()} placeholder="competitor.com" /><button className="g-btn-primary" onClick={runCompetitor} disabled={busy === "comp"}>{busy === "comp" ? "Scanning…" : "Compare"}</button></div>
                  {latest && (
                    <div className="g-compare">
                      {[["Speed", "performance"], ["SEO", "seo"], ["Accessibility", "accessibility"], ["Best practices", "bestPractices"]].map(([lbl, key]) => (
                        <CompareBar key={key} label={lbl} you={latest.scores?.[key]} them={compData ? compData.scores?.[key] : INDUSTRY[key]} themLabel={compData ? hostOf(compData.url) : "Industry avg"} />
                      ))}
                    </div>
                  )}
                  {!latest && <p className="g-dim">Scan your store first to enable comparison.</p>}
                </div>
              </>
            )}

            {/* ============ RECOMMENDATIONS ============ */}
            {latest && tab === "Recommendations" && (
              <>
                <div className="g-sec-h"><h2>Recommendations</h2><p>Apps, themes and services matched to the issues found on {hostOf(activeSite.url)}.</p></div>

                <div className="g-card-h free"><h3>🧩 Shopify apps for your gaps</h3></div>
                <div className="g-apps">
                  {apps.map((a) => (
                    <div className="g-card g-app" key={a.name}>
                      <div className="g-app-top"><span className="g-app-ic">{a.ic}</span><b>{a.name}</b><span className="g-app-impact">Impact {a.impact}/10</span></div>
                      <p>{a.why}</p>
                      <div className="g-app-meta"><span>Difficulty: <b>{a.diff}</b></span><span>Est. gain: <b>{a.gain}</b></span></div>
                      <div className="g-app-actions">
                        <a className="g-btn-ghost dark" href={a.link} target="_blank" rel="noopener noreferrer">Install app</a>
                        <a className="g-btn-primary sm" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Get Digistick to install</a>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="g-card-h free" style={{ marginTop: 26 }}><h3>🎨 Theme recommendation engine</h3><span className="g-chip warn">₹3,999 · launch price</span></div>
                <div className="g-themes">
                  {THEMES.map((t) => (
                    <div className="g-card g-theme" key={t.id}>
                      <div className={`g-theme-thumb ${t.cls}`}><span>{t.tag}</span><b>{t.name}</b></div>
                      <div className="g-theme-body">
                        <p>{t.desc}</p>
                        <div className="g-theme-uplift">📈 {t.uplift}</div>
                        <ul className="g-list sm">{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                        <div className="g-app-actions">
                          <a className="g-btn-ghost dark" href={t.preview} target="_blank" rel="noopener noreferrer">Preview</a>
                          <button className="g-btn-primary sm" onClick={() => alert("Theme checkout is launching soon! Contact connect@digistick.in to get this theme at ₹3,999 with setup.")}>Request setup</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="g-card-h free" style={{ marginTop: 26 }}><h3>🏆 Done-for-you by Digistick</h3></div>
                <div className="g-services">
                  {SERVICES.map((s) => (
                    <div className={`g-card g-service ${s.cls}`} key={s.name}>
                      <span className="g-sv-ic">{s.ic}</span>
                      <b>{s.name}</b><p>{s.desc}</p>
                      <div className="g-sv-foot"><span>{s.price}</span><a href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book →</a></div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ============ MESSAGES ============ */}
            {tab === "Messages" && (
              <>
                <div className="g-sec-h"><h2>Messages from Digistick</h2><p>Recommendations and offers from our team, based on your store&apos;s data.</p></div>
                {inbox.length === 0 && <div className="g-empty"><h3>No messages yet</h3><p>When the Digistick team has a recommendation for your store, it appears here.</p></div>}
                {inbox.map((m) => (
                  <div className={`g-card g-inbox ${!m.read_at ? "unread" : ""}`} key={m.id}>
                    <div className="g-inbox-top">
                      <span className="g-inbox-kind">{m.kind === "offer" ? "💰 Offer" : m.kind === "recommendation" ? "✨ Recommendation" : "📝 Note"}</span>
                      <span className="g-dim">{new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <b>{m.title}</b>
                    <p>{m.body}</p>
                    <a className="g-link" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Reply / book a call →</a>
                  </div>
                ))}
              </>
            )}

            {/* ============ MESSAGES ============ */}
            {tab === "Messages" && (
              <>
                <div className="g-sec-h"><h2>Messages from Digistick</h2><p>Recommendations and offers from our team, based on your store&apos;s data.</p></div>
                {inbox.length === 0 && <div className="g-empty"><h3>No messages yet</h3><p>When the Digistick team has a recommendation for your store, it appears here.</p></div>}
                {inbox.map((m) => (
                  <div className={`g-card g-inbox ${!m.read_at ? "unread" : ""}`} key={m.id}>
                    <div className="g-inbox-top">
                      <span className="g-inbox-kind">{m.kind === "offer" ? "\ud83d\udcb0 Offer" : m.kind === "recommendation" ? "\u2728 Recommendation" : "\ud83d\udcdd Note"}</span>
                      <span className="g-dim">{new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <b>{m.title}</b>
                    <p>{m.body}</p>
                    <a className="g-link" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Reply / book a call \u2192</a>
                  </div>
                ))}
              </>
            )}

            {/* ============ FIX KIT ============ */}
            {tab === "Fix Kit" && (
              <>
                <div className="g-sec-h"><h2>Your Growth Plan</h2><p>Reports & fix-kits you&apos;ve purchased for this store.</p></div>
                {siteReports.length === 0 ? (
                  isPro ? <div className="g-empty sm"><p>Your purchased fix-kit will appear here.</p></div>
                    : <div className="g-upsell"><div><b>No Growth Plan yet.</b><p>Unlock the ₹799 plan to get written fixes, a growth blueprint, and copy-paste snippets saved to your account.</p></div><button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Get the Growth Plan — ₹799</button></div>
                ) : siteReports.map((r) => (
                  <div className="g-card g-kit" key={r.id}><div><b>Growth Plan (fix-kit)</b><span>{new Date(r.created_at).toLocaleDateString("en-IN")}</span></div><a className="g-btn-primary sm" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Open →</a></div>
                ))}
              </>
            )}

            {/* ============ HISTORY ============ */}
            {tab === "History" && (
              <>
                <div className="g-sec-h"><h2>Score history</h2><p>Track your growth score over time and prove your fixes are working.</p></div>
                {isPro ? (
                  <div className="g-card">
                    <Spark scans={siteScans} />
                    <div className="g-hist">
                      {siteScans.map((s) => (
                        <div className="g-hist-row" key={s.id}><span>{new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><b style={{ color: color(s.overall) }}>{s.overall}</b></div>
                      ))}
                    </div>
                  </div>
                ) : <div className="g-upsell"><div><b>Score history is a Pro feature.</b><p>Unlock the ₹799 Growth Plan to track your scores over time.</p></div><button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Unlock Pro — ₹799</button></div>}
              </>
            )}

            {/* ============ SETTINGS ============ */}
            {tab === "Settings" && (
              <>
                <div className="g-sec-h"><h2>Settings & alerts</h2><p>Automated monitoring for this store.</p></div>
                <div className={`g-card ${!isPro ? "locked" : ""}`}>
                  <div className="g-set-row"><div><b>Scheduled re-scans</b><p>Automatically re-audit this store and track changes.</p></div>
                    <select disabled={!isPro} defaultValue={activeSite.scan_freq || "off"} onChange={async (e) => { await api("saveSettings", { site_id: active, scan_freq: e.target.value }); await loadData(); }}><option value="off">Off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                  <div className="g-set-row"><div><b>Score-drop alerts</b><p>Get an email if your overall health falls.</p></div>
                    <label className="g-switch"><input type="checkbox" disabled={!isPro} defaultChecked={!!activeSite.alerts_on} onChange={async (e) => { await api("saveSettings", { site_id: active, alerts_on: e.target.checked }); await loadData(); }} /><span /></label></div>
                  {!isPro && <button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Unlock Pro to enable — ₹799</button>}
                  {isPro && <p className="g-dim">Scheduled scans run in the background — new entries appear under History.</p>}
                </div>
                <div className="g-card danger"><div className="g-set-row"><div><b>Remove site</b><p>Stop tracking this store and delete its scans.</p></div><button className="g-del" onClick={async () => { if (confirm("Remove this site?")) { await api("removeSite", { site_id: active }); setActive(null); await loadData(); } }}>Remove</button></div></div>
              </>
            )}
          </>
        )}
      </main>

      {/* AI Growth Consultant — floating */}
      {activeSite && latest && (
        <>
          <button className={`ai-fab ${aiOpen ? "open" : ""}`} onClick={() => setAiOpen((o) => !o)} aria-label="AI Growth Consultant">{aiOpen ? "✕" : "🤖"}</button>
          <Consultant open={aiOpen} onClose={() => setAiOpen(false)} isPro={isPro} context={chatContext} onUpgrade={() => { setAiOpen(false); unlockPro(activeSite.url); }} />
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="g-bottom">
        {MOBILE_NAV.map(([t, ic, lbl]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => go(t)}><span>{ic}</span>{lbl}</button>
        ))}
      </nav>
    </div>
  );
}

function loadCashfreeSDK() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load payment SDK."));
    document.body.appendChild(s);
  });
}
