"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthModal from "../AuthModal";

const TABS = ["Overview", "Issues", "How to fix", "History", "Competitor", "Fix-kit", "Settings"];
const NAV_ICON = { "Overview": "▦", "Issues": "⚠", "How to fix": "🛠", "History": "📈", "Competitor": "⚔", "Fix-kit": "🎁", "Settings": "⚙" };

function color(v) {
  if (v == null) return "var(--d-muted)";
  if (v >= 90) return "#16a34a";
  if (v >= 50) return "#d97706";
  return "#dc2626";
}
// Overall health is an average, so it needs gentler bands than per-metric Google scores.
function overallColor(v) {
  if (v == null) return "var(--d-muted)";
  if (v >= 70) return "#16a34a";
  if (v >= 50) return "#d97706";
  return "#dc2626";
}
function band(v) {
  if (v == null) return "—";
  if (v >= 85) return "Excellent";
  if (v >= 70) return "Good";
  if (v >= 50) return "Needs work";
  return "Poor";
}

function Gauge({ value, size = 132 }) {
  const r = size / 2 - 12, c = 2 * Math.PI * r, pct = value == null ? 0 : value / 100;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-line)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={overallColor(value)} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div className="gauge-c">
        <div className="gauge-v" style={{ color: overallColor(value) }}>{value ?? "—"}</div>
        <div className="gauge-b">{band(value)}</div>
      </div>
    </div>
  );
}

