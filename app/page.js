"use client";

import { useState, useEffect, useCallback } from "react";

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

function Ring({ value, name }) {
  const r = 38, c = 2 * Math.PI * r;
  const pct = value == null ? 0 : value / 100;
  const color = scoreColor(value);
  return (
    <div className="gauge">
      <div className="ring">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="val" style={{ color }}>{value == null ? "—" : value}</div>
      </div>
      <div className="name">{name}</div>
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
        <button className="snip-copy" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <div className="snip-where">📍 {s.where}</div>
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

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % SCAN_MSGS.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  const fetchPremium = useCallback(async (orderId, auditUrl) => {
    setUnlocking(true); setError("");
    try {
      const res = await fetch("/api/premium", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, url: auditUrl }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not unlock report.");
      setPremium(json);
    } catch (e) { setError(e.message); } finally { setUnlocking(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const auditUrl = params.get("audit");
    if (orderId && auditUrl) { setUrl(auditUrl); fetchPremium(orderId, auditUrl); window.history.replaceState({}, "", "/"); }
  }, [fetchPremium]);

  async function runAudit() {
    if (!url.trim()) return;
    setLoading(true); setError(""); setData(null); setPremium(null); setMsgIdx(0);
    document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" });
    try {
      const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setData(json);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function unlock() {
    setUnlocking(true); setError("");
    try {
      const res = await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data?.url || url }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start checkout.");
      await loadCashfree();
      const cashfree = window.Cashfree({ mode: "sandbox" });
      cashfree.checkout({ paymentSessionId: json.paymentSessionId, redirectTarget: "_self" });
    } catch (e) { setError(e.message); setUnlocking(false); }
  }

  const ps = data?.pagespeed, seo = data?.seo;
  const showResults = data || loading || unlocking || premium;

  return (
    <>
      <div className="ticker">🚀 TRUSTED BY D2C BRANDS &amp; SHOPIFY STORES &nbsp;·&nbsp; <b>FREE INSTANT AUDIT</b> &nbsp;·&nbsp; FIX-KIT FROM <b>₹399</b> &nbsp;·&nbsp; BY DIGISTICK</div>

      <div className="nav">
        <div className="logo">DIGI<span className="sq">STICK</span></div>
        <a className="nav-cta" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Work with us</a>
      </div>

      {/* HERO */}
      <section className="hero">
        <span className="hero-pill">Free Website Audit Tool</span>
        <h1>Your store is<br />leaking <span className="y">sales</span>.<br />Find out <span className="r">where</span>.</h1>
        <p className="hero-p">Paste your URL and get an instant diagnostic across speed, SEO, accessibility, and conversion — then unlock a copy-paste fix-kit built to turn visitors into buyers.</p>
        <div className="bar">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runAudit()} placeholder="yourstore.com" spellCheck={false} />
          <button onClick={runAudit} disabled={loading}>{loading ? "Scanning…" : "Scan free"}</button>
        </div>
        {error && !data && <div className="err" style={{ marginTop: 16 }}>{error}</div>}
        <div className="hero-stats">
          <div><div className="stat-num">30s</div><div className="stat-label">Instant scan</div></div>
          <div><div className="stat-num">20+</div><div className="stat-label">Checks run</div></div>
          <div><div className="stat-num">₹399</div><div className="stat-label">Full fix-kit</div></div>
        </div>
      </section>

      {/* TOOL / RESULTS */}
      <section className="sec tool" id="tool">
        <div className="sec-inner">
          {loading && <div className="scanning"><div className="scanline" /><div className="status">{SCAN_MSGS[msgIdx]}</div></div>}
          {unlocking && !premium && <div className="scanning"><div className="scanline" /><div className="status">Confirming payment &amp; building your premium fix-kit…</div></div>}

          {data && (
            <>
              {ps && (<>
                <div className="section-label">Health scores</div>
                <div className="gauges">
                  <Ring value={ps.scores.performance} name="Performance" />
                  <Ring value={ps.scores.seo} name="SEO" />
                  <Ring value={ps.scores.accessibility} name="Accessibility" />
                  <Ring value={ps.scores.bestPractices} name="Best Practices" />
                </div>
              </>)}
              {data.pagespeedError && <p className="err">Performance scan unavailable: {data.pagespeedError}</p>}

              {seo && (<>
                <div className="section-label">On-page SEO &amp; technical</div>
                <div className="checks">
                  {seo.checks.map((c) => (
                    <div className="check" key={c.label}>
                      <span className={`icon ${c.ok ? "ok" : "no"}`}>{c.ok ? "✓" : "✕"}</span>
                      <div><div className="c-label">{c.label}</div><div className="c-detail">{c.detail}</div></div>
                    </div>
                  ))}
                </div>
              </>)}
              {data.seoError && <p className="err">{data.seoError}</p>}

              {premium && (
                <div id="premium-report">
                  <div className="section-label">★ Your conversion roadmap</div>
                  <p className="road-summary">{premium.roadmap.summary}</p>
                  <div className="roadmap">
                    {premium.roadmap.steps.map((s, i) => (
                      <div className="road-step" key={i}>
                        <span className="road-num">{i + 1}</span>
                        <div><div className="road-title">{s.title} <span className={`impact ${s.impact?.toLowerCase()}`}>{s.impact}</span></div><div className="road-detail">{s.detail}</div></div>
                      </div>
                    ))}
                  </div>
                  <div className="section-label">★ Shopify CRO snippets — copy &amp; paste</div>
                  {premium.snippets.map((s) => <Snippet key={s.id} s={s} />)}
                  <button className="pdf-btn" onClick={() => window.print()}>⬇ Download / print full report (PDF)</button>
                </div>
              )}

              {!premium && !unlocking && (
                <div className="pricing">
                  <div>
                    <span className="tag tag-yellow">The Fix-Kit</span>
                    <h3 style={{ marginTop: 14 }}>Stop guessing.<br /><span className="y">Start converting.</span></h3>
                    <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>Your free scan shows what's broken. The ₹399 fix-kit shows you exactly how to fix it — with ready-to-paste code.</p>
                  </div>
                  <div className="price-box">
                    <div className="price-big">₹399<span> / one-time</span></div>
                    <ul className="price-perks">
                      <li>AI conversion roadmap for your store</li>
                      <li>Copy-paste Shopify CRO snippets</li>
                      <li>Urgency, COD trust, sticky cart &amp; more</li>
                      <li>Downloadable PDF report</li>
                    </ul>
                    <button className="btn-yellow" onClick={unlock} disabled={unlocking}>{unlocking ? "Starting checkout…" : "Unlock for ₹399"}</button>
                  </div>
                </div>
              )}
              {error && <div className="err">{error}</div>}
            </>
          )}
        </div>
      </section>

      {/* WHAT WE CHECK */}
      {!showResults && (
      <section className="sec" style={{ background: "#fff" }}>
        <div className="sec-inner center">
          <span className="tag tag-blue">What we scan</span>
          <h2 className="sec-title">One scan. <span className="blue">Four angles.</span></h2>
          <p className="sec-sub">Most tools check one thing. SiteCheck looks at everything that actually moves revenue.</p>
          <div className="grid2">
            <div className="card"><div className="icon-box ib-blue">⚡</div><h3>Speed &amp; Performance</h3><p>Google Lighthouse scoring + Core Web Vitals. Slow stores lose buyers — we show you exactly how fast yours really loads on mobile.</p></div>
            <div className="card"><div className="icon-box ib-yellow">🔍</div><h3>SEO &amp; Technical</h3><p>Title, meta, headings, alt text, canonical, schema, Open Graph. The on-page signals that decide whether Google and shoppers find you.</p></div>
            <div className="card"><div className="icon-box ib-red">♿</div><h3>Accessibility</h3><p>Catches issues that block real users — and quietly drag down your rankings and conversions.</p></div>
            <div className="card"><div className="icon-box ib-orange">🛒</div><h3>Conversion &amp; UX</h3><p>An AI read of how your page sells: trust, clarity, friction, and the missing elements costing you orders.</p></div>
          </div>
        </div>
      </section>
      )}

      {/* HOW IT WORKS */}
      {!showResults && (
      <section className="sec">
        <div className="sec-inner center">
          <span className="tag tag-red">How it works</span>
          <h2 className="sec-title">From URL to <span className="red">fixes</span> in 3 steps</h2>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><h3>Paste your link</h3><p>Drop any store or website URL. No signup, no card. We scan it live in about 30 seconds.</p></div>
            <div className="step"><div className="step-num">2</div><h3>See what's leaking</h3><p>Get real scores and a checklist of issues — speed, SEO, broken trust signals, missing conversion elements.</p></div>
            <div className="step"><div className="step-num">3</div><h3>Unlock the fix-kit</h3><p>For ₹399, get a prioritized roadmap and copy-paste Shopify code to fix it yourself — today.</p></div>
          </div>
        </div>
      </section>
      )}

      {/* TESTIMONIALS */}
      {!showResults && (
      <section className="sec" style={{ background: "#fff" }}>
        <div className="sec-inner center">
          <span className="tag tag-dark">Loved by founders</span>
          <h2 className="sec-title">Real stores. <span className="blue">Real lifts.</span></h2>
          <div className="testi-grid">
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"Ran my Shopify store through it and pasted in the urgency + COD badges. Add-to-carts jumped within a week. Best ₹399 I've spent."</p><div className="testi-name">Rahul M.</div><div className="testi-role">D2C founder, skincare</div></div>
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"The roadmap was scary accurate. It found the exact reasons my product page wasn't converting and gave me the code to fix it."</p><div className="testi-name">Priya S.</div><div className="testi-role">Owner, home &amp; kitchen brand</div></div>
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"I'm not technical. The copy-paste sections meant I actually shipped the fixes instead of adding them to a to-do list forever."</p><div className="testi-name">Aman K.</div><div className="testi-role">Shopify store owner</div></div>
          </div>
        </div>
      </section>
      )}

      {/* FAQ */}
      {!showResults && (
      <section className="sec">
        <div className="sec-inner">
          <div className="center"><span className="tag tag-blue">Questions</span><h2 className="sec-title">Good to <span className="blue">know</span></h2></div>
          <div className="faq">
            <div className="faq-item"><div className="faq-q">Is the scan really free?</div><div className="faq-a">Yes. The full audit — scores, SEO checks, issues — is free with no signup. You only pay ₹399 if you want the conversion roadmap and copy-paste fix-kit.</div></div>
            <div className="faq-item"><div className="faq-q">What's actually in the ₹399 fix-kit?</div><div className="faq-a">A prioritized AI conversion roadmap specific to your site, plus ready-to-paste Shopify Liquid snippets — urgency bars, COD trust badges, sticky mobile cart, free-shipping bar, exit-intent offer and more — and a downloadable PDF report.</div></div>
            <div className="faq-item"><div className="faq-q">Will the code work on my Shopify theme?</div><div className="faq-a">The snippets are written as standard Liquid + HTML/CSS that drop into common theme files. Each one tells you exactly where to paste it. They're theme-agnostic and easy to remove.</div></div>
            <div className="faq-item"><div className="faq-q">Can Digistick just do it for me?</div><div className="faq-a">Absolutely — that's our core business. If you'd rather have experts build and optimize your store, book a free strategy call and we'll take it from here.</div></div>
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <a className="nav-cta" href="#tool" onClick={() => document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" })} style={{ fontSize: 14, padding: "15px 34px", background: "var(--blue)" }}>Scan my site free →</a>
          </div>
        </div>
      </section>
      )}

      <footer className="footer">
        <div className="f-logo">DIGI<span className="sq">STICK</span></div>
        <div className="f-tag">Digital marketing &amp; creative agency · Noida</div>
        <a className="btn-yellow" href="https://digistick.in" target="_blank" rel="noopener noreferrer" style={{ width: "auto", display: "inline-block", padding: "13px 32px" }}>Book a free strategy call</a>
        <div className="f-small">SITECHECK · BY DIGISTICK · DATA FROM GOOGLE LIGHTHOUSE &amp; LIVE PAGE PARSE</div>
      </footer>
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
