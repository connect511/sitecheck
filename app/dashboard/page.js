"use client";
import { track } from "../lib/pixel";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthModal from "../AuthModal";
import I from "../lib/icons";
import { SERVICES_CATALOG } from "../lib/servicesCatalog";
import { THEMES_CATALOG, recommendThemes } from "../lib/themesCatalog";

/* ============ Growth Workspace navigation ============ */
const NAV = [
  ["Overview", "gauge"], ["Priority Fixes", "wrench"], ["Theme Audit", "palette"], ["App Stack", "layers"],
  ["Ads Strategy", "megaphone"], ["Competitors", "target"], ["Services", "briefcase"], ["Messages", "chat"],
  ["Growth Plan", "gift"], ["History", "chart"], ["Settings", "settings"],
];
const MOBILE_NAV = [["Overview", "home", "Home"], ["Priority Fixes", "wrench", "Fixes"], ["Services", "briefcase", "Services"], ["Messages", "chat", "Chat"]];
const MORE_NAV = [["Theme Audit", "palette"], ["App Stack", "layers"], ["Ads Strategy", "megaphone"], ["Competitors", "target"], ["Growth Plan", "gift"], ["History", "chart"], ["Settings", "settings"]];



/* ============ Helpers ============ */
function color(v) { if (v == null) return "var(--g-muted)"; if (v >= 90) return "var(--g-success)"; if (v >= 50) return "#d97706"; return "var(--g-danger)"; }
function overallColor(v) { if (v == null) return "var(--g-muted)"; if (v >= 70) return "var(--g-success)"; if (v >= 50) return "#d97706"; return "var(--g-danger)"; }
function band(v) { if (v == null) return "—"; if (v >= 85) return "Excellent"; if (v >= 70) return "Good"; if (v >= 50) return "Needs work"; return "Poor"; }
function inr(n) { return "₹" + (n || 0).toLocaleString("en-IN"); }
function hostOf(u) { return (u || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }

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
  let est = Math.round(base * (1 + (seed / 1000) * 0.6));
  est = Math.max(25000, Math.min(est, 100000));
  return Math.round(est / 500) * 500;
}
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
function deriveScores(checks, scores) {
  const cro = checks.filter((c) => c.cat === "cro");
  const croPass = cro.filter((c) => c.ok).length;
  const conversion = cro.length ? Math.round((croPass / cro.length) * 100) : null;
  const perf = scores?.performance;
  const mobile = perf == null ? null : Math.max(5, Math.min(100, Math.round(perf * 0.9 + (scores?.bestPractices || perf) * 0.1)));
  return { conversion, mobile };
}
/* Purchase Confidence Score — trust/reviews/urgency/guarantee signals from the actual checks */
function confidenceScore(checks) {
  const re = /review|trust|urgenc|scarcit|return|cod|guarantee|secure|badge|testimonial|social proof/i;
  const rel = checks.filter((c) => re.test(c.label) || re.test(c.detail || ""));
  if (!rel.length) return { score: null, rel: [] };
  const pass = rel.filter((c) => c.ok).length;
  return { score: Math.round((pass / rel.length) * 100), rel };
}
function difficultyOf(c) {
  if (/lcp|speed|performance|core web|script/i.test(c.label)) return "Hard";
  if ((c.weight || 1) >= 3) return "Medium";
  return "Easy";
}
const TIME_OF = { Easy: "10-15 min", Medium: "30-45 min", Hard: "1-2 hrs" };

function recommendApps(failed, scores) {
  const has = (re) => failed.some((c) => re.test(c.label) || re.test(c.detail || ""));
  const apps = [];
  if (has(/review|social proof|testimonial/i)) apps.push({ name: "Judge.me", ic: "star", why: "Your scan found no product reviews — the #1 trust signal Indian buyers check before paying.", impact: 9, diff: "Easy", gain: "Rs 6,000-12,000/mo", link: "https://apps.shopify.com/judgeme" });
  if (has(/review|ugc|photo/i)) apps.push({ name: "Loox", ic: "image", why: "Photo reviews convert better than text for visual products — pairs well with UGC ads.", impact: 8, diff: "Easy", gain: "Rs 4,000-9,000/mo", link: "https://apps.shopify.com/loox" });
  if ((scores?.performance ?? 100) < 75 || has(/image|alt|lcp|speed/i)) apps.push({ name: "TinyIMG", ic: "zap", why: "Heavy images are dragging your speed score — auto-compression recovers load time without design loss.", impact: 8, diff: "Easy", gain: "Rs 3,000-8,000/mo", link: "https://apps.shopify.com/tinyimg" });
  if (has(/urgency|scarcity|cart|upsell|checkout/i)) apps.push({ name: "ReConvert", ic: "repeat", why: "Missing post-purchase upsell — recover margin on every order you're already winning.", impact: 7, diff: "Medium", gain: "Rs 5,000-10,000/mo", link: "https://apps.shopify.com/reconvert" });
  apps.push({ name: "Klaviyo", ic: "mail", why: "Abandoned-cart and welcome flows typically recover 8-12% of lost checkouts on D2C stores.", impact: 9, diff: "Medium", gain: "Rs 8,000-20,000/mo", link: "https://apps.shopify.com/klaviyo-email-marketing" });
  return apps.slice(0, 5);
}

const INDUSTRY = { performance: 55, seo: 78, accessibility: 80, bestPractices: 85, conversion: 62, mobile: 58 };

/* ============ Small components ============ */
function Gauge({ value, size = 132, stroke = 10, light = false, label }) {
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
        <div className="gauge-b" style={light ? { color: "rgba(255,255,255,.8)" } : {}}>{label || (light ? "Growth Score" : band(value))}</div>
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

/* AI Growth Consultant — scan-aware, Pro-gated */
const PRESETS = ["How can I improve sales?", "Which app should I install first?", "Which theme should I use?", "How much should I spend on ads?", "What is my biggest growth opportunity?"];
function Consultant({ open, onClose, isPro, context, onUpgrade, ask, onAsked }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I'm your growth consultant. I can see your latest scan — ask me anything about improving sales, speed, SEO or ads." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const userTurns = msgs.filter((m) => m.role === "user").length;
  const capped = userTurns >= 8;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const send = useCallback(async (text) => {
    const t = (text || "").trim();
    if (!t || capped) return;
    setMsgs((prev) => {
      const next = [...prev, { role: "user", content: t }];
      setBusy(true);
      fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context }) })
        .then((r) => r.json())
        .then((j) => setMsgs((m) => [...m, { role: "assistant", content: j.reply || "Sorry, try again." }]))
        .catch(() => setMsgs((m) => [...m, { role: "assistant", content: "Network issue — please try again." }]))
        .finally(() => setBusy(false));
      return next;
    });
  }, [capped, context]);

  // A "Generate fix" button elsewhere queued a question — send it once when the panel opens.
  useEffect(() => {
    if (open && isPro && ask) { send(ask); onAsked?.(); }
  }, [open, isPro, ask]); // eslint-disable-line

  if (!open) return null;
  return (
    <div className="ai-panel">
      <div className="ai-head"><span className="ai-dot" /> AI Growth Consultant<button className="ai-x" onClick={onClose}><I n="x" size={14} /></button></div>
      {!isPro ? (
        <div className="ai-gate">
          <div className="ai-gate-ic"><I n="lock" size={30} /></div>
          <b>The AI consultant is a Pro feature</b>
          <p>Unlock the Rs 799 Growth Plan to chat with an assistant that understands your actual scan data.</p>
          <button className="g-btn-primary" onClick={onUpgrade}>Unlock Pro — ₹799</button>
        </div>
      ) : (
        <>
          <div className="ai-msgs">
            {msgs.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.content}</div>)}
            {busy && <div className="ai-msg assistant typing">Thinking…</div>}
            <div ref={endRef} />
          </div>
          {userTurns === 0 && !busy && <div className="ai-presets">{PRESETS.map((p) => <button key={p} onClick={() => send(p)}>{p}</button>)}</div>}
          <div className="ai-input">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { send(input); setInput(""); } }} placeholder={capped ? "Message limit reached" : "Ask about your store…"} disabled={capped || busy} />
            <button onClick={() => { send(input); setInput(""); }} disabled={capped || busy}><I n="send" size={15} /></button>
          </div>
        </>
      )}
    </div>
  );
}



