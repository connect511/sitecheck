"use client";

import { useState, useEffect } from "react";

const SCAN_MSGS = [
  "Resolving URL…",
  "Running Lighthouse audit…",
  "Parsing on-page SEO…",
  "Checking accessibility…",
  "Generating UX critique…",
  "Compiling report…",
];

function scoreColor(v) {
  if (v == null) return "var(--muted)";
  if (v >= 90) return "var(--good)";
  if (v >= 50) return "var(--warn)";
  return "var(--bad)";
}

function Ring({ value, name }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : value / 100;
  const color = scoreColor(value);
  return (
    <div className="gauge">
      <div className="ring">
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle
            cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="val" style={{ color }}>{value == null ? "—" : value}</div>
      </div>
      <div className="name">{name}</div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % SCAN_MSGS.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  async function runAudit() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    setMsgIdx(0);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const ps = data?.pagespeed;
  const seo = data?.seo;

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <span className="dot" />
          SiteCheck <small>by Digistick</small>
        </div>
        <span className="byline">v1.0 / diagnostic</span>
      </div>

      {!data && !loading && (
        <div className="hero">
          <h1>Your website has <span className="em">leaks</span>.<br />Find them in 30 seconds.</h1>
          <p>Paste any URL for an instant diagnostic across speed, SEO, accessibility, and conversion — no signup to scan.</p>
          <div className="bar">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAudit()}
              placeholder="yourstore.com"
              spellCheck={false}
            />
            <button onClick={runAudit} disabled={loading}>Scan site</button>
          </div>
          {error && <div className="err">{error}</div>}
        </div>
      )}

      {loading && (
        <div className="scanning">
          <div className="scanline" />
          <div className="status">{SCAN_MSGS[msgIdx]}</div>
        </div>
      )}

      {data && (
        <div className="results">
          <div className="bar" style={{ marginTop: 24 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAudit()} spellCheck={false} />
            <button onClick={runAudit} disabled={loading}>Re-scan</button>
          </div>
          {error && <div className="err">{error}</div>}

          {ps && (
            <>
              <div className="section-label">Health scores</div>
              <div className="gauges">
                <Ring value={ps.scores.performance} name="Performance" />
                <Ring value={ps.scores.seo} name="SEO" />
                <Ring value={ps.scores.accessibility} name="Accessibility" />
                <Ring value={ps.scores.bestPractices} name="Best Practices" />
              </div>

              <div className="section-label">Core web vitals</div>
              <div className="metrics">
                {[
                  ["LCP", ps.metrics.lcp], ["FCP", ps.metrics.fcp],
                  ["CLS", ps.metrics.cls], ["TBT", ps.metrics.tbt],
                  ["Speed Index", ps.metrics.speedIndex],
                ].map(([n, v]) => (
                  <div className="metric" key={n}>
                    <div className="m-val">{v || "—"}</div>
                    <div className="m-name">{n}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.pagespeedError && (
            <p className="err">Performance scan unavailable: {data.pagespeedError}</p>
          )}

          {seo && (
            <>
              <div className="section-label">On-page SEO & technical</div>
              <div className="checks">
                {seo.checks.map((c) => (
                  <div className="check" key={c.label}>
                    <span className={`icon ${c.ok ? "ok" : "no"}`}>{c.ok ? "✓" : "✕"}</span>
                    <div>
                      <div className="c-label">{c.label}</div>
                      <div className="c-detail">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.seoError && <p className="err">{data.seoError}</p>}

          {ps?.topIssues?.length > 0 && (
            <>
              <div className="section-label">Top fixes (by impact)</div>
              {ps.topIssues.map((i) => (
                <div className="issue" key={i.id}>
                  <div className="t">{i.title}</div>
                  {i.description && <div className="d">{i.description}</div>}
                </div>
              ))}
            </>
          )}

          {data.design && (
            <>
              <div className="section-label">UX & conversion read</div>
              <div className="critique">
                <div className="verdict">{data.design.verdict}</div>
                {data.design.wins?.length > 0 && (
                  <>
                    <h4>What's working</h4>
                    <ul>{data.design.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </>
                )}
                {data.design.fixes?.length > 0 && (
                  <>
                    <h4>High-impact fixes</h4>
                    <ul className="fixes">{data.design.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </>
                )}
              </div>
            </>
          )}

          <div className="cta">
            <h3>Want these fixed — not just flagged?</h3>
            <p>Digistick builds, optimizes, and scales high-converting stores. Get a free strategy call.</p>
            <a href="https://digistick.in" target="_blank" rel="noopener noreferrer">Book a free audit call →</a>
          </div>
        </div>
      )}

      <div className="foot">SITECHECK · DIGISTICK · NOIDA — DATA FROM GOOGLE LIGHTHOUSE & LIVE PAGE PARSE</div>
    </div>
  );
}
