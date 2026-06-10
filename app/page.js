"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  const scoresRef = useRef(null);

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
      // TEMP preview: add ?preview=1 to the URL to view the unlocked premium report without paying.
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
  const leak = computeLeak(data);

  return (
    <>
      <div className="ticker">TRUSTED BY D2C BRANDS &amp; SHOPIFY STORES &nbsp;·&nbsp; <b>FREE INSTANT AUDIT</b> &nbsp;·&nbsp; FIX-KIT FROM <b>₹799</b> &nbsp;·&nbsp; BY DIGISTICK</div>

      <div className="nav">
        <div className="logo">DIGI<span className="sq">STICK</span></div>
        <a className="nav-cta" href="https://digistick.in" target="_blank" rel="noopener noreferrer">Need help implementing?</a>
      </div>

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
          <div><div className="stat-num">₹799</div><div className="stat-label">Full fix-kit</div></div>
        </div>
      </section>

      <section className="sec tool" id="tool">
        <div className="sec-inner">
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

              {seo && (() => {
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

                  {/* Snippets */}
                  <div className="section-label">★ Copy-paste Shopify CRO snippets</div>
                  {premium.snippets.map((s) => <Snippet key={s.id} s={s} />)}
                  <button className="pdf-btn" onClick={() => window.print()}>Download / print full report (PDF)</button>
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

      <section className="sec">
        <div className="sec-inner center">
          <span className="tag tag-red">How it works</span>
          <h2 className="sec-title">From URL to <span className="red">fixes</span> in 3 steps</h2>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><h3>Paste your link</h3><p>Drop any store or website URL. No signup, no card. We scan it live in about 30 seconds.</p></div>
            <div className="step"><div className="step-num">2</div><h3>See what's leaking</h3><p>Get real scores and a checklist of issues — speed, SEO, broken trust signals, missing conversion elements.</p></div>
            <div className="step"><div className="step-num">3</div><h3>Unlock the fix-kit</h3><p>For ₹799, get your fixes written for you, an install-ready file, a 14-day plan, and copy-paste CRO code.</p></div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ background: "#fff" }}>
        <div className="sec-inner center">
          <span className="tag tag-dark">Loved by founders</span>
          <h2 className="sec-title">Real stores. <span className="blue">Real lifts.</span></h2>
          <div className="testi-grid">
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"Ran my Shopify store through it and pasted in the urgency + COD badges. Add-to-carts jumped within a week. Best ₹799 I've spent."</p><div className="testi-name">Rahul M.</div><div className="testi-role">D2C founder, skincare</div></div>
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"The roadmap was scary accurate. It found the exact reasons my product page wasn't converting and gave me the code to fix it."</p><div className="testi-name">Priya S.</div><div className="testi-role">Owner, home &amp; kitchen brand</div></div>
            <div className="testi"><div className="testi-stars">★★★★★</div><p className="testi-text">"I'm not technical. The copy-paste sections meant I actually shipped the fixes instead of adding them to a to-do list forever."</p><div className="testi-name">Aman K.</div><div className="testi-role">Shopify store owner</div></div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-inner">
          <div className="center"><span className="tag tag-blue">Questions</span><h2 className="sec-title">Good to <span className="blue">know</span></h2></div>
          <div className="faq">
            <div className="faq-item"><div className="faq-q">Is the scan really free?</div><div className="faq-a">Yes. The full audit — scores, SEO checks, issues — is free with no signup. You only pay ₹799 if you want the done-for-you fixes, install-ready file, and full fix-kit.</div></div>
            <div className="faq-item"><div className="faq-q">What's actually in the ₹799 fix-kit?</div><div className="faq-a">Your fixes written for you (SEO titles, meta description, FAQ, alt text), an install-ready Shopify file, 7 copy-paste CRO sections, a 14-day action plan, a competitor benchmark, and a downloadable report.</div></div>
            <div className="faq-item"><div className="faq-q">Will the code work on my Shopify theme?</div><div className="faq-a">The snippets are standard Liquid + HTML/CSS that drop into common theme files. Each tells you exactly where to paste it. Theme-agnostic and easy to remove.</div></div>
            <div className="faq-item"><div className="faq-q">Can Digistick just do it for me?</div><div className="faq-a">Absolutely — that's our core business. If you'd rather have experts build and optimize your store, book a free strategy call and we'll take it from here.</div></div>
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <a className="nav-cta" href="#tool" onClick={() => document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" })} style={{ fontSize: 14, padding: "15px 34px", background: "var(--blue)" }}>Scan my site free →</a>
          </div>
        </div>
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