/* Blur-paywall: renders content blurred + non-interactive for free plans, with a Buy-now overlay */
function MaybeBlur({ locked, title, sub, timer, onUnlock, children, compact }) {
  if (!locked) return children;
  return (
    <div className="mb-wrap">
      <div className="mb-blur" aria-hidden="true">{children}</div>
      <div className="mb-overlay">
        <div className={`mb-card ${compact ? "compact" : ""}`}>
          <span className="mb-lock"><I n="lock" size={compact ? 16 : 20} /></span>
          <b>{title}</b>
          {!compact && <p>{sub}</p>}
          <div className="mb-price"><s>₹1,499</s> ₹799</div>
          <button className="g-btn-danger mb-cta" onClick={onUnlock}>Buy now — Unlock Pro</button>
          {timer && <span className="mb-timer"><I n="clock" size={11} /> Launch price ends in {timer}</span>}
        </div>
      </div>
    </div>
  );
}

/* Red pro-gate shown on locked tabs for free plans */
function ProGate({ title, desc, items, timer, onUnlock }) {
  return (
    <div className="g-progate">
      <div className="g-progate-alert"><I n="alert" size={14} /> PRO FEATURE LOCKED</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="g-progate-items">{items.map((i) => <span key={i}><I n="check" size={12} /> {i}</span>)}</div>
      <div className="g-progate-price"><s>₹1,499</s> ₹799 <i>one-time · per store</i></div>
      <button className="g-btn-danger" onClick={onUnlock}>Unlock Pro now</button>
      <div className="g-progate-timer"><I n="clock" size={12} /> Launch price ends in {timer}</div>
    </div>
  );
}

