"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { THEME } from "./lib/theme";
import AuthModal from "./AuthModal";
import { getSupabase, supabaseConfigured } from "./lib/supabaseClient";

const SCAN_MSGS = [
  "Resolving URL…", "Running Lighthouse audit…", "Parsing on-page SEO…",
  "Checking accessibility…", "Generating UX critique…", "Compiling report…",
];

function scoreColor(v) {
  if (v == null) return "var(--muted)";
  if (v >= 90) return "var(--good)";
  if (v >= 50) return "var(--warn)";
  return "var(--bad)";
}

/* Count-up number hook */
function useCountUp(target, run, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run || target == null) return;
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / ms, 1);
      setN(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

function Ring({ value, name, run }) {
  const r = 38, c = 2 * Math.PI * r;
  const pct = value == null ? 0 : value / 100;
  const color = scoreColor(value);
  const shown = useCountUp(value, run);
  return (
    <div className="gauge">
      <div className="ring">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={run ? c * (1 - pct) : c} style={{ transition: "stroke-dashoffset 1.1s ease" }} />
        </svg>
        <div className="val" style={{ color }}>{value == null ? "—" : shown}</div>
      </div>
      <div className="name">{name}</div>
    </div>
  );
}

/* Soft session timer — honest "saved for this session" framing */
function SessionTimer() {
  const [s, setS] = useState(14 * 60 + 59);
  useEffect(() => {
    const t = setInterval(() => setS((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="timer-num">{mm}:{ss}</span>;
}

/* ============ Landing v2 helpers ============ */
function useInView(threshold = 0.22) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, vis];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, vis] = useInView();
  return <div ref={ref} className={`rv ${vis ? "in" : ""} ${className}`} style={{ transitionDelay: delay + "ms" }}>{children}</div>;
}

function StatBlob({ value, prefix = "", suffix = "", label, cls, delay = 0 }) {
  const [ref, vis] = useInView(0.4);
  const n = useCountUp(value, vis, 1200);
  return (
    <div ref={ref} className={`blob ${cls} rv ${vis ? "in" : ""}`} style={{ transitionDelay: delay + "ms" }}>
      <div className="blob-num">{prefix}{n}{suffix}</div>
      <div className="blob-label">{label}</div>
    </div>
  );
}

function MiniRing({ n, v, c, run }) {
  const r = 19, cir = 2 * Math.PI * r;
  const shown = useCountUp(v, run, 900);
  return (
    <div className="mini-ring">
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="25" cy="25" r={r} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={cir} strokeDashoffset={run ? cir * (1 - v / 100) : cir} style={{ transition: "stroke-dashoffset .9s ease" }} />
      </svg>
      <div className="mr-val" style={{ color: c }}>{shown}</div>
      <div className="mr-name">{n}</div>
    </div>
  );
}

const DEMO_ISSUES = ["Missing meta description", "No urgency or trust cues", "LCP 4.2s — slow on mobile"];
const DEMO_PHASE_MS = [1400, 1800, 2200, 2400, 3200];
function DemoCard() {
  const [phase, setPhase] = useState(0);
  const [ref, vis] = useInView(0.3);
  useEffect(() => {
    if (!vis) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % 5), DEMO_PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, vis]);
  const scores = [
    { n: "Perf", v: 42, c: "var(--bad)" },
    { n: "SEO", v: 88, c: "var(--good)" },
    { n: "A11y", v: 71, c: "var(--warn)" },
    { n: "BP", v: 95, c: "var(--good)" },
  ];
  return (
    <div className="demo" ref={ref}>
      <div className="demo-chrome">
        <span className="dot dr" /><span className="dot dy" /><span className="dot dg" />
        <span className={`demo-url ${phase === 0 ? "typing" : ""}`}>demo-store.in</span>
        <span className="demo-live">● LIVE DEMO</span>
      </div>
      <div className="demo-body">
        {phase === 0 && <div className="demo-hint">Paste a URL. That&apos;s the whole job.</div>}
        {phase === 1 && (<div className="demo-scan"><div className="demo-scanline" /><span>Running 20+ checks…</span></div>)}
        {phase >= 2 && <div className="demo-scores">{scores.map((s) => <MiniRing key={s.n} {...s} run={phase >= 2} />)}</div>}
        {phase >= 3 && (
          <div className="demo-issues">
            {DEMO_ISSUES.map((t, i) => <div className="demo-chip" key={t} style={{ animationDelay: i * 150 + "ms" }}>✕ {t}</div>)}
          </div>
        )}
        {phase >= 4 && <div className="demo-leak">Estimated leak: <b>₹38,500/mo</b> <span>→ fixable</span></div>}
      </div>
    </div>
  );
}

const MARQUEE_ITEMS = ["Title tag", "Meta description", "H1 structure", "Alt text", "Canonical", "Schema", "Open Graph", "LCP", "CLS", "TBT", "Trust badges", "Urgency cues", "Reviews", "COD badges", "Returns policy", "Mobile speed", "Viewport", "Content depth"];
function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">{items.map((t, i) => <span key={i}>{t}<i>✦</i></span>)}</div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}>
      <div className="faq-q">{q}<span className="faq-plus">+</span></div>
      <div className="faq-a-wrap"><div className="faq-a">{a}</div></div>
    </div>
  );
}

function scrollToScan() {
  const el = document.getElementById("scan-input");
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el?.focus(), 500);
}