function Spark({ scans }) {
  const pts = scans.slice(0, 12).reverse().map((s) => s.overall || 0);
  if (pts.length < 2) return <div className="spark-empty">Not enough scans yet</div>;
  const w = 460, h = 90, max = 100, step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#sg)" opacity="0.15" />
      <path d={d} fill="none" stroke="var(--d-blue)" strokeWidth="2.5" />
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--d-blue)" /><stop offset="100%" stopColor="var(--d-blue)" stopOpacity="0" /></linearGradient></defs>
    </svg>
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
  const configured = supabaseConfigured();

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
    sb.auth.getUser().then(({ data }) => { setUser(data?.user || null); setLoading(false); if (data?.user) loadDataDeduped(); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { setUser(session?.user || null); if (session?.user) loadDataDeduped(); });
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
            setActive(r.site.id); setTab("Overview");
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

  if (loading) return <div className="dsh"><div className="dsh-load">Loading your dashboard…</div></div>;

  if (!configured) return (
    <div className="dsh"><div className="dsh-gate">
      <h2>Dashboard not configured</h2>
      <p>Add your Supabase keys in Vercel to enable accounts, then redeploy.</p>
      <a className="d-btn-y" href="/">← Back to scanner</a>
    </div></div>
  );

  if (!user) return (
    <div className="dsh"><div className="dsh-gate">
      <div className="d-logo">DIGI<span>STICK</span></div>
      <h2>Your SiteCheck dashboard</h2>
      <p>Log in to track your store's health, see exactly where you're lacking, and access your fix-kit anytime.</p>
      <button className="d-btn-y" onClick={() => setAuthOpen(true)}>Log in / Sign up</button>
      <a className="dsh-back" href="/">← Back to free scanner</a>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={setUser} />}
    </div></div>
  );

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

  // priority weighting: SEO/perf issues rank above generic
  const priority = [...failed].sort((a, b) => (b.weight || 1) - (a.weight || 1));

  return (
    <div className="dsh">
      <header className="dsh-top">
        <a href="/" className="d-logo sm">DIGI<span>STICK</span><i>SiteCheck</i></a>
        <div className="dsh-acct"><span className="dsh-mail">{user.email}</span><button onClick={logout}>Log out</button></div>
      </header>

      <div className="dsh-grid">
        <aside className="dsh-side">
          <div className="side-label">Sites</div>
          <div className="side-sites">
            {sites.map((s) => (
              <button key={s.id} className={`side-site ${active === s.id ? "on" : ""}`} onClick={() => { setActive(s.id); setTab("Overview"); setCompData(null); }}>
                <span className="ss-dot" style={{ background: color(scans.filter((x) => x.site_id === s.id)[0]?.overall) }} />
                <span className="ss-url">{(s.label || s.url).replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                {s.is_pro && <span className="ss-pro">PRO</span>}
              </button>
            ))}
          </div>
          <div className="side-add">
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSite()} placeholder="add yourstore.com" />
            <button onClick={addSite} disabled={busy === "adding"}>{busy === "adding" ? "…" : "Add"}</button>
          </div>

          {activeSite && (
            <>
              <div className="side-label" style={{ marginTop: 24 }}>Menu</div>
              <nav className="side-nav">
                {TABS.map((t) => {
                  const proTab = ["History", "Settings"].includes(t);
                  return (
                    <button key={t} className={`side-nav-item ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
                      <span className="sni-ic">{NAV_ICON[t]}</span>
                      <span className="sni-label">{t}</span>
                      {t === "Issues" && failed.length > 0 && <span className="sni-badge">{failed.length}</span>}
                      {proTab && !isPro && <span className="sni-lock">🔒</span>}
                    </button>
                  );
                })}
              </nav>
            </>
          )}

          {/* persistent Pro card */}
          {activeSite && !isPro && (
            <div className="side-pro">
              <div className="side-pro-glow" />
              <div className="side-pro-tag">⚡ UPGRADE</div>
              <div className="side-pro-h">Unlock Pro</div>
              <ul className="side-pro-list">
                <li>Score history & trends</li>
                <li>Saved fix-kit & blueprint</li>
                <li>Scheduled scans + alerts</li>
                <li>AI assistant access</li>
              </ul>
              <div className="side-pro-price"><span className="spp-old">₹1,499</span><span className="spp-new">₹799</span></div>
              <div className="side-pro-timer">🔥 Launch price ends in {launchLeft}</div>
              <button className="side-pro-btn" onClick={() => unlockPro(activeSite.url)}>Upgrade now</button>
            </div>
          )}
          {activeSite && isPro && (
            <div className="side-pro on">
              <div className="side-pro-tag good">✓ PRO ACTIVE</div>
              <div className="side-pro-h">You're on Pro</div>
              <p className="side-pro-thanks">All features unlocked for this site. Thank you!</p>
            </div>
          )}
        </aside>

        <main className="dsh-main">
          {/* In-dashboard scanning / unlocking loader */}
          {(busy === "scanning" || busy === "unlocking") && (
            <div className="dsh-scanning">
              <div className="dsh-scan-spinner" />
              <h3>{busy === "unlocking" ? "Confirming your payment…" : `Scanning ${(activeSite?.url || newUrl || "your store").replace(/^https?:\/\//, "").replace(/\/$/, "")}…`}</h3>
              <p>{busy === "unlocking" ? "Verifying with the payment provider and unlocking Pro for your store." : "Running Lighthouse, parsing SEO, checking accessibility & conversion. About 30 seconds."}</p>
              <div className="dsh-scan-bar"><span /></div>
            </div>
          )}

          {busy !== "scanning" && busy !== "unlocking" && !activeSite && <div className="dsh-empty"><h3>Add your first store</h3><p>Enter a URL on the left. We'll scan it and break down exactly where it's leaking sales.</p></div>}

          {busy !== "scanning" && busy !== "unlocking" && activeSite && (
            <>
              <div className="dsh-head">
                <div>
                  <h1>{activeSite.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</h1>
                  <span className="dsh-sub">{latest ? `Last scanned ${new Date(latest.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Not scanned yet"} · {siteScans.length} scan{siteScans.length !== 1 ? "s" : ""}</span>
                </div>
                <button className="d-rescan" onClick={() => runScan(activeSite.url, activeSite.id)} disabled={busy === "scanning"}>{busy === "scanning" ? "Scanning…" : "↻ Re-scan now"}</button>
              </div>

              {!latest && tab !== "Settings" && <div className="dsh-empty"><h3>No scan yet</h3><p>Hit "Re-scan now" to run the first audit on this store.</p></div>}

              {/* OVERVIEW */}
              {latest && tab === "Overview" && (
                <div className="ov">
                  <div className="ov-greet">
                    <div className="ov-greet-txt">
                      <h2>Welcome back{user.email ? ", " + user.email.split("@")[0] : ""}! 👋</h2>
                      <p>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
                    </div>
                    <div className={`ov-greet-badge ${latest.overall >= 70 ? "good" : latest.overall >= 50 ? "ok" : "low"}`}>
                      {latest.overall >= 85 ? "🎉 Your store is in great shape!" : latest.overall >= 70 ? "👍 Looking good — a few fixes left." : latest.overall >= 50 ? "⚙ Solid base — clear wins ahead." : "⚡ Big wins available — let's fix the leaks."}
                    </div>
                  </div>
                  <div className="ov-hero">
                    <div className="ov-gauge">
                      <Gauge value={latest.overall} />
                      <div className="ov-gauge-meta">
                        <div className="ov-gl">Overall health</div>
                        {delta != null && <div className={`ov-delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs last scan</div>}
                      </div>
                    </div>
                    <div className="ov-stats">
                      {[["Performance", "performance"], ["SEO", "seo"], ["Accessibility", "accessibility"], ["Best practices", "bestPractices"]].map(([lbl, key]) => (
                        <div className="ov-stat" key={key}>
                          <div className="ov-stat-v" style={{ color: color(latest.scores?.[key]) }}>{latest.scores?.[key] ?? "—"}</div>
                          <div className="ov-stat-l">{lbl}</div>
                          <div className="ov-stat-bar"><span style={{ width: (latest.scores?.[key] || 0) + "%", background: color(latest.scores?.[key]) }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ov-row">
                    <div className="ov-card good"><div className="ov-card-n">{passed.length}</div><div className="ov-card-l">Checks passing</div></div>
                    <div className="ov-card bad"><div className="ov-card-n">{failed.length}</div><div className="ov-card-l">Issues to fix</div></div>
                    <div className="ov-card"><div className="ov-card-n">{checks.length}</div><div className="ov-card-l">Total checks run</div></div>
                    <div className="ov-card"><div className="ov-card-n">{isPro ? "Pro" : "Free"}</div><div className="ov-card-l">Plan</div></div>
                  </div>
                  {priority.length > 0 && (
                    <div className="ov-next">
                      <div className="ov-next-h">Fix these first</div>
                      {priority.slice(0, 3).map((c) => <div className="ov-next-item" key={c.label}><span className="dot bad" />{c.label}<span className="ov-next-d">{c.detail}</span></div>)}
                      <button className="ov-next-all" onClick={() => setTab("Issues")}>See all {failed.length} issues →</button>
                    </div>
                  )}

                  {/* Quick actions + insight widgets fill the space and aid navigation */}
                  <div className="ov-widgets">
                    <div className="ov-w">
                      <div className="ov-w-h">⚡ Quick actions</div>
                      <button className="ov-w-act" onClick={() => runScan(activeSite.url, activeSite.id)} disabled={busy === "scanning"}>{busy === "scanning" ? "Scanning…" : "↻ Re-scan this store"}</button>
                      <button className="ov-w-act" onClick={() => setTab("Issues")}>⚠ Review {failed.length} open issues</button>
                      <button className="ov-w-act" onClick={() => setTab("How to fix")}>🛠 See how to fix them</button>
                      {!isPro && <button className="ov-w-act primary" onClick={() => unlockPro(activeSite.url)}>🔓 Unlock Pro — ₹799</button>}
                    </div>
                    <div className="ov-w">
                      <div className="ov-w-h">💡 Insight</div>
                      <p className="ov-w-tip">{
                        latest.scores?.performance != null && latest.scores.performance < 60
                          ? "Your Performance score is your biggest lever right now — faster pages directly lift conversions and Google ranking."
                          : failed.find((c) => /alt/i.test(c.label))
                          ? "Missing image alt text hurts both accessibility and SEO. It's one of the quickest wins on your list."
                          : failed.find((c) => /meta description/i.test(c.label))
                          ? "Adding meta descriptions improves click-through from Google search results — easy ranking win."
                          : "You're in good shape. Re-scan after each change to watch your score climb and prove the impact."
                      }</p>
                      <div className="ov-w-meta">{checks.length} checks · last scan {new Date(latest.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>

                  {/* Free vs Pro comparison — conversion driver */}
                  {!isPro && (
                    <div className="cmp-pro">
                      <div className="cmp-pro-h">
                        <div><h3>You're on the Free plan</h3><p>You can see the problems. Pro gives you the fixes, tracking, and tools to actually solve them.</p></div>
                        <div className="cmp-pro-save">Save ₹700 · launch price</div>
                      </div>
                      <div className="cmp-pro-grid">
                        <div className="cmp-col-h"></div><div className="cmp-col-h free">Free</div><div className="cmp-col-h pro">Pro ₹799</div>
                        {[["Site health score & issues", true, true], ["Prioritized fix list", true, true], ["How-to-fix guidance", "Basic", "Full + copy-paste code"], ["Score history & trends", false, true], ["Saved fix-kit & growth blueprint", false, true], ["Scheduled scans + drop alerts", false, true], ["AI assistant", false, true]].map(([label, f, p], i) => (
                          <div className="cmp-line" key={i}>
                            <div className="cmp-feat">{label}</div>
                            <div className="cmp-cell">{f === true ? "✓" : f === false ? "—" : <span className="cmp-part">{f}</span>}</div>
                            <div className="cmp-cell pro">{p === true ? "✓" : <span className="cmp-part">{p}</span>}</div>
                          </div>
                        ))}
                      </div>
                      <button className="cmp-pro-btn" onClick={() => unlockPro(activeSite.url)}>Unlock Pro for {activeSite.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} — ₹799</button>
                      <div className="cmp-pro-note">🔥 Launch price ends in {launchLeft} · one-time payment, no subscription</div>
                    </div>
                  )}
                </div>
              )}

              {/* ISSUES — prioritized */}
              {latest && tab === "Issues" && (
                <div className="iss">
                  <div className="iss-head"><h3>Prioritized issues</h3><span>Ranked by impact on sales & ranking</span></div>
                  {priority.length === 0 && <div className="dsh-empty"><h3>No issues 🎉</h3><p>Every check passed on the last scan.</p></div>}
                  {priority.map((c, i) => (
                    <div className="iss-row" key={c.label}>
                      <span className="iss-rank">{i + 1}</span>
                      <div className="iss-body"><div className="iss-label">{c.label}</div><div className="iss-detail">{c.detail}</div></div>
                      <span className={`iss-tag ${(c.weight || 1) >= 3 ? "high" : (c.weight || 1) >= 2 ? "med" : "low"}`}>{(c.weight || 1) >= 3 ? "High" : (c.weight || 1) >= 2 ? "Medium" : "Low"} impact</span>
                    </div>
                  ))}
                  {passed.length > 0 && <div className="iss-passed"><div className="iss-passed-h">Passing ({passed.length})</div>{passed.map((c) => <span className="iss-pass" key={c.label}>✓ {c.label}</span>)}</div>}
                </div>
              )}

              {/* HOW TO FIX */}
              {latest && tab === "How to fix" && (
                <div className="fix">
                  <div className="iss-head"><h3>How to fix each issue</h3><span>Step-by-step guidance for your failed checks</span></div>
                  {failed.length === 0 && <div className="dsh-empty"><h3>Nothing to fix</h3><p>All checks passing.</p></div>}
                  {failed.map((c) => (
                    <details className="fix-item" key={c.label}>
                      <summary><span className="dot bad" />{c.label}</summary>
                      <div className="fix-body">
                        <p><b>What's wrong:</b> {c.detail}</p>
                        <p><b>Why it matters:</b> {c.why || "This affects how customers and search engines experience your store."}</p>
                        <p><b>How to fix:</b> {c.fix || "Open the relevant section in your store editor and apply the recommended change. The ₹799 fix-kit gives you copy-paste code for this."}</p>
                        {!isPro && <button className="fix-pro" onClick={() => unlockPro(activeSite.url)}>Unlock copy-paste fix in the ₹799 kit →</button>}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {/* HISTORY */}
              {tab === "History" && (
                <div className="hist">
                  <div className="iss-head"><h3>Score history</h3><span>Track your overall health over time</span>{!isPro && <span className="lock">PRO</span>}</div>
                  {isPro ? (
                    <>
                      <div className="hist-chart"><Spark scans={siteScans} /></div>
                      <div className="hist-table">
                        {siteScans.map((s) => (
                          <div className="hist-row" key={s.id}>
                            <span>{new Date(s.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                            <span className="hist-score" style={{ color: color(s.overall) }}>{s.overall}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <div className="pro-wall"><div><b>Score history is a Pro feature.</b><p>Unlock the ₹799 fix-kit to track your scores over time and prove your fixes are working.</p></div><button className="d-btn-y" onClick={() => unlockPro(activeSite.url)}>Unlock Pro — ₹799</button></div>}
                </div>
              )}

              {/* COMPETITOR */}
              {tab === "Competitor" && (
                <div className="comp">
                  <div className="iss-head"><h3>Competitor comparison</h3><span>See how you stack up against any store</span></div>
                  <div className="comp-input"><input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCompetitor()} placeholder="competitor.com" /><button onClick={runCompetitor} disabled={busy === "comp"}>{busy === "comp" ? "Scanning…" : "Compare"}</button></div>
                  {compData && latest && (
                    <div className="comp-grid">
                      <div className="comp-col"><div className="comp-name">You</div><div className="comp-url">{activeSite.url.replace(/^https?:\/\//, "")}</div></div>
                      <div className="comp-col mid">Metric</div>
                      <div className="comp-col"><div className="comp-name">Them</div><div className="comp-url">{compData.url.replace(/^https?:\/\//, "")}</div></div>
                      {[["Overall", latest.overall, Math.round(Object.values(compData.scores || {}).reduce((a, b) => a + b, 0) / 4)], ["Performance", latest.scores?.performance, compData.scores?.performance], ["SEO", latest.scores?.seo, compData.scores?.seo], ["Accessibility", latest.scores?.accessibility, compData.scores?.accessibility], ["Best practices", latest.scores?.bestPractices, compData.scores?.bestPractices]].map(([m, you, them]) => (
                        <div className="comp-line" key={m}>
                          <div className="comp-v" style={{ color: color(you) }}>{you ?? "—"}{you > them && <span className="win">▲</span>}</div>
                          <div className="comp-m">{m}</div>
                          <div className="comp-v" style={{ color: color(them) }}>{them ?? "—"}{them > you && <span className="win">▲</span>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!compData && <div className="dsh-empty sm"><p>Enter a competitor's URL to run a side-by-side comparison.</p></div>}
                </div>
              )}

              {/* FIX-KIT */}
              {tab === "Fix-kit" && (
                <div className="kit">
                  <div className="iss-head"><h3>Your saved fix-kit</h3><span>Reports & blueprints you've purchased</span></div>
                  {siteReports.length === 0 ? (
                    isPro ? <div className="dsh-empty sm"><p>Your purchased fix-kit will appear here.</p></div>
                    : <div className="pro-wall"><div><b>No fix-kit yet.</b><p>Unlock the ₹799 kit to get written fixes, a growth blueprint, and copy-paste snippets saved to your account.</p></div><button className="d-btn-y" onClick={() => unlockPro(activeSite.url)}>Get the fix-kit — ₹799</button></div>
                  ) : siteReports.map((r) => (
                    <div className="kit-item" key={r.id}><div><b>Fix-kit</b><span>{new Date(r.created_at).toLocaleDateString("en-IN")}</span></div><a href={"/?audit=" + encodeURIComponent(activeSite.url)}>Open →</a></div>
                  ))}
                </div>
              )}

              {/* SETTINGS */}
              {tab === "Settings" && (
                <div className="settings">
                  <div className="iss-head"><h3>Settings & alerts</h3><span>Automated monitoring for this store</span>{!isPro && <span className="lock">PRO</span>}</div>
                  <div className={`set-card ${!isPro ? "locked" : ""}`}>
                    <div className="set-row"><div><b>Scheduled re-scans</b><p>Automatically re-audit this store and track changes.</p></div>
                      <select disabled={!isPro} defaultValue={activeSite.scan_freq || "off"} onChange={async (e) => { await api("saveSettings", { site_id: active, scan_freq: e.target.value }); await loadData(); }}><option value="off">Off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                    <div className="set-row"><div><b>Score-drop alerts</b><p>Get an email if your overall health falls.</p></div>
                      <label className="switch"><input type="checkbox" disabled={!isPro} defaultChecked={!!activeSite.alerts_on} onChange={async (e) => { await api("saveSettings", { site_id: active, alerts_on: e.target.checked }); await loadData(); }} /><span /></label></div>
                    {!isPro && <button className="d-btn-y sm" onClick={() => unlockPro(activeSite.url)}>Unlock Pro to enable — ₹799</button>}
                    {isPro && <p className="set-note">Scheduled scans run in the background. You'll see new entries appear under History.</p>}
                  </div>
                  <div className="set-card danger"><div className="set-row"><div><b>Remove site</b><p>Stop tracking this store and delete its scans.</p></div><button className="set-del" onClick={async () => { if (confirm("Remove this site?")) { await api("removeSite", { site_id: active }); setActive(null); await loadData(); } }}>Remove</button></div></div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
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