/* Red revenue-alert upgrade popup — everything included in Pro */
const PRO_FEATURES = [
  ["file", "Your fixes, pre-written", "SEO titles, meta, FAQ and alt text written for your products"],
  ["download", "Install-ready Shopify file", "One upload adds all 7 CRO sections to your theme"],
  ["calendar", "14-day action plan", "Day-by-day order of attack with the why behind it"],
  ["palette", "Theme Audit unlocked", "Theme score, blockers and Digistick comparisons"],
  ["layers", "App Stack + Ads Strategy", "Gap-matched apps and a full ads playbook"],
  ["bot", "AI Growth Consultant", "Scan-aware assistant + score history and auto re-scans"],
];
function ProPopup({ leak, timer, onClose, onUnlock }) {
  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pp-alert"><span className="pp-pulse" /><I n="alert" size={15} /> REVENUE ALERT — your store is leaking {inr(leak)}/month</div>
        <div className="pp-body">
          <h3>Stop the leak. Unlock your Growth Plan.</h3>
          <p className="pp-sub">Everything below is generated for <b>your store</b> from your actual scan:</p>
          <div className="pp-list">
            {PRO_FEATURES.map(([ic, t, d]) => (
              <div className="pp-row" key={t}><span className="pp-ic"><I n={ic} size={16} /></span><div><b>{t}</b><span>{d}</span></div><span className="pp-check"><I n="check" size={12} /></span></div>
            ))}
          </div>
          <div className="pp-foot">
            <div className="pp-price"><s>₹1,499</s> ₹799 <i>/ one-time per store</i></div>
            <button className="g-btn-danger pp-cta" onClick={onUnlock}>Unlock Growth Plan</button>
          </div>
          <div className="pp-timer"><I n="clock" size={12} /> Launch price ends in {timer} — then ₹1,499</div>
          <button className="pp-later" onClick={onClose}>Maybe later</button>
        </div>
      </div>
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
  const [tab, setTab] = useState("Overview");
  const [newUrl, setNewUrl] = useState("");
  const [compUrl, setCompUrl] = useState("");
  const [compData, setCompData] = useState(null);
  const [busy, setBusy] = useState("");
  const [reports, setReports] = useState([]);
  const [launchLeft, setLaunchLeft] = useState("48:00:00");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAsk, setAiAsk] = useState("");
  const [done, setDone] = useState({});
  const [inbox, setInbox] = useState([]);
  const [report, setReport] = useState(null);
  const [proPop, setProPop] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookSvc, setBookSvc] = useState(null);   // service being booked
  const [bookMember, setBookMember] = useState(null);
  const [bookPhone, setBookPhone] = useState("");
  const [reply, setReply] = useState("");
  const [dailyBudget, setDailyBudget] = useState(500);
  const [bookedOk, setBookedOk] = useState(null);   // confirmed booking for green banner
  const [themeOrder, setThemeOrder] = useState(null); // { orderId, tid, name, url } after purchase
  const [moreOpen, setMoreOpen] = useState(false);
  const chatEndRef = useRef(null);
  const chatFileRef = useRef(null);
  const [chatFile, setChatFile] = useState(null);
  const [chatSending, setChatSending] = useState(false);
  useEffect(() => {
    if (tab === "Messages") setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" }), 60);
  }, [tab, inbox]);
  const configured = supabaseConfigured();

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

  useEffect(() => {
    if (!active) return;
    try { setDone(JSON.parse(window.localStorage.getItem("ds_plan_" + active) || "{}")); } catch { setDone({}); }
    try {
      const raw = window.localStorage.getItem("ds_theme_order_" + active);
      const saved = raw ? JSON.parse(raw) : null;
      setThemeOrder(saved);
      if (saved?.orderId && saved?.tid && !saved.url) {
        api("confirmTheme", { orderId: saved.orderId, themeId: saved.tid, quiet: true }).then((r) => {
          if (r?.url) setThemeOrder((t) => t ? { ...t, url: r.url } : t);
        }).catch(() => {});
      }
    } catch { setThemeOrder(null); }
  }, [active]);

  // Pro upgrade popup — fires once per day, 20s after a free-plan store loads.
  useEffect(() => {
    const s = sites.find((x) => x.id === active);
    if (!s || s.is_pro) return;
    const today = new Date().toDateString();
    try { if (window.localStorage.getItem("ds_pro_pop") === today) return; } catch {}
    const t = setTimeout(() => {
      setProPop(true);
      try { window.localStorage.setItem("ds_pro_pop", today); } catch {}
    }, 20000);
    return () => clearTimeout(t);
  }, [active, sites]);
  const toggleDone = (label) => {
    setDone((d) => {
      const next = { ...d, [label]: !d[label] };
      try { window.localStorage.setItem("ds_plan_" + active, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const loadInbox = useCallback(async () => {
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.from("admin_messages").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) data.reverse();
    if (data) setInbox(data);
  }, []);
  // Live message polling — new admin messages light up the Chat badge without a reload
  useEffect(() => {
    if (!user) return;
    const id = setInterval(loadInbox, 25000);
    const onVis = () => { if (!document.hidden) loadInbox(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [user, loadInbox]);

  useEffect(() => {
    if (tab !== "Messages") return;
    const unread = inbox.filter((m) => !m.read_at && m.sender !== "user");
    if (!unread.length) return;
    const sb = getSupabase(); if (!sb) return;
    const now = new Date().toISOString();
    sb.from("admin_messages").update({ read_at: now }).is("read_at", null).neq("sender", "user").then(() => {
      setInbox((ms) => ms.map((m) => m.read_at || m.sender === "user" ? m : { ...m, read_at: now }));
    });
  }, [tab, inbox]);

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
  const loadBookings = useCallback(async () => {
    const r = await api("myBookings");
    if (r?.bookings) setBookings(r.bookings);
  }, [api]);
  useEffect(() => { if (user) loadBookings(); }, [user, loadBookings]);
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

  const scanQueuedRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const unlockUrl = params.get("unlock");
    if (orderId && unlockUrl && !scanQueuedRef.current) {
      scanQueuedRef.current = true;
      track("Purchase", { value: 799, currency: "INR", content_name: "Growth Plan" });
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
    const themeOrderId = params.get("theme_order");
    if (themeOrderId && !scanQueuedRef.current) {
      scanQueuedRef.current = true;
      const tid = params.get("tid") || "";
      track("Purchase", { value: 0, currency: "INR", content_name: "Theme " + (params.get("tid") || ""), content_type: "theme" });
      window.history.replaceState({}, "", "/dashboard");
      const rec = { orderId: themeOrderId, tid, name: tid };
      setThemeOrder(rec);
      setTab("Theme Audit");
      (async () => {
        const r = await api("confirmTheme", { orderId: themeOrderId, themeId: tid }).catch(() => null); // verifies + emails the zip link
        const next = { orderId: themeOrderId, tid, name: r?.theme?.name || tid, url: r?.url || null };
        setThemeOrder(next);
        if (active) { try { window.localStorage.setItem("ds_theme_order_" + active, JSON.stringify(next)); } catch {} }
      })();
      return;
    }

    const bookingId = params.get("booking");
    if (bookingId && orderId && !scanQueuedRef.current) {
      scanQueuedRef.current = true;
      track("Purchase", { currency: "INR", content_name: "Service Booking", content_type: "service" });
      window.history.replaceState({}, "", "/dashboard");
      (async () => {
        setBusy("unlocking");
        try {
          const r = await api("confirmBooking", { booking_id: bookingId, orderId });
          if (r.ok) { await loadBookings(); setTab("Services"); setBookedOk(r.booking); }
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
            setActive(r.site.id); setTab("Overview");
            const d = await scan(r.site.url);
            if (d) { await api("saveScan", { site_id: r.site.id, scores: d.pagespeed?.scores, checks: d.seo?.checks }); track("Lead", { content_name: "Store Scan", content_category: "scan" }); }
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
    try { const d = await scan(siteUrl); if (d) { await api("saveScan", { site_id: siteId, scores: d.pagespeed?.scores, checks: d.seo?.checks }); track("Lead", { content_name: "Store Re-scan", content_category: "scan" }); await loadData(); } }
    finally { setBusy(""); }
  }
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
  function generateFix(label) {
    setAiAsk(`How do I fix this on my store: ${label}? Give me exact steps and code if needed.`);
    setAiOpen(true);
  }
  async function openReport(id) {
    setBusy("report");
    const r = await api("getReport", { report_id: id });
    setBusy("");
    if (r?.payload) { setReport(r.payload); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else alert(r?.error || "Could not load the report.");
  }
  function downloadInstallFile(text) {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ds-cro.liquid";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function buyTheme(themeId) {
    setBusy("theme-" + themeId);
    try {
      const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: activeSite.url, product: "theme", themeId, returnTo: "dashboard-theme" }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error((json && json.error) || "Could not start checkout.");
      await loadCashfreeSDK();
      const cashfree = window.Cashfree({ mode: json.env === "production" ? "production" : "sandbox" });
      cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { alert(e.message); setBusy(""); }
  }
  async function payAdvance() {
    if (!bookSvc || !bookMember) return;
    const digits = bookPhone.replace(/\D/g, "");
    if (digits.length < 10) { alert("Please enter a valid 10-digit phone number."); return; }
    setBusy("booking");
    try {
      const r = await api("bookService", { service_key: bookSvc.key, member_id: bookMember.id, phone: bookPhone, site_id: active });
      if (!r?.paymentSessionId) throw new Error(r?.error || "Could not start checkout.");
      await loadCashfreeSDK();
      const cashfree = window.Cashfree({ mode: r.env === "production" ? "production" : "sandbox" });
      cashfree.checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { alert(e.message); setBusy(""); }
  }
  async function sendReply() {
    const t = reply.trim();
    if (!t && !chatFile) return;
    const sb = getSupabase(); if (!sb || !user) return;
    setChatSending(true);
    let file_url = null, file_name = null;
    try {
      if (chatFile) {
        const path = `${user.id}/${Date.now()}_${chatFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await sb.storage.from("chat-files").upload(path, chatFile);
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from("chat-files").getPublicUrl(path);
        file_url = pub?.publicUrl || null; file_name = chatFile.name;
      }
      const { data, error } = await sb.from("admin_messages").insert({ user_id: user.id, title: "", body: t || (file_name ? "📎 " + file_name : ""), kind: "note", sender: "user", read_at: new Date().toISOString(), file_url, file_name }).select().single();
      if (error) throw error;
      setInbox((ms) => [...ms, data]); setReply(""); setChatFile(null);
    } catch {
      alert("Could not send — try again. (If this keeps failing, the v20 database update may not be applied.)");
    } finally { setChatSending(false); }
  }

  if (loading) return <div className="gcc"><div className="gcc-load">Loading your Growth Workspace…</div></div>;
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
      <h2>Your Growth Workspace</h2>
      <p>Log in to see how much revenue your store is leaking, why, and exactly what to fix next.</p>
      <button className="g-btn-primary" onClick={() => setAuthOpen(true)}>Log in / Sign up</button>
      <a className="gcc-back" href="/">← Back to free scanner</a>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={setUser} />}
    </div></div>
  );

  /* ===== Derived growth data ===== */
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
  const conf = confidenceScore(checks);
  const planItems = priority.slice(0, 6);
  const doneCount = planItems.filter((c) => done[c.label]).length;
  const planPct = planItems.length ? Math.round((doneCount / planItems.length) * 100) : 0;
  const recovered = failed.filter((c) => done[c.label]).reduce((a, c) => a + (perCheck[c.label] || 0), 0);
  const remaining = Math.max(0, (recovery || 0) - recovered);
  const projected = latest ? Math.min(100, (latest.overall || 0) + Math.min(28, failed.length * 3) + 4) : null;
  const apps = recommendApps(failed, latest?.scores);
  const adReadiness = latest ? Math.round(((latest.scores?.performance || 0) * 0.4 + (conversion || 0) * 0.4 + (latest.scores?.seo || 0) * 0.2)) : null;
  const adsRisk = adReadiness == null ? null : adReadiness >= 75 ? { lvl: "Low", cls: "ok", note: "Your store converts well enough to scale paid traffic profitably." } : adReadiness >= 55 ? { lvl: "Medium", cls: "warn", note: `Run small budgets while you close the gaps — roughly ${inr(Math.round((leak || 0) * 0.2 / 500) * 500)}/mo of ad spend would currently be wasted on conversion leaks.` } : { lvl: "High", cls: "crit", note: `Fix your leaks before spending — an estimated ${inr(Math.round((leak || 0) * 0.35 / 500) * 500)}/mo of ad spend would be burned by your current conversion gaps.` };
  const themeBlockers = failed.filter((c) => c.cat === "cro");
  const themeScore = latest ? Math.round((conversion || 0) * 0.6 + (latest.scores?.performance || 0) * 0.4) : null;
  const heroMood = !latest ? "" : latest.overall >= 70 ? "" : latest.overall >= 50 ? "warn" : "crit";
  const status = !latest ? "Not scanned yet" : latest.overall >= 85 ? "Excellent — ready to scale" : latest.overall >= 70 ? "Good but losing conversions" : latest.overall >= 50 ? "Leaking revenue — fix soon" : "Critical — losing buyers daily";
  const chatContext = latest ? { url: activeSite?.url, scores: latest.scores, conversion, confidence: conf.score, failed: failed.map((c) => c.label).slice(0, 12), leak } : null;
  const recommendedService = !latest ? null : (latest.scores?.performance || 0) < 55 ? "speed" : (conversion || 0) < 55 ? "cro" : (latest.scores?.seo || 0) < 70 ? "seo" : "ads";

  const activity = [
    ...siteScans.slice(0, 6).map((s, i) => {
      const older = siteScans[i + 1];
      const d = older ? s.overall - older.overall : null;
      return { t: s.created_at, ic: d != null && d > 0 ? "trend" : "search", text: d != null && d !== 0 ? `Scan completed — growth score ${d > 0 ? "up" : "down"} ${Math.abs(d)} pts to ${s.overall}` : `Store scanned — growth score ${s.overall}` };
    }),
    ...siteReports.map((r) => ({ t: r.created_at, ic: "gift", text: "Growth Plan unlocked — recommendations saved to this account" })),
  ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);

  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const unread = inbox.filter((m) => !m.read_at && m.sender !== "user").length;

  return (
    <div className="gcc">
      <aside className="g-side">
        <a href="/" className="g-logo">DIGI<span>STICK</span><i>GROWTH OS</i></a>
        <div className="g-site-pick">
          {sites.map((s) => (
            <button key={s.id} className={`g-site ${active === s.id ? "on" : ""}`} onClick={() => { setActive(s.id); setTab("Overview"); setCompData(null); }}>
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
              <span className="gni-ic"><I n={ic} size={16} /></span>{t}
              {t === "Priority Fixes" && failed.length > 0 && <span className="gni-badge">{failed.length}</span>}
              {t === "Messages" && unread > 0 && <span className="gni-badge">{unread}</span>}
              {["Theme Audit", "App Stack", "Ads Strategy", "History", "Settings"].includes(t) && !isPro && <span className="gni-lock"><I n="lock" size={12} /></span>}
            </button>
          ))}
        </nav>
        <div className="g-side-foot">
          {activeSite && !isPro && (
            <div className="g-plan">
              <div className="g-plan-tag">FREE PLAN</div>
              <p>Unlock your full Growth Plan — fixes, history, AI consultant.</p>
              <div className="g-plan-price"><s>₹1,499</s> ₹799</div>
              <div className="g-plan-timer">Launch price ends in {launchLeft}</div>
              <button className="g-btn-accent" onClick={() => unlockPro(activeSite.url)}>Upgrade now</button>
            </div>
          )}
          {activeSite && isPro && <div className="g-plan pro"><div className="g-plan-tag ok">PRO ACTIVE</div><p>All growth features unlocked for this store.</p></div>}
          <div className="g-acct"><span>{user.email}</span><button onClick={logout}>Log out</button></div>
        </div>
      </aside>

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
              <button className="g-rescan" onClick={() => runScan(activeSite.url, activeSite.id)} disabled={busy === "scanning"}><I n="refresh" size={14} /> Re-scan now</button>
            </div>

            {!latest && tab !== "Settings" && <div className="g-empty"><h3>No scan yet</h3><p>Hit &quot;Re-scan now&quot; to run the first audit on this store.</p></div>}

            {/* ============ OVERVIEW ============ */}
            {latest && tab === "Overview" && (
              <>
                <div className={`g-hero ${heroMood}`}>
                  <div className="g-hero-l">
                    <div className="g-hero-alert"><span className="g-pulse" /> REVENUE LEAK ALERT</div>
                    <div className="g-hero-leak">{inr(leak)}<span>/month</span></div>
                    <div className="g-hero-rec">Potential recovery <b>+{inr(recovery)}/month</b></div>
                    <div className="g-hero-status">Store status: <b>{status}</b></div>
                    <div className="g-hero-ctas">
                      <button className="g-btn-accent" onClick={() => go("Priority Fixes")}>Fix My Store</button>
                      {!isPro
                        ? <button className="g-btn-ghost" onClick={() => unlockPro(activeSite.url)}>Open Growth Plan</button>
                        : <button className="g-btn-ghost" onClick={() => go("Growth Plan")}>Open Growth Plan</button>}
                      <a className="g-btn-ghost" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book Digistick</a>
                    </div>
                  </div>
                  <div className="g-hero-r">
                    <Gauge value={latest.overall} size={150} stroke={11} light />
                    {delta != null && <div className={`g-delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs last scan</div>}
                  </div>
                </div>

                <div className="g-cards4 g-swipe">
                  {[
                    ["zap", "Speed Score", latest.scores?.performance, `Revenue impact ~${inr(Math.round((leak || 0) * 0.3 / 500) * 500)}/mo`, "Recovery: fix images & scripts"],
                    ["search", "SEO Score", latest.scores?.seo, "Traffic potential: +25-40% organic", "Metas, schema & structure"],
                    ["cart", "Conversion Score", conversion, `Potential sales increase +${Math.max(5, Math.round((100 - (conversion || 0)) / 3))}%`, `${themeBlockers.length} CRO gaps open`],
                    ["mobile", "Mobile Experience", mobile, `Mobile revenue impact ~${inr(Math.round((leak || 0) * 0.45 / 500) * 500)}/mo`, "70%+ of Indian D2C traffic is mobile"],
                  ].map(([ic, lbl, v, impact, sub]) => (
                    <div className="g-card g-score" key={lbl}>
                      <div className="g-score-top"><span className="g-score-ic"><I n={ic} size={20} /></span><span className="g-score-band" style={{ color: color(v) }}>{band(v)}</span></div>
                      <div className="g-score-v" style={{ color: color(v) }}>{v ?? "—"}<span>/100</span></div>
                      <div className="g-score-l">{lbl}</div>
                      <div className="g-score-bar"><span style={{ width: (v || 0) + "%", background: color(v) }} /></div>
                      <div className="g-score-impact">{impact}</div>
                      <div className="g-score-sub">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Recovery tracker + Purchase confidence */}
                <div className="g-2col">
                  <div className="g-card">
                    <div className="g-card-h"><h3>Recovery tracker</h3><span className="g-chip">{planPct}% of plan done</span></div>
                    <div className="g-recov">
                      <div className="g-recov-item"><span>Recovered so far</span><b style={{ color: "var(--g-success)" }}>{inr(recovered)}</b></div>
                      <div className="g-recov-item"><span>Remaining opportunity</span><b style={{ color: "var(--g-danger)" }}>{inr(remaining)}</b></div>
                      <div className="g-recov-item"><span>Growth score today</span><b>{latest.overall}</b></div>
                      <div className="g-recov-item"><span>Projected after fixes</span><b style={{ color: "var(--g-primary)" }}>{projected}</b></div>
                    </div>
                    <div className="g-progress"><span style={{ width: planPct + "%" }} /><i>{planPct}% complete</i></div>
                    <button className="g-link" onClick={() => go("Priority Fixes")}>Continue fixing <I n="arrowRight" size={13} /></button>
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Purchase confidence score</h3></div>
                    <div className="g-conf">
                      <Gauge value={conf.score} size={110} label="Buyer trust" />
                      <div className="g-conf-r">
                        <p className="g-dim">{conf.score == null ? "Not enough trust signals detected to score." : conf.score >= 75 ? "Buyers see strong trust signals on your store." : `Weak trust signals are costing you an estimated ${inr(Math.round((leak || 0) * 0.35 / 500) * 500)}/mo in abandoned purchases.`}</p>
                        {conf.rel.slice(0, 4).map((c) => (
                          <div className={`g-conf-row ${c.ok ? "ok" : ""}`} key={c.label}><I n={c.ok ? "check" : "x"} size={13} /> {c.label}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="g-2col">
                  <div className="g-card">
                    <div className="g-card-h"><h3>Today&apos;s action plan</h3><span className="g-chip">{doneCount}/{planItems.length} done</span></div>
                    {planItems.length === 0 && <div className="g-empty sm"><p>Every check passed — your store is in great shape. Re-scan weekly to keep it that way.</p></div>}
                    <MaybeBlur locked={!isPro} compact title="Unlock your action plan" timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
                    {planItems.map((c) => (
                      <label className={`g-task ${done[c.label] ? "done" : ""}`} key={c.label}>
                        <input type="checkbox" checked={!!done[c.label]} onChange={() => toggleDone(c.label)} />
                        <div className="g-task-body"><b>{c.label}</b><span>{c.detail}</span></div>
                        <span className="g-task-rec">+{inr(perCheck[c.label])}<i>recovery</i></span>
                      </label>
                    ))}
                    </MaybeBlur>
                    {failed.length > 0 && <button className="g-link" onClick={() => go("Priority Fixes")}>Open all {failed.length} fixes <I n="arrowRight" size={13} /></button>}
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Recent activity</h3></div>
                    <div className="g-timeline">
                      {activity.length === 0 && <p className="g-dim">Activity will appear here as you scan and fix.</p>}
                      {activity.map((a, i) => (
                        <div className="g-tl-item" key={i}>
                          <span className="g-tl-ic"><I n={a.ic} size={14} /></span>
                          <div><p>{a.text}</p><time>{new Date(a.t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div>
                        </div>
                      ))}
                    </div>
                    <div className="g-card-h" style={{ marginTop: 18 }}><h3>Score trend</h3>{!isPro && <span className="g-lock">PRO</span>}</div>
                    {isPro ? <Spark scans={siteScans} /> : <button className="g-trend-locked" onClick={() => unlockPro(activeSite.url)}>Unlock Pro to track your score over time</button>}
                  </div>
                </div>
              </>
            )}

            {/* ============ PRIORITY FIXES ============ */}
            {latest && tab === "Priority Fixes" && (
              <>
                <div className="g-sec-h"><h2>Priority fixes</h2><p>Estimated {inr(leak)}/month at stake · {failed.length} open issue{failed.length !== 1 ? "s" : ""} · ranked by revenue impact</p></div>
                <div className="g-progress big"><span style={{ width: planPct + "%" }} /><i>{planPct}% of your top plan complete · {inr(recovered)} recovered</i></div>
                {priority.length === 0 && <div className="g-empty"><h3>No open fixes</h3><p>Every check passed on the last scan.</p></div>}
                <MaybeBlur locked={!isPro} title={`Unlock all ${failed.length} fixes`} sub="See every issue with step-by-step fixes, difficulty, time and revenue recovery — written for your store." timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
                {priority.map((c, i) => {
                  const diff = difficultyOf(c);
                  return (
                    <div className="g-leak" key={c.label}>
                      <label className="g-leak-check"><input type="checkbox" checked={!!done[c.label]} onChange={() => toggleDone(c.label)} /></label>
                      <span className="g-rank">{i + 1}</span>
                      <div className="g-leak-body">
                        <b>{c.label}</b><span>{c.detail}</span>
                        <div className="g-fix-meta">
                          <span className={`g-impact ${(c.weight || 1) >= 3 ? "high" : (c.weight || 1) >= 2 ? "med" : "low"}`}>{(c.weight || 1) >= 3 ? "High" : (c.weight || 1) >= 2 ? "Medium" : "Low"} impact</span>
                          <span className="g-diff"><I n="scale" size={12} /> {diff}</span>
                          <span className="g-diff"><I n="clock" size={12} /> {TIME_OF[diff]}</span>
                        </div>
                        {(c.fix || c.why) && <details><summary>How to fix</summary><p>{c.why ? <><b>Why it matters:</b> {c.why}<br /></> : null}<b>Fix:</b> {c.fix || "Open the relevant section in your store editor and apply the change. The Rs 799 Growth Plan gives you copy-paste code for this."}</p></details>}
                      </div>
                      <div className="g-leak-meta">
                        <span className="g-task-rec">+{inr(perCheck[c.label])}<i>recovery</i></span>
                        <button className="g-genfix" onClick={() => isPro ? generateFix(c.label) : unlockPro(activeSite.url)}><I n="bot" size={13} /> Generate fix</button>
                      </div>
                    </div>
                  );
                })}
                </MaybeBlur>
                {!isPro && failed.length > 0 && (
                  <div className="g-upsell"><div><b>Want these fixed for you?</b><p>The Rs 799 Growth Plan writes your fixes, gives you an install-ready Shopify file, and a 14-day plan.</p></div><button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Unlock Growth Plan — ₹799</button></div>
                )}
                {passed.length > 0 && <div className="g-card"><div className="g-card-h"><h3>Passing ({passed.length})</h3></div><div className="g-passes">{passed.map((c) => <span key={c.label}><I n="check" size={11} /> {c.label}</span>)}</div></div>}
              </>
            )}

            {/* ============ THEME AUDIT ============ */}
            {latest && tab === "Theme Audit" && (
              <MaybeBlur locked={!isPro} title="Theme audit is locked" sub="Your theme score, every conversion blocker, and how it compares against Digistick themes." timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
              <>
                {themeOrder && (
                  <div className="g-success">
                    <span className="g-success-ic"><I n="check" size={16} /></span>
                    <div><b>{themeOrder.name ? `Theme "${themeOrder.name}" unlocked — sent to your email` : "Theme unlocked — sent to your email"}</b><p>The download link is in your inbox (valid 7 days). Install via Shopify &rarr; Online Store &rarr; Themes &rarr; Add theme.</p></div>
                    {themeOrder.url && <a className="g-btn-success" href={themeOrder.url} target="_blank" rel="noopener noreferrer"><I n="download" size={14} /> Download now</a>}
                  </div>
                )}
                <div className="g-sec-h"><h2>Theme audit</h2><p>How much your current theme is helping — or costing — your conversions.</p></div>
                <div className="g-2col">
                  <div className="g-card g-ads-ready">
                    <div className="g-card-h"><h3>Current theme score</h3></div>
                    <div className="g-ads-gauge"><Gauge value={themeScore} size={120} label="Theme score" /></div>
                    <p className="g-dim center">{themeScore == null ? "Scan your store to score the theme." : themeScore >= 75 ? "Your theme covers most conversion essentials. Optimize content next." : `Your theme is missing key conversion elements — estimated impact ~${inr(Math.round((leak || 0) * 0.45 / 500) * 500)}/mo.`}</p>
                    <CompareBar label="Theme conversion readiness" you={themeScore} them={88} themLabel="Digistick themes" />
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Conversion blockers in your theme</h3><span className="g-chip">{themeBlockers.length} found</span></div>
                    {themeBlockers.length === 0 && <p className="g-dim">No theme-level conversion blockers detected.</p>}
                    {themeBlockers.map((c) => (
                      <div className="g-row" key={c.label}><span className="g-blocker"><I n="x" size={12} /></span><div><b>{c.label}</b><span>{c.detail}</span></div><span className="g-task-rec">+{inr(perCheck[c.label])}<i>est/mo</i></span></div>
                    ))}
                  </div>
                </div>
                <div className="g-card-h free"><h3>Digistick theme marketplace</h3><span className="g-chip">20 themes · ₹3,999–₹6,999</span></div>
                <p className="tm-note"><I n="shield" size={13} /> All themes below are <b>built by the Digistick team</b>. Previews show the design direction each build is inspired by — we do not sell or redistribute third-party themes; design ideas only, with our own code. Setup support included with every purchase.</p>
                <div className="tm-grid">
                  {THEMES_CATALOG.map((t) => {
                    const rec = recommendThemes(latest.scores?.performance, conversion).includes(t.id);
                    return (
                      <div className={`g-card tm-tile ${rec ? "rec" : ""}`} key={t.id}>
                        <div className={`tm-thumb ${t.grad}`}>{rec && <span className="tm-rec">★ Recommended for you</span>}<b>{t.name}</b><span>{t.bestFor}</span></div>
                        <div className="tm-body">
                          <div className="tm-meta"><b>{inr(t.price)}</b><span className="tm-tags">{t.strengths.map((x) => <i key={x}>{x === "speed" ? "Fast" : x === "conversion" ? "High-CRO" : "Visual"}</i>)}</span></div>
                          <div className="g-app-actions">
                            <a className="g-btn-ghost dark" href={t.preview} target="_blank" rel="noopener noreferrer">Preview</a>
                            <button className="g-btn-primary sm" onClick={() => buyTheme(t.id)} disabled={busy === "theme-" + t.id}>{busy === "theme-" + t.id ? "Opening…" : `Buy ${inr(t.price)}`}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
              </MaybeBlur>
            )}

            {/* ============ APP STACK ============ */}
            {latest && tab === "App Stack" && (
              <MaybeBlur locked={!isPro} title="App stack audit is locked" sub="What your store covers and the exact apps that close your gaps — with revenue estimates." timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
              <>
                <div className="g-sec-h"><h2>App stack audit</h2><p>What your store already covers, and the apps that close the gaps found in your scan.</p></div>
                <div className="g-card" style={{ marginBottom: 18 }}>
                  <div className="g-card-h"><h3>Already covered</h3><span className="g-chip">{passed.filter((c) => c.cat === "cro").length} elements</span></div>
                  <div className="g-passes">{passed.filter((c) => c.cat === "cro").map((c) => <span key={c.label}><I n="check" size={11} /> {c.label}</span>)}
                  {passed.filter((c) => c.cat === "cro").length === 0 && <p className="g-dim">No conversion elements detected yet — the apps below are your starting stack.</p>}</div>
                </div>
                <div className="g-card-h free"><h3>Recommended for your gaps</h3></div>
                <div className="g-apps">
                  {apps.map((a) => (
                    <div className="g-card g-app" key={a.name}>
                      <div className="g-app-top"><span className="g-app-ic"><I n={a.ic} size={17} /></span><b>{a.name}</b><span className="g-app-impact">Impact {a.impact}/10</span></div>
                      <p>{a.why}</p>
                      <div className="g-app-meta"><span>Difficulty: <b>{a.diff}</b></span><span>Est. gain: <b>{a.gain}</b></span></div>
                      <div className="g-app-actions">
                        <a className="g-btn-ghost dark" href={a.link} target="_blank" rel="noopener noreferrer">Install app</a>
                        <a className="g-btn-primary sm" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Get Digistick to install</a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
              </MaybeBlur>
            )}

            {/* ============ ADS STRATEGY ============ */}
            {latest && tab === "Ads Strategy" && (
              <MaybeBlur locked={!isPro} title="Ads strategy is locked" sub="Ad readiness, spend-risk analysis, budget calculator, audiences, hooks and a 4-week scaling plan." timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
              <>
                <div className="g-sec-h"><h2>Ads strategy center</h2><p>Built from your store&apos;s readiness — fix conversion gaps before scaling spend.</p></div>
                <div className="g-2col">
                  <div className="g-card g-ads-ready">
                    <div className="g-card-h"><h3>Ad readiness score</h3></div>
                    <div className="g-ads-gauge"><Gauge value={adReadiness} size={120} /></div>
                    {adsRisk && <div className={`g-risk ${adsRisk.cls}`}><I n="alert" size={14} /> Ad spend risk: <b>{adsRisk.lvl}</b></div>}
                    <p className="g-dim center">{adsRisk?.note}</p>
                    <div className="g-budget"><I n="money" size={15} /> Recommended starting budget <b>₹500/day</b></div>
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3>Campaign structure</h3></div>
                    {[["Cold campaign", "60% budget · broad + interest audiences", "Objective: purchases. Test 3 creatives, kill losers in 4 days."],
                      ["Retargeting", "25% budget · site visitors & cart abandoners", "Urgency + social-proof angles. Your COD/return badges matter most here."],
                      ["Lookalike", "15% budget · 1-3% of purchasers", "Switch on only after 50+ purchases for a clean seed audience."]].map(([t, a, d]) => (
                      <div className="g-row" key={t}><div><b>{t}</b><span>{a}</span><span className="g-dim">{d}</span></div></div>
                    ))}
                  </div>
                </div>
                <div className="g-cards3">
                  <div className="g-card"><div className="g-card-h"><h3><I n="target" size={15} /> Suggested audiences</h3></div><ul className="g-list"><li>Interest stacks around your niche + online shopping</li><li>Engaged Instagram shoppers, 24-44</li><li>Cart abandoners (7-day window)</li><li>Past buyers — for upsell campaigns</li></ul></div>
                  <div className="g-card"><div className="g-card-h"><h3><I n="image" size={15} /> Creative angles</h3></div><ul className="g-list"><li>Problem to product demo in first 3 seconds</li><li>UGC unboxing with COD trust callout</li><li>Founder story — why you built this</li><li>Before/after or social-proof compilation</li></ul></div>
                  <div className="g-card"><div className="g-card-h"><h3><I n="zap" size={15} /> Video hooks</h3></div><ul className="g-list"><li>&quot;I stopped buying ___ from big brands because…&quot;</li><li>&quot;POV: your ___ finally arrives and it&apos;s actually good&quot;</li><li>&quot;3 signs you&apos;re overpaying for ___&quot;</li><li>&quot;Don&apos;t buy ___ before watching this&quot;</li></ul></div>
                </div>
                <div className="g-2col">
                  <div className="g-card">
                    <div className="g-card-h"><h3><I n="money" size={15} /> Budget calculator</h3></div>
                    <div className="g-budget-input"><span>Daily budget</span><input type="number" min="200" step="100" value={dailyBudget} onChange={(e) => setDailyBudget(Math.max(0, parseInt(e.target.value) || 0))} /><span>₹/day</span></div>
                    {[["Cold campaign", 0.6], ["Retargeting", 0.25], ["Lookalike", 0.15]].map(([n, p]) => (
                      <div className="g-row" key={n}><div><b>{n}</b><span>{Math.round(p * 100)}% of budget</span></div><span className="g-task-rec">{inr(Math.round(dailyBudget * p))}<i>/day</i></span></div>
                    ))}
                    <div className="g-budget" style={{ marginTop: 12 }}><I n="calendar" size={14} /> Monthly total <b>{inr(dailyBudget * 30)}</b></div>
                  </div>
                  <div className="g-card">
                    <div className="g-card-h"><h3><I n="target" size={15} /> KPI targets to hold</h3></div>
                    {[["ROAS", "3x or higher", "Below 2x after 7 days = kill the ad set"],
                      ["CPA", "Under 25% of your AOV", "Your profit ceiling — calculate before launch"],
                      ["CTR", "1.5%+ on cold traffic", "Below 1% means the creative, not the audience"],
                      ["CPM", "₹80–₹250 typical (IN)", "Spikes usually mean audience fatigue — refresh creatives"]].map(([k, v, d]) => (
                      <div className="g-row" key={k}><div><b>{k}: {v}</b><span>{d}</span></div></div>
                    ))}
                  </div>
                </div>
                <div className="g-card" style={{ marginBottom: 18 }}>
                  <div className="g-card-h"><h3><I n="trend" size={15} /> 4-week scaling plan</h3></div>
                  {[["Week 1", "Launch 3 creatives at ₹" + Math.round(dailyBudget) + "/day total. Touch nothing for 4 days — let the algorithm learn."],
                    ["Week 2", "Kill ad sets under 2x ROAS. Move their budget to the winner. Launch 2 new hooks against it."],
                    ["Week 3", "Switch on retargeting (site visitors + cart abandoners) with urgency + social-proof angles."],
                    ["Week 4", "If 50+ purchases: launch 1–3% lookalike. Raise winning budgets by 20% every 3 days — never double overnight."]].map(([w, d]) => (
                    <div className="g-row" key={w}><span className="rp-day-n">{w}</span><div><span style={{ fontSize: 12.5, color: "var(--g-ink)" }}>{d}</span></div></div>
                  ))}
                </div>
                <div className="g-upsell"><div><b>Want ads run by professionals?</b><p>Digistick manages full-funnel Meta campaigns for D2C brands — creatives, audiences, scaling.</p></div><button className="g-btn-primary" onClick={() => go("Services")}>Book Meta Ads Management</button></div>
              </>
              </MaybeBlur>
            )}

            {/* ============ COMPETITORS ============ */}
            {tab === "Competitors" && (
              <>
                <div className="g-sec-h"><h2>Competitor center</h2><p>Compare against any store, plus the industry average for D2C.</p></div>
                <div className="g-card">
                  <div className="g-comp-input"><input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCompetitor()} placeholder="competitor.com" /><button className="g-btn-primary" onClick={runCompetitor} disabled={busy === "comp"}>{busy === "comp" ? "Scanning…" : "Compare"}</button></div>
                  {latest && (
                    <div className="g-compare">
                      {[["Speed", "performance"], ["SEO", "seo"], ["Accessibility", "accessibility"], ["Best practices", "bestPractices"]].map(([lbl, key]) => (
                        <CompareBar key={key} label={lbl} you={latest.scores?.[key]} them={compData ? compData.scores?.[key] : INDUSTRY[key]} themLabel={compData ? hostOf(compData.url) : "Industry avg"} />
                      ))}
                      <CompareBar label="Conversion readiness" you={conversion} them={compData ? Math.round(((compData.scores?.performance || 50) + (compData.scores?.bestPractices || 60)) / 2) : INDUSTRY.conversion} themLabel={compData ? hostOf(compData.url) : "Industry avg"} />
                      <CompareBar label="Mobile UX" you={mobile} them={compData ? Math.max(5, Math.round((compData.scores?.performance || 50) * 0.9 + (compData.scores?.bestPractices || 60) * 0.1)) : INDUSTRY.mobile} themLabel={compData ? hostOf(compData.url) : "Industry avg"} />
                      <CompareBar label="Trust score" you={conf.score} them={compData ? 65 : 65} themLabel={compData ? hostOf(compData.url) + " (est.)" : "Industry avg"} />
                    </div>
                  )}
                  {!latest && <p className="g-dim">Scan your store first to enable comparison.</p>}
                </div>
              </>
            )}

            {/* ============ SERVICES ============ */}
            {tab === "Services" && (
              <>
                <div className="g-sec-h"><h2>Digistick services</h2><p>Done-for-you growth. Pick a specialist, pay a 30% advance, and your booking lands with our team instantly.</p></div>

                {bookedOk && (
                  <div className="g-success">
                    <span className="g-success-ic"><I n="check" size={16} /></span>
                    <div><b>Booking confirmed — advance paid</b><p>{bookedOk.service_name} with {bookedOk.member_name} is locked in. Our team will call you within 24 hours for kickoff.</p></div>
                    <button className="g-success-x" onClick={() => setBookedOk(null)}><I n="x" size={13} /></button>
                  </div>
                )}
                {bookings.length > 0 && (
                  <div className="g-card" style={{ marginBottom: 18 }}>
                    <div className="g-card-h"><h3><I n="calendar" size={15} /> My bookings</h3></div>
                    {bookings.map((b) => (
                      <div className="g-row" key={b.id}>
                        <div><b>{b.service_name}</b><span>with {b.member_name} · booked {new Date(b.created_at).toLocaleDateString("en-IN")}</span></div>
                        <div className="bk-right">
                          <span className={`bk-status ${b.status}`}>{b.status === "pending" ? "Awaiting payment" : b.status === "paid" ? "Paid — pending confirmation" : b.status === "confirmed" ? "Confirmed" : b.status === "completed" ? "Completed" : "Cancelled"}</span>
                          <span className="g-dim">{inr(b.advance_amount)} advance · {inr(b.price)} total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="g-services">
                  {SERVICES_CATALOG.map((s2) => (
                    <div className={`g-card g-service ${s2.cls} ${recommendedService === s2.key ? "rec" : ""}`} key={s2.key}>
                      {recommendedService === s2.key && <span className="g-sv-rec">Recommended for you</span>}
                      <span className="g-sv-ic"><I n={s2.ic} size={17} /></span>
                      <b>{s2.name}</b><p>{s2.desc}</p>
                      <div className="g-sv-foot"><span>Starts from {inr(s2.start)}</span><button className="g-sv-book" onClick={() => { setBookSvc(s2); setBookMember(null); }}>Book <I n="arrowRight" size={12} /></button></div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ============ MESSAGES ============ */}
            {tab === "Messages" && (
              <>
                <div className="g-sec-h chat-hide"><h2>Messages</h2><p>Chat with the Digistick team — recommendations, offers, and your replies.</p></div>
                <div className="g-card g-chatbox">
                  <div className="g-chat-head">
                    <button className="g-chat-back" onClick={() => go("Overview")} aria-label="Back"><I n="back" size={18} /></button>
                    <span className="bk-av">DS</span>
                    <div><b>Digistick Team</b><span className="g-chat-status"><i /> Online · replies within a few hours</span></div>
                    <span className="g-chat-count">{inbox.length} messages</span>
                  </div>
                  <div className="g-thread">
                    {inbox.length === 0 && <div className="g-empty sm"><p>No messages yet. Say hi — our team replies within a few hours.</p></div>}
                    {inbox.map((m) => (
                      <div className={`g-bubble ${m.sender === "user" ? "me" : "them"}`} key={m.id}>
                        {m.sender !== "user" && m.title && <div className="g-bubble-head"><span className="g-inbox-kind">{m.kind === "offer" ? "Offer" : m.kind === "recommendation" ? "Recommendation" : "Digistick"}</span></div>}
                        {m.sender !== "user" && m.title && <b>{m.title}</b>}
                        <p>{m.body}</p>
                        {m.file_url && (/\.(png|jpe?g|gif|webp)$/i.test(m.file_name || "")
                          ? <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="g-bubble-img"><img src={m.file_url} alt={m.file_name || "attachment"} /></a>
                          : <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="g-bubble-file"><I n="download" size={13} /> {m.file_name || "Attachment"}</a>)}
                        <time>{new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  {chatFile && <div className="g-attach-chip"><I n="download" size={12} /> {chatFile.name}<button onClick={() => setChatFile(null)} aria-label="Remove">✕</button></div>}
                  <div className="g-reply">
                    <input type="file" ref={chatFileRef} style={{ display: "none" }} accept="image/*,.pdf,.zip,.csv,.doc,.docx,.xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 10 * 1024 * 1024) { alert("Max file size is 10 MB."); } else setChatFile(f); } e.target.value = ""; }} />
                    <button className="g-attach-btn" onClick={() => chatFileRef.current?.click()} aria-label="Attach file"><I n="plus" size={17} /></button>
                    <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} placeholder="Type your message…" />
                    <button onClick={sendReply} disabled={chatSending}><I n="send" size={15} /></button>
                  </div>
                </div>
              </>
            )}

            {/* ============ GROWTH PLAN ============ */}
            {tab === "Growth Plan" && !report && (
              <>
                <div className="g-sec-h"><h2>Your Growth Plan</h2><p>Reports & fix-kits you&apos;ve purchased for this store — open one to see the full analysis.</p></div>
                {siteReports.length === 0 ? (
                  isPro ? <div className="g-empty sm"><p>Your purchased fix-kit will appear here.</p></div>
                    : <div className="g-upsell"><div><b>No Growth Plan yet.</b><p>Unlock the Rs 799 plan to get written fixes, a growth blueprint, and copy-paste snippets saved to your account.</p></div><button className="g-btn-primary" onClick={() => unlockPro(activeSite.url)}>Get the Growth Plan — ₹799</button></div>
                ) : siteReports.map((r) => (
                  <div className="g-card g-kit" key={r.id}><div><b>Growth Plan (fix-kit)</b><span>{new Date(r.created_at).toLocaleDateString("en-IN")} · written fixes, install file, 14-day plan</span></div><button className="g-btn-primary sm" onClick={() => openReport(r.id)} disabled={busy === "report"}>{busy === "report" ? "Opening…" : <>Open <I n="arrowRight" size={12} /></>}</button></div>
                ))}
              </>
            )}
            {tab === "Growth Plan" && report && (
              <>
                <button className="g-back" onClick={() => setReport(null)}><I n="arrowRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back to plans</button>
                <div className="g-sec-h"><h2>Growth Plan — {hostOf(activeSite.url)}</h2><p>{report.roadmap?.summary || report.summary || "Your personalized fix-kit."}</p></div>

                {report.writtenFixes && (
                  <div className="g-card rp-card">
                    <div className="g-card-h"><h3><I n="file" size={15} /> Written fixes — ready to paste</h3></div>
                    {report.writtenFixes.titles?.length > 0 && (<><div className="rp-label">SEO title options</div>{report.writtenFixes.titles.map((t, i) => <div className="rp-copy" key={i}>{t}</div>)}</>)}
                    {report.writtenFixes.metaDescription && (<><div className="rp-label">Meta description</div><div className="rp-copy">{report.writtenFixes.metaDescription}</div></>)}
                    {report.writtenFixes.faq?.length > 0 && (<><div className="rp-label">FAQ for your product pages</div>{report.writtenFixes.faq.map((f, i) => <div className="rp-faq" key={i}><b>{f.q}</b><p>{f.a}</p></div>)}</>)}
                    {report.writtenFixes.altTexts?.length > 0 && (<><div className="rp-label">Image alt-text suggestions</div>{report.writtenFixes.altTexts.map((t, i) => <div className="rp-copy" key={i}>{t}</div>)}</>)}
                  </div>
                )}

                {report.actionPlan?.days?.length > 0 && (
                  <div className="g-card rp-card">
                    <div className="g-card-h"><h3><I n="calendar" size={15} /> 14-day action plan</h3></div>
                    {report.actionPlan.days.map((d, i) => (
                      <div className="rp-day" key={i}><span className="rp-day-n">Day {d.day}</span><div><b>{d.task}</b><p>{d.why}</p></div></div>
                    ))}
                  </div>
                )}

                {report.installFile && (
                  <div className="g-card rp-card rp-install">
                    <div><div className="g-card-h" style={{ marginBottom: 4 }}><h3><I n="download" size={15} /> Install-ready Shopify file</h3></div>
                    <p className="g-dim">ds-cro.liquid — upload once in your theme to add {report.snippets?.length || "all"} CRO sections.</p></div>
                    <button className="g-btn-primary" onClick={() => downloadInstallFile(report.installFile)}>Download ds-cro.liquid</button>
                  </div>
                )}

                {report.snippets?.length > 0 && (
                  <div className="g-card rp-card">
                    <div className="g-card-h"><h3><I n="layers" size={15} /> Copy-paste CRO sections ({report.snippets.length})</h3></div>
                    {report.snippets.map((sn, i) => (
                      <details className="rp-snippet" key={i}>
                        <summary>{sn.name || sn.title || sn.id || `Section ${i + 1}`}</summary>
                        {sn.where && <p className="g-dim">{sn.where}</p>}
                        <pre>{sn.code || sn.liquid || JSON.stringify(sn, null, 2)}</pre>
                      </details>
                    ))}
                  </div>
                )}

                {report.benchmark && (
                  <div className="g-card rp-card">
                    <div className="g-card-h"><h3><I n="target" size={15} /> Competitor benchmark</h3></div>
                    {(Array.isArray(report.benchmark) ? report.benchmark : report.benchmark.rows || []).map((b, i) => (
                      <div className="g-row" key={i}><div><b>{b.metric || b.label || b.name}</b><span>{b.note || b.detail || ""}</span></div><span className="rp-bench"><b style={{ color: color(b.you ?? b.yours) }}>{b.you ?? b.yours ?? "—"}</b> vs <b>{b.top ?? b.benchmark ?? b.target ?? "—"}</b></span></div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ============ HISTORY ============ */}
            {tab === "History" && (
              <>
                <div className="g-sec-h"><h2>Score history</h2><p>Track your growth score over time and prove your fixes are working.</p></div>
                <MaybeBlur locked={!isPro} title="Score history is locked" sub="Track your growth score scan-by-scan and prove your fixes are working." timer={launchLeft} onUnlock={() => unlockPro(activeSite.url)}>
                  <div className="g-card">
                    <Spark scans={siteScans} />
                    <div className="g-hist">
                      {siteScans.map((s) => (
                        <div className="g-hist-row" key={s.id}><span>{new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><b style={{ color: color(s.overall) }}>{s.overall}</b></div>
                      ))}
                    </div>
                  </div>
                </MaybeBlur>
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

      {bookSvc && (
        <div className="pp-overlay" onClick={() => setBookSvc(null)}>
          <div className="pp-modal bk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-head">
              <div><h3>{bookSvc.name}</h3><p className="g-dim">Choose your specialist · pay just <b>30% advance</b> to book — balance after kickoff call.</p></div>
              <button className="ai-x dark" onClick={() => setBookSvc(null)}><I n="x" size={15} /></button>
            </div>
            <div className="bk-members">
              {bookSvc.members.map((m) => (
                <button key={m.id} className={`bk-member ${bookMember?.id === m.id ? "on" : ""}`} onClick={() => setBookMember(m)}>
                  <span className="bk-av">{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                  <div className="bk-m-body">
                    <b>{m.name}</b>
                    <span>{m.role}</span>
                    <div className="bk-m-meta"><span className="bk-star"><I n="star" size={11} /> {m.rating}</span><span>{m.jobs} projects</span><span><I n="clock" size={11} /> {m.days}</span></div>
                  </div>
                  <div className="bk-m-price"><b>{inr(m.price)}</b></div>
                </button>
              ))}
            </div>
            <div className="bk-phone"><I n="phone" size={15} /><input type="tel" value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} placeholder="Your phone number (for the kickoff call)" /></div>
            <button className="g-btn-danger bk-cta" onClick={payAdvance} disabled={!bookMember || busy === "booking"}>
              {busy === "booking" ? "Starting checkout…" : bookMember ? `Pay ${inr(Math.round(bookMember.price * 0.3))} advance & book ${bookMember.name.split(" ")[0]}` : "Select a specialist to continue"}
            </button>
            <div className="bk-note"><I n="shield" size={12} /> Secure Cashfree checkout · advance is fully adjustable against the final invoice · booking lands with our team instantly</div>
          </div>
        </div>
      )}

      {activeSite && latest && !isPro && proPop && <ProPopup leak={leak} timer={launchLeft} onClose={() => setProPop(false)} onUnlock={() => { setProPop(false); unlockPro(activeSite.url); }} />}

      {activeSite && latest && (
        <>
          {tab !== "Messages" && <button className={`ai-fab ${aiOpen ? "open" : ""}`} onClick={() => setAiOpen((o) => !o)} aria-label="AI Growth Consultant"><I n={aiOpen ? "x" : "bot"} size={22} /></button>}
          <Consultant open={aiOpen} onClose={() => setAiOpen(false)} isPro={isPro} context={chatContext} onUpgrade={() => { setAiOpen(false); unlockPro(activeSite.url); }} ask={aiAsk} onAsked={() => setAiAsk("")} />
        </>
      )}

      {moreOpen && (
        <div className="g-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="g-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="g-more-handle" />
            <div className="g-more-grid">
              {MORE_NAV.map(([t, ic]) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => { setMoreOpen(false); go(t); }}>
                  <span><I n={ic} size={19} /></span>{t}
                  {["Theme Audit", "App Stack", "Ads Strategy", "History", "Settings"].includes(t) && !isPro && <i className="g-more-lock"><I n="lock" size={10} /></i>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="g-bottom">
        {MOBILE_NAV.map(([t, ic, lbl]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => { setMoreOpen(false); go(t); }}>
            <span className="g-bn-ic"><I n={ic} size={18} />{t === "Messages" && unread > 0 && <i className="g-bn-badge">{unread}</i>}</span>{lbl}
          </button>
        ))}
        <button className={moreOpen ? "on" : ""} onClick={() => setMoreOpen((o) => !o)}><span className="g-bn-ic"><I n="plus" size={18} /></span>More</button>
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