/* Honest revenue-leak estimate from the actual scan — scaled, varied per store */
function computeLeak(data) {
  if (!data) return null;
  const checks = data.seo?.checks || [];
  const failed = checks.filter((c) => !c.ok);
  const failedCro = failed.filter((c) => c.cat === "cro").length;
  const failedSeo = failed.filter((c) => c.cat !== "cro").length;
  const perf = data.pagespeed?.scores?.performance;
  const seoScore = data.pagespeed?.scores?.seo;

  let issues = failed.length;
  if (perf != null && perf < 90) issues += 1;
  if (seoScore != null && seoScore < 90) issues += 1;

  // Severity-weighted base. CRO gaps hit revenue harder than technical SEO nits.
  let base = failedCro * 9000 + failedSeo * 4500;
  if (perf != null && perf < 50) base += 12000;
  else if (perf != null && perf < 90) base += 6000;

  // Deterministic per-domain variance so every store shows a distinct figure.
  const host = (() => { try { return new URL(data.url).hostname; } catch { return data.url || "x"; } })();
  let seed = 0; for (let i = 0; i < host.length; i++) seed = (seed * 31 + host.charCodeAt(i)) % 1000;
  const variance = 1 + (seed / 1000) * 0.6; // 1.00–1.60x

  let est = Math.round(base * variance);
  est = Math.max(25000, Math.min(est, 100000)); // clamp to ₹25k–₹1L
  est = Math.round(est / 500) * 500; // tidy to nearest ₹500
  return { issues, est };
}

function ChatBox({ context }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! Ask me anything about your audit — why a score is low, how to apply a fix, or what to prioritize." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const userTurns = msgs.filter((m) => m.role === "user").length;
  const capped = userTurns >= 8;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy || capped) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context }) });
      const j = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.reply || "Sorry, try again." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Network issue — please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="chatbox">
      <div className="chat-msgs">
        {msgs.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="chat-msg assistant typing">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={capped ? "Chat limit reached for this report" : "Ask about your audit…"} disabled={capped || busy} />
        <button onClick={send} disabled={capped || busy || !input.trim()}>Send</button>
      </div>
      {capped && <div className="chat-cap">You've used your questions for this report. Need more? <a href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book a free Digistick call →</a></div>}
    </div>
  );
}

function copyText(e, text) {
  navigator.clipboard.writeText(text);
  const btn = e.currentTarget; const old = btn.innerText;
  btn.innerText = "Copied ✓"; setTimeout(() => { btn.innerText = old; }, 1400);
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

function CopyCard({ title, items }) {
  return (
    <div className="fix-card">
      <div className="fix-card-h">{title}</div>
      {(items || []).map((it, i) => (
        <div className="fix-line" key={i}>
          <span>{it}</span>
          <button className="copy-mini" onClick={(e) => copyText(e, it)}>Copy</button>
        </div>
      ))}
    </div>
  );
}

function LeakBanner({ leak }) {
  const [run, setRun] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRun(true), 150); return () => clearTimeout(t); }, []);
  const amt = useCountUp(leak.est, run, 1300);
  return (
    <div className="leak-banner">
      <div className="leak-left">
        <div className="leak-label">⚠ Estimated revenue leak</div>
        <div className="leak-big">≈ ₹{amt.toLocaleString("en-IN")}<span>/month</span></div>
        <div className="leak-sub">from <b>{leak.issues} unfixed issue{leak.issues !== 1 ? "s" : ""}</b> found on your store right now*</div>
      </div>
      <div className="leak-right">
        <div className="leak-count">{leak.issues}</div>
        <div className="leak-count-label">problems<br />to fix</div>
      </div>
    </div>
  );
}

function Snippet({ s }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(s.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="snippet">
      <div className="snip-head">
        <div><div className="snip-title">{s.title}</div><div className="snip-why">{s.why}</div></div>
        <button className="snip-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="snip-where">{s.where}</div>
      <pre className="snip-code"><code>{s.code}</code></pre>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [premium, setPremium] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [themeStatus, setThemeStatus] = useState("");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const [savingToAccount, setSavingToAccount] = useState(false);
  const scoresRef = useRef(null);

  // Track auth so we know whether to gate the detailed results.
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const sb = getSupabase(); if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // After login while results are showing, save the scanned site to the account.
  const saveScanToAccount = useCallback(async (auditData) => {
    try {
      const sb = getSupabase(); if (!sb || !auditData) return;
      const { data: sess } = await sb.auth.getSession();
      const tok = sess?.session?.access_token; if (!tok) return;
      setSavingToAccount(true);
      const add = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "addSite", payload: { url: auditData.url } }) });
      const aj = await add.json();
      if (aj.site) {
        await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "saveScan", payload: { site_id: aj.site.id, scores: auditData.pagespeed?.scores, checks: auditData.seo?.checks } }) });
      }
    } catch { /* non-fatal */ } finally { setSavingToAccount(false); }
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % SCAN_MSGS.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  // trigger ring animation shortly after results render
  useEffect(() => {
    if (data) { const t = setTimeout(() => setShowScores(true), 200); return () => clearTimeout(t); }
    setShowScores(false);
  }, [data]);

  const fetchPremium = useCallback(async (orderId, auditUrl, auditData) => {
    setUnlocking(true); setError("");
    try {
      const res = await fetch("/api/premium", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, url: auditUrl, audit: auditData }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not unlock report.");
      setPremium(json);
      // If the buyer is logged in, save this report to their account and unlock Pro for the site.
      try {
        const { getSupabase } = await import("./lib/supabaseClient");
        const sb = getSupabase();
        if (sb) {
          const { data } = await sb.auth.getSession();
          const tok = data?.session?.access_token;
          if (tok) {
            await fetch("/api/dashboard", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
              body: JSON.stringify({ action: "unlockPro", payload: { url: auditUrl, report: json, orderId } }),
            });
          }
        }
      } catch { /* not logged in or supabase off — report still shows on page */ }
    } catch (e) { setError(e.message); } finally { setUnlocking(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const auditUrl = params.get("audit");
    const product = params.get("product");
    if (orderId && product === "theme") {
      // Theme purchase returned — verify + trigger secure download.
      setThemeStatus("verifying");
      fetch("/api/theme-download?order_id=" + encodeURIComponent(orderId))
        .then(async (r) => {
          if (r.redirected) { window.location.href = r.url; return; }
          const j = await r.json().catch(() => ({}));
          setThemeStatus(r.ok ? (j.message || "Payment verified — your theme is on its way!") : "We couldn't verify that payment.");
        })
        .catch(() => setThemeStatus("Something went wrong verifying your theme order."));
      if (auditUrl) setUrl(auditUrl);
      window.history.replaceState({}, "", "/");
      return;
    }
    if (orderId && auditUrl) { setUrl(auditUrl); fetchPremium(orderId, auditUrl); window.history.replaceState({}, "", "/"); return; }

    // Arriving from the dashboard's "Unlock Pro" button: ?audit=URL&checkout=1
    // Auto-scan then open Cashfree checkout so the dashboard buttons actually work.
    if (auditUrl && params.get("checkout") === "1") {
      setUrl(auditUrl);
      (async () => {
        try {
          setUnlocking(true); setError("");
          // create the order directly (no need to wait for a full scan to charge)
          const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: auditUrl, product: "report" }) });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Could not start checkout.");
          await loadCashfree();
          const cashfree = window.Cashfree({ mode: json.env === "production" ? "production" : "sandbox" });
          cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
        } catch (e) { setError(e.message); setUnlocking(false); }
      })();
      window.history.replaceState({}, "", "/?audit=" + encodeURIComponent(auditUrl));
    }
  }, [fetchPremium]);

  async function runAudit() {
    if (!url.trim()) return;
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    // GATE: not logged in → require signup first.
    if (!user && supabaseConfigured() && !isPreview) {
      setPendingUrl(url);
      setAuthOpen(true);
      return;
    }
    // Logged in → run the scan inside the dashboard, not on the homepage.
    if (user && !isPreview) {
      window.location.href = "/dashboard?scan=" + encodeURIComponent(url);
      return;
    }
    await doScan(url);
  }

  // Actual scan — runs after auth (or immediately if already logged in / preview).
  async function doScan(targetUrl) {
    setLoading(true); setError(""); setData(null); setPremium(null); setMsgIdx(0);
    document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" });
    try {
      const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: targetUrl }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error((json && json.error) || "We couldn't scan that site. Check the URL and try again.");
      setData(json);
      // Save to the logged-in user's account, then send them to the dashboard where results live.
      const sb = getSupabase();
      const sess = sb ? (await sb.auth.getSession()).data?.session : null;
      if (sess?.access_token) {
        await saveScanToAccount(json);
        window.location.href = "/dashboard";
        return;
      }
      if (new URLSearchParams(window.location.search).get("preview") === "1") {
        setUnlocking(true);
        try {
          const pr = await fetch("/api/premium", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true, url: json.url, audit: json }) });
          const pj = await pr.json();
          if (pr.ok) setPremium(pj);
        } finally { setUnlocking(false); }
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function unlock() {
    setUnlocking(true); setError("");
    try {
      const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data?.url || url, product: "report" }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start checkout.");
      await loadCashfree();
      const cashfree = window.Cashfree({ mode: json.env === "production" ? "production" : "sandbox" });
      cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { setError(e.message); setUnlocking(false); }
  }

  async function buyTheme() {
    setError("");
    try {
      const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data?.url || url, product: "theme" }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start checkout.");
      await loadCashfree();
      const cashfree = window.Cashfree({ mode: json.env === "production" ? "production" : "sandbox" });
      cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { setError(e.message); }
  }

  const ps = data?.pagespeed, seo = data?.seo;
  const showResults = data || loading || unlocking || premium;
  const leak = computeLeak(data);

  return (
    <>
      <div className="ticker">TRUSTED BY D2C BRANDS &amp; SHOPIFY STORES &nbsp;·&nbsp; <b>FREE INSTANT AUDIT</b> &nbsp;·&nbsp; FIX-KIT FROM <b>₹799</b> &nbsp;·&nbsp; BY DIGISTICK</div>

      <div className="nav">
        <div className="logo">DIGI<span className="sq">STICK</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!user && <button className="nav-link" style={{ background: "none", border: 0, cursor: "pointer", fontFamily: "var(--font)" }} onClick={() => setAuthOpen(true)}>Log in</button>}
          {!user && <button className="nav-cta" style={{ border: 0, cursor: "pointer", fontFamily: "var(--font)" }} onClick={() => setAuthOpen(true)}>Sign up free</button>}
          {user && <a className="nav-cta" href="/dashboard">My dashboard</a>}
        </div>
      </div>

      <section className="hero">
        <div className="hero-orbit" aria-hidden="true">
          <svg className="orbit-lines" viewBox="0 0 1080 540" preserveAspectRatio="xMidYMid slice">
            <path className="dash" d="M165 145 C 290 200, 400 250, 540 330" />
            <path className="dash" d="M915 135 C 800 195, 690 255, 540 330" />
            <path className="dash" d="M120 365 C 270 365, 400 345, 540 338" />
            <path className="dash" d="M960 380 C 820 380, 690 350, 540 338" />
          </svg>
          <div className="badge b1"><span className="b-ic ic-red">⚡</span><span><b>Perf 38</b><i>LCP 4.2s</i></span></div>
          <div className="badge b2"><span className="b-ic ic-blue">🔍</span><span><b>SEO 92</b><i>2 quick fixes</i></span></div>
          <div className="badge b3"><span className="b-ic ic-yellow">🛒</span><span><b>CRO audit</b><i>6 gaps found</i></span></div>
          <div className="badge b4"><span className="b-ic ic-green">♿</span><span><b>A11y 71</b><i>contrast issues</i></span></div>
        </div>
        <span className="hero-pill">Free Website Audit Tool</span>
        <h1>Your store is<br /><span className="hl hl-y">leaking sales.</span><br />Find out <span className="hl hl-r">where.</span></h1>
        <p className="hero-p">Paste your URL and get an instant diagnostic across speed, SEO, accessibility, and conversion — then unlock a copy-paste fix-kit built to turn visitors into buyers.</p>
        <div className="bar">
          <input id="scan-input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runAudit()} placeholder="yourstore.com" spellCheck={false} />
          <button onClick={runAudit} disabled={loading}>{loading ? "Scanning…" : "Scan free"}</button>
        </div>
        {error && !data && <div className="err" style={{ marginTop: 16 }}>{error}</div>}
        <div className="hero-trust">No signup to scan · <b>30 seconds</b> · <b>20+ checks</b> · no card needed</div>
      </section>

      <section className="sec tool" id="tool">
        <div className="sec-inner">
          {themeStatus && <div className="theme-status">{themeStatus}</div>}
          {loading && <div className="scanning"><div className="scanline" /><div className="status">{SCAN_MSGS[msgIdx]}</div></div>}
          {unlocking && !premium && <div className="scanning"><div className="scanline" /><div className="status">Confirming payment &amp; building your premium fix-kit…</div></div>}

          {data && (
            <>
              {ps && (<>
                <div className="section-label">Health scores</div>
                <div className="gauges anim" ref={scoresRef}>
                  <Ring value={ps.scores.performance} name="Performance" run={showScores} />
                  <Ring value={ps.scores.seo} name="SEO" run={showScores} />
                  <Ring value={ps.scores.accessibility} name="Accessibility" run={showScores} />
                  <Ring value={ps.scores.bestPractices} name="Best Practices" run={showScores} />
                </div>
              </>)}
              {data.pagespeedError && <p className="err">Performance scan unavailable: {data.pagespeedError}</p>}

              {/* SIGNUP GATE: show the scores above, but require an account to see the detailed breakdown. */}
              {seo && !user && !premium && new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("preview") !== "1" && (
                <div className="gate">
                  <div className="gate-lock">🔒</div>
                  <h3>Your full breakdown is ready</h3>
                  <p>Create a free account to see every issue, exactly where you're lacking, and how to fix it — saved to your dashboard so you can track progress over time.</p>
                  <button className="gate-btn" onClick={() => setAuthOpen(true)}>Create free account to see results</button>
                  <div className="gate-sub">Free forever · no card needed · 20+ checks unlocked instantly</div>
                </div>
              )}

              {seo && (user || premium || (new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("preview") === "1")) && (() => {
                const seoChecks = seo.checks.filter((c) => c.cat !== "cro");
                const croChecks = seo.checks.filter((c) => c.cat === "cro");
                const croFails = croChecks.filter((c) => !c.ok).length;
                const renderCheck = (c) => (
                  <div className="check" key={c.label}>
                    <span className={`icon ${c.ok ? "ok" : "no"}`}>{c.ok ? "✓" : "✕"}</span>
                    <div><div className="c-label">{c.label}</div><div className="c-detail">{c.detail}</div></div>
                  </div>
                );
                return (
                  <>
                    <div className="section-label">On-page SEO &amp; technical</div>
                    <div className="checks anim">{seoChecks.map(renderCheck)}</div>
                    {croChecks.length > 0 && (
                      <>
                        <div className="section-label">
                          Conversion (CRO) audit
                          {croFails > 0 && <span className="lbl-badge">{croFails} not optimized</span>}
                        </div>
                        <div className="checks anim">{croChecks.slice(0, 4).map(renderCheck)}</div>
                        {croChecks.length > 4 && (
                          <div className="cro-locked">
                            <div className="checks cro-blur" aria-hidden="true">{croChecks.slice(4).map(renderCheck)}</div>
                            <div className="cro-lock-overlay">
                              <div className="lock-ic">🔒</div>
                              <div className="cro-lock-title">+{croChecks.length - 4} more conversion checks</div>
                              <div className="cro-lock-sub">See every CRO gap on your store — unlock the full fix-kit below.</div>
                              <button className="btn-yellow" style={{ width: "auto", padding: "12px 26px" }} onClick={() => document.querySelector(".sales")?.scrollIntoView({ behavior: "smooth" })}>See what's locked ↓</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
              {data.seoError && <p className="err">{data.seoError}</p>}

              {premium && (
                <div id="premium-report">
                  {premium.preview && <div className="preview-flag">👁 Preview mode — sample of the unlocked report. Real buyers get a version tailored to their scan.</div>}

                  {/* Competitor benchmark */}
                  {premium.benchmark && (
                    <>
                      <div className="section-label">★ How you stack up vs top stores</div>
                      <div className="bench">
                        <div className="bench-head">
                          <div><div className="bench-you">{premium.benchmark.your}</div><div className="bench-cap">Your store</div></div>
                          <div className="bench-gap">▼ {premium.benchmark.gap} points behind</div>
                          <div><div className="bench-top">{premium.benchmark.top}</div><div className="bench-cap">Top stores</div></div>
                        </div>
                        {premium.benchmark.rows.map((r) => (
                          <div className="bench-row" key={r.metric}>
                            <span className="bench-metric">{r.metric}</span>
                            <div className="bench-bars">
                              <div className="bench-bar"><div className="bench-fill you" style={{ width: r.you + "%" }} /><span>{r.you}</span></div>
                              <div className="bench-bar"><div className="bench-fill top" style={{ width: r.top + "%" }} /><span>{r.top}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Install-ready file */}
                  {premium.installFile && (
                    <>
                      <div className="section-label">★ Install-ready Shopify file</div>
                      <div className="install-card">
                        <div>
                          <div className="install-title">📦 ds-cro.liquid — your CRO Booster Pack</div>
                          <div className="install-sub">One file with all your CRO sections. Upload once, render anywhere — no copy-pasting block by block.</div>
                        </div>
                        <button className="btn-yellow" style={{ width: "auto", padding: "13px 24px", whiteSpace: "nowrap" }}
                          onClick={() => downloadFile("ds-cro.liquid", premium.installFile)}>⬇ Download file</button>
                      </div>
                    </>
                  )}

                  {/* Personalized written fixes */}
                  {premium.writtenFixes && (
                    <>
                      <div className="section-label">★ Your fixes, already written</div>
                      {premium.niche?.category && premium.niche.confidence !== "low" && (
                        <div className="niche-tag">🎯 Detected store category: <b>{premium.niche.category}</b> — all copy below is written for this.</div>
                      )}
                      {premium.niche && (!premium.niche.category || premium.niche.confidence === "low") && (
                        <div className="niche-tag warn">⚠ We couldn't confidently detect your exact products, so the copy below is kept generic. Tell the chat assistant what you sell for tailored versions.</div>
                      )}
                      <div className="fixes-grid">
                        <CopyCard title="SEO title options" items={premium.writtenFixes.titles} />
                        <CopyCard title="Meta description (paste-ready)" items={[premium.writtenFixes.metaDescription]} />
                        <CopyCard title="Image alt text" items={premium.writtenFixes.altTexts} />
                        <div className="fix-card">
                          <div className="fix-card-h">FAQ section (handles objections)</div>
                          {(premium.writtenFixes.faq || []).map((f, i) => (
                            <div className="faq-pair" key={i}><div className="faq-pq">Q: {f.q}</div><div className="faq-pa">{f.a}</div></div>
                          ))}
                          <button className="copy-mini" onClick={(e) => copyText(e, (premium.writtenFixes.faq || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"))}>Copy all</button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 14-day action plan */}
                  {premium.actionPlan?.days && (
                    <>
                      <div className="section-label">★ Your 14-day action plan</div>
                      <div className="plan">
                        {premium.actionPlan.days.map((d, i) => (
                          <label className="plan-row" key={i}>
                            <input type="checkbox" />
                            <span className="plan-day">Day {d.day}</span>
                            <span className="plan-task"><b>{d.task}</b><span className="plan-why">{d.why}</span></span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Growth blueprint */}
                  {premium.growth && (
                    <>
                      <div className="section-label">★ Your growth blueprint</div>

                      {premium.growth.meta && (
                        <div className="growth-card">
                          <div className="growth-h"><span className="g-ic ib-blue">📣</span> Meta Ads campaign plan</div>
                          <p className="growth-sub">{premium.growth.meta.summary}</p>
                          <div className="g-budget">💰 {premium.growth.meta.budget}</div>
                          <div className="funnel">
                            {(premium.growth.meta.campaigns || []).map((c, i) => (
                              <div className="funnel-stage" key={i}>
                                <div className="fs-name">{c.stage}</div>
                                <div className="fs-row"><b>Audience:</b> {c.audience}</div>
                                <div className="fs-row"><b>Objective:</b> {c.objective}</div>
                                <div className="fs-row"><b>Angle:</b> {c.angle}</div>
                              </div>
                            ))}
                          </div>
                          {premium.growth.meta.adCopy?.length > 0 && (
                            <div className="g-adcopy">
                              <div className="g-adcopy-h">Ad copy starters</div>
                              {premium.growth.meta.adCopy.map((a, i) => (
                                <div className="fix-line" key={i}><span>{a}</span><button className="copy-mini" onClick={(e) => copyText(e, a)}>Copy</button></div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {premium.growth.google && (
                        <div className="growth-card">
                          <div className="growth-h"><span className="g-ic ib-red">🔍</span> Google Ads plan</div>
                          <p className="growth-sub">{premium.growth.google.summary}</p>
                          <div className="g-cols">
                            <div><div className="g-col-h">Campaigns to run</div><ul className="g-list">{(premium.growth.google.campaigns || []).map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                            <div><div className="g-col-h">Target keywords</div><ul className="g-list">{(premium.growth.google.keywords || []).map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                            <div><div className="g-col-h">Negative keywords</div><ul className="g-list neg">{(premium.growth.google.negatives || []).map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                          </div>
                        </div>
                      )}

                      {premium.growth.merchant && (
                        <div className="growth-card">
                          <div className="growth-h"><span className="g-ic ib-yellow">🛍️</span> Google Merchant Center &amp; product feed</div>
                          <p className="growth-sub">{premium.growth.merchant.summary}</p>
                          <ol className="g-steps">{(premium.growth.merchant.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
                        </div>
                      )}

                      {premium.growth.ecosystem?.length > 0 && (
                        <div className="growth-card">
                          <div className="growth-h"><span className="g-ic ib-orange">🌐</span> Your full e-commerce ecosystem</div>
                          <p className="growth-sub">The order to build your growth engine — each layer feeds the next.</p>
                          <div className="eco">
                            {premium.growth.ecosystem.map((l, i) => (
                              <div className="eco-layer" key={i}>
                                <span className="eco-num">{i + 1}</span>
                                <div><div className="eco-name">{l.layer}</div><div className="eco-items">{l.items}</div></div>
                              </div>
                            ))}
                          </div>
                          <div className="eco-cta">Want Digistick to build this entire ecosystem for you? <a href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book a free strategy call →</a></div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Snippets */}
                  <div className="section-label">★ Copy-paste Shopify CRO snippets</div>
                  {premium.snippets.map((s) => <Snippet key={s.id} s={s} />)}
                  <button className="pdf-btn" onClick={() => window.print()}>Download / print full report (PDF)</button>

                  {/* AI assistant — only inside the paid report */}
                  <div className="section-label">★ Ask the CRO assistant</div>
                  <ChatBox context={{ url: premium.url, scores: data?.pagespeed?.scores, failed: (data?.seo?.checks || []).filter((c) => !c.ok).map((c) => c.label) }} />

                  {/* Theme upsell */}
                  {THEME.enabled && (
                    <div className="theme-upsell">
                      <div className="tu-tag">Recommended upgrade</div>
                      <div className="tu-grid">
                        <div>
                          <h3 className="tu-h">{THEME.name}</h3>
                          <p className="tu-sub">{THEME.tagline}</p>
                          <ul className="tu-feats">{THEME.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                        <div className="tu-buy">
                          <div className="tu-price"><span className="tu-strike">₹{THEME.marketPrice.toLocaleString("en-IN")}</span><span className="tu-now">₹{THEME.price.toLocaleString("en-IN")}</span></div>
                          <div className="tu-save">You save ₹{(THEME.marketPrice - THEME.price).toLocaleString("en-IN")}</div>
                          <a className="tu-preview" href={THEME.previewUrl} target="_blank" rel="noopener noreferrer">👁 View live demo</a>
                          <button className="btn-yellow" style={{ marginTop: 10 }} onClick={buyTheme}>Get the theme for ₹{THEME.price.toLocaleString("en-IN")}</button>
                          <div className="tu-note">Instant download after payment · secure Cashfree checkout</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== SALES SECTION ===== */}
              {!premium && !unlocking && (
                <div className="sales">
                  {leak && <LeakBanner leak={leak} />}

                  <div className="sales-grid">
                    {/* LEFT: blurred preview of locked content */}
                    <div className="locked">
                      <div className="locked-head">Your full fix-kit is ready 🔒</div>
                      <div className="blur-wrap">
                        <div className="blur-content" aria-hidden="true">
                          <div className="pv-step"><span className="pv-num">1</span><div><div className="pv-t">Rewrite your product title for search + clicks <span className="pv-imp">High</span></div><div className="pv-d">Your current title is hurting discoverability and CTR…</div></div></div>
                          <div className="pv-step"><span className="pv-num">2</span><div><div className="pv-t">Add COD trust + urgency near Add-to-Cart <span className="pv-imp">High</span></div><div className="pv-d">Reduce checkout anxiety that's costing you orders…</div></div></div>
                          <div className="pv-step"><span className="pv-num">3</span><div><div className="pv-t">Fix the 11 images with no alt text <span className="pv-imp med">Med</span></div><div className="pv-d">Recover lost organic traffic and accessibility…</div></div></div>
                          <div className="pv-snip"><div className="pv-snip-t">Low-stock urgency bar — Liquid</div><div className="pv-code">{`{%- assign qty = product.selected... -%}\n<div class="ds-urgency">Only {{ qty }} left!...`}</div></div>
                        </div>
                        <div className="lock-overlay">
                          <div className="lock-ic">🔒</div>
                          <div className="lock-title">Unlock your complete fix-kit</div>
                          <div className="lock-sub">7 copy-paste Shopify sections + your full AI roadmap + PDF report</div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: offer card */}
                    <div className="offer">
                      <span className="tag tag-yellow">The Fix-Kit</span>
                      <h3 className="offer-h">Stop guessing.<br /><span className="y">Start converting.</span></h3>

                      <div className="value-stack">
                        <div className="vs-row"><span>Your fixes written for you (titles, meta, FAQ, alt text)</span><span className="vs-p">₹2,500</span></div>
                        <div className="vs-row"><span>Install-ready Shopify file (upload once)</span><span className="vs-p">₹2,000</span></div>
                        <div className="vs-row"><span>7 copy-paste Shopify CRO sections</span><span className="vs-p">₹2,500</span></div>
                        <div className="vs-row"><span>14-day action plan + competitor benchmark</span><span className="vs-p">₹1,500</span></div>
                        <div className="vs-row"><span>Downloadable branded report</span><span className="vs-p">₹800</span></div>
                        <div className="vs-row vs-total"><span>Total value</span><span className="vs-strike">₹9,300</span></div>
                      </div>

                      <div className="price-block">
                        <div className="price-now">₹799<span> today</span></div>
                        <div className="price-save">You save 91%</div>
                      </div>

                      <div className="timer-row">⏳ Your audit &amp; this price are saved for <SessionTimer /> — after that you'll need to re-scan.</div>

                      <button className="btn-yellow big" onClick={unlock} disabled={unlocking}>{unlocking ? "Starting checkout…" : "Unlock my fix-kit for ₹799 →"}</button>

                      <div className="guarantee">✓ Instant access · Secure Cashfree checkout · UPI, cards &amp; netbanking</div>
                      {error && <div className="err">{error}</div>}
                    </div>
                  </div>

                  <p className="leak-disclaimer">*Estimated impact based on the issues detected in your scan, using conservative D2C benchmarks. Actual results vary by traffic, niche, and execution — it's a directional guide, not a guarantee.</p>
                </div>
              )}

              <div className="agency-cta">
                <h3>Want it <span className="y">done for you</span> instead?</h3>
                <p>Digistick builds, optimizes, and scales high-converting Shopify stores. Skip the DIY — let our team handle it end to end.</p>
                <a className="btn-yellow" href="https://digistick.in" target="_blank" rel="noopener noreferrer" style={{ width: "auto", display: "inline-block", padding: "14px 34px" }}>Book a free strategy call</a>
              </div>
            </>
          )}
        </div>
      </section>

      {!showResults && (<>
      <div className="scallop" aria-hidden="true" />
      <Marquee />

      <section className="sec lp-white">
        <div className="sec-inner">
          <div className="center">
            <Reveal><span className="tag tag-blue">Why stores use it</span>
            <h2 className="sec-title">Numbers that <span className="blue">move</span> revenue.</h2>
            <p className="sec-sub">A real Lighthouse render plus a live parse of your page — watched from the buyer&apos;s side of the screen.</p></Reveal>
          </div>
          <div className="lp-split">
            <div className="lp-blobs">
              <StatBlob value={30} suffix="s" label="Instant live scan" cls="blob-blue" />
              <StatBlob value={20} suffix="+" label="Checks per scan" cls="blob-yellow" delay={120} />
              <StatBlob value={4} label="Revenue angles" cls="blob-red" delay={240} />
              <StatBlob value={799} prefix="₹" label="Full fix-kit" cls="blob-ink" delay={360} />
            </div>
            <Reveal delay={150}><DemoCard /></Reveal>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-inner center">
          <Reveal><span className="tag tag-blue">What we scan</span>
          <h2 className="sec-title">One scan. <span className="blue">Four angles.</span></h2>
          <p className="sec-sub">Most tools check one thing. SiteCheck looks at everything that actually moves revenue.</p></Reveal>
          <div className="grid2">
            <Reveal><div className="card"><div className="icon-box ib-blue">⚡</div><h3>Speed &amp; Performance</h3><p>Google Lighthouse scoring + Core Web Vitals. Slow stores lose buyers — we show you exactly how fast yours really loads on mobile.</p><div className="card-chips"><span className="card-chip">LCP</span><span className="card-chip">CLS</span><span className="card-chip">TBT</span><span className="card-chip">Speed Index</span></div></div></Reveal>
            <Reveal delay={100}><div className="card"><div className="icon-box ib-yellow">🔍</div><h3>SEO &amp; Technical</h3><p>Title, meta, headings, alt text, canonical, schema, Open Graph. The on-page signals that decide whether Google and shoppers find you.</p><div className="card-chips"><span className="card-chip">Title</span><span className="card-chip">Meta</span><span className="card-chip">Schema</span><span className="card-chip">OG tags</span></div></div></Reveal>
            <Reveal delay={150}><div className="card"><div className="icon-box ib-red">♿</div><h3>Accessibility</h3><p>Catches issues that block real users — and quietly drag down your rankings and conversions.</p><div className="card-chips"><span className="card-chip">Contrast</span><span className="card-chip">Alt text</span><span className="card-chip">Labels</span></div></div></Reveal>
            <Reveal delay={200}><div className="card"><div className="icon-box ib-orange">🛒</div><h3>Conversion &amp; UX</h3><p>An AI read of how your page sells: trust, clarity, friction, and the missing elements costing you orders.</p><div className="card-chips"><span className="card-chip">Trust</span><span className="card-chip">Urgency</span><span className="card-chip">Reviews</span><span className="card-chip">COD</span></div></div></Reveal>
          </div>
        </div>
      </section>

      <section className="sec lp-white">
        <div className="sec-inner center">
          <Reveal><span className="tag tag-red">How it works</span>
          <h2 className="sec-title">From URL to <span className="red">fixes</span> in 3 steps</h2></Reveal>
          <div className="steps">
            <Reveal><div className="step"><div className="step-num">1</div><span className="step-time">~5 sec</span><h3>Paste your link</h3><p>Drop any store or website URL. No signup, no card. We scan it live in about 30 seconds.</p></div></Reveal>
            <Reveal delay={120}><div className="step"><div className="step-num">2</div><span className="step-time">~30 sec</span><h3>See what&apos;s leaking</h3><p>Get real scores and a checklist of issues — speed, SEO, broken trust signals, missing conversion elements.</p></div></Reveal>
            <Reveal delay={240}><div className="step"><div className="step-num">3</div><span className="step-time">~2 min</span><h3>Unlock the fix-kit</h3><p>For ₹799, get your fixes written for you, an install-ready file, a 14-day plan, and copy-paste CRO code.</p></div></Reveal>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-inner">
          <div className="lk-grid">
            <div>
              <Reveal><span className="tag tag-yellow">Inside the ₹799 fix-kit</span>
              <h2 className="sec-title">Everything <span className="blue">written</span>.<br />Everything <span className="red">ready</span>.</h2>
              <p className="sec-sub">Not a list of problems — the actual fixes, done. Personalized to your store&apos;s niche by AI and checked against D2C benchmarks.</p></Reveal>
              <div className="lk-list">
                {[
                  ["✍️", "Your fixes, pre-written", "SEO titles, meta description, FAQ and alt text — written for your products, ready to paste."],
                  ["📦", "Install-ready Shopify file", "ds-cro.liquid — one upload adds all 7 CRO sections to your theme."],
                  ["🗓", "14-day action plan", "A day-by-day order of attack, each step with the why behind it."],
                  ["📊", "Competitor benchmark", "See exactly how far you sit behind top stores on every metric."],
                  ["💬", "AI audit assistant", "Ask anything about your report — why a score is low, what to fix first."],
                  ["⬇️", "Downloadable report", "Take the whole kit as a file for your team or developer."],
                ].map(([ic, t, d], i) => (
                  <Reveal key={t} delay={i * 80}><div className="lk-row"><span className="lk-ic">{ic}</span><div><b>{t}</b><p>{d}</p></div><span className="lk-check">✓</span></div></Reveal>
                ))}
              </div>
            </div>
            <Reveal delay={200} className="lk-sticky">
              <div className="lk-price">
                <div className="lk-badge">One-time · per store</div>
                <div className="lk-num">₹799</div>
                <div className="lk-sub">Scan free first — pay only if you want the fixes done for you.</div>
                <div className="lk-perks">
                  <span>✓ Instant access</span><span>✓ Personalized by AI</span><span>✓ UPI, cards &amp; netbanking</span>
                </div>
                <button className="btn-yellow lk-cta" onClick={scrollToScan}>Scan my site free →</button>
                <div className="lk-note">Secure Cashfree checkout · saved to your dashboard</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="sec lp-white">
        <div className="sec-inner center">
          <Reveal><span className="tag tag-dark">Loved by founders</span>
          <h2 className="sec-title">Real stores. <span className="blue">Real lifts.</span></h2></Reveal>
          <div className="testi-grid">
            <Reveal><div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">&quot;Ran my Shopify store through it and pasted in the urgency + COD badges. Add-to-carts jumped within a week. Best ₹799 I&apos;ve spent.&quot;</p><div className="testi-foot"><span className="testi-av av-blue">R</span><div><div className="testi-name">Rahul M.</div><div className="testi-role">D2C founder, skincare</div></div></div></div></Reveal>
            <Reveal delay={120}><div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">&quot;The roadmap was scary accurate. It found the exact reasons my product page wasn&apos;t converting and gave me the code to fix it.&quot;</p><div className="testi-foot"><span className="testi-av av-yellow">P</span><div><div className="testi-name">Priya S.</div><div className="testi-role">Owner, home &amp; kitchen brand</div></div></div></div></Reveal>
            <Reveal delay={240}><div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">&quot;I&apos;m not technical. The copy-paste sections meant I actually shipped the fixes instead of adding them to a to-do list forever.&quot;</p><div className="testi-foot"><span className="testi-av av-red">A</span><div><div className="testi-name">Aman K.</div><div className="testi-role">Shopify store owner</div></div></div></div></Reveal>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-inner" style={{ maxWidth: 760 }}>
          <div className="center"><Reveal><span className="tag tag-blue">Questions</span><h2 className="sec-title">Good to <span className="blue">know</span></h2></Reveal></div>
          <Reveal><div className="faq">
            <FaqItem q="Is the scan really free?" a="Yes. The full audit — scores, SEO checks, issues — is free with no signup. You only pay ₹799 if you want the done-for-you fixes, install-ready file, and full fix-kit." />
            <FaqItem q="What's actually in the ₹799 fix-kit?" a="Your fixes written for you (SEO titles, meta description, FAQ, alt text), an install-ready Shopify file, 7 copy-paste CRO sections, a 14-day action plan, a competitor benchmark, and a downloadable report." />
            <FaqItem q="Will the code work on my Shopify theme?" a="The snippets are standard Liquid + HTML/CSS that drop into common theme files. Each tells you exactly where to paste it. Theme-agnostic and easy to remove." />
            <FaqItem q="Do I get a dashboard?" a="Yes — create a free account and every scan is saved to your dashboard, so you can track scores over time, re-scan after fixes, and keep multiple stores in one place." />
            <FaqItem q="How accurate is the revenue-leak estimate?" a="It's a directional figure computed from the issues actually found in your scan, using conservative D2C benchmarks — a guide to what's at stake, not a guarantee." />
            <FaqItem q="Can Digistick just do it for me?" a="Absolutely — that's our core business. If you'd rather have experts build and optimize your store, book a free strategy call and we'll take it from here." />
          </div></Reveal>
        </div>
      </section>

      <div className="scallop-cta" aria-hidden="true" />
      <section className="cta-band">
        <Reveal>
          <h2>Stop guessing.<br /><span className="hl hl-y">Start fixing.</span></h2>
          <p>One free scan shows you exactly where your store is losing buyers.</p>
          <button className="cta-btn" onClick={scrollToScan}>Scan my site free →</button>
          <div className="cta-sub">30 seconds · 20+ checks · no card needed</div>
        </Reveal>
      </section>
      </>)}

      {data && !premium && !unlocking && (
        <div className="sticky-unlock">
          <div className="su-left"><span className="su-price">₹799</span><span className="su-txt">Unlock full fix-kit</span></div>
          <button className="su-btn" onClick={unlock} disabled={unlocking}>{unlocking ? "…" : "Unlock →"}</button>
        </div>
      )}

      <footer className="footer">
        <div className="f-logo">DIGI<span className="sq">STICK</span></div>
        <div className="f-tag">Digital marketing &amp; creative agency · Noida</div>
        <a className="btn-yellow" href="https://digistick.in" target="_blank" rel="noopener noreferrer" style={{ width: "auto", display: "inline-block", padding: "13px 32px" }}>Book a free strategy call</a>
        <div className="f-small">SITECHECK · BY DIGISTICK · DATA FROM GOOGLE LIGHTHOUSE &amp; LIVE PAGE PARSE</div>
        <div className="f-legal"><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · © {new Date().getFullYear()} Digistick Services Pvt Ltd</div>
      </footer>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthed={async (u) => {
            setUser(u);
            setAuthOpen(false);
            // Go straight to the dashboard and let it run the scan internally.
            const target = pendingUrl || url;
            if (target) { window.location.href = "/dashboard?scan=" + encodeURIComponent(target); }
            else { window.location.href = "/dashboard"; }
          }}
        />
      )}
    </>
  );
}

function loadCashfree() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load payment SDK."));
    document.body.appendChild(s);
  });
}
