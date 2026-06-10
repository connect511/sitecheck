"use client";

import { useState, useEffect, useCallback } from "react";
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
function band(v) { if (v == null) return "—"; if (v >= 90) return "Good"; if (v >= 50) return "Needs work"; return "Poor"; }

function Gauge({ value, size = 132 }) {
  const r = size / 2 - 12, c = 2 * Math.PI * r, pct = value == null ? 0 : value / 100;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-line)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color(value)} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div className="gauge-c">
        <div className="gauge-v" style={{ color: color(value) }}>{value ?? "—"}</div>
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

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => { setUser(data?.user || null); setLoading(false); if (data?.user) loadData(); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { setUser(session?.user || null); if (session?.user) loadData(); });
    return () => sub?.subscription?.unsubscribe();
  }, [configured]); // eslint-disable-line

  async function scan(url) {
    const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    return res.ok ? res.json() : null;
  }
  async function runScan(siteUrl, siteId) {
    setBusy("scanning");
    try { const d = await scan(siteUrl); if (d) { await api("saveScan", { site_id: siteId, scores: d.pagespeed?.scores, checks: d.seo?.checks }); await loadData(); } }
    finally { setBusy(""); }
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
              <a className="side-pro-btn" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Upgrade now</a>
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
          {!activeSite && <div className="dsh-empty"><h3>Add your first store</h3><p>Enter a URL on the left. We'll scan it and break down exactly where it's leaking sales.</p></div>}

          {activeSite && (
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
                    <div className={`ov-greet-badge ${latest.overall >= 90 ? "good" : latest.overall >= 50 ? "ok" : "low"}`}>
                      {latest.overall >= 90 ? "🎉 Your store is in great shape!" : latest.overall >= 50 ? "👍 Good progress — a few fixes to go." : "⚡ Big wins available — let's fix the leaks."}
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
                      <a className="cmp-pro-btn" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Unlock Pro for {activeSite.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} — ₹799</a>
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
                        {!isPro && <a className="fix-pro" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Unlock copy-paste fix in the ₹799 kit →</a>}
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
                  ) : <div className="pro-wall"><div><b>Score history is a Pro feature.</b><p>Unlock the ₹799 fix-kit to track your scores over time and prove your fixes are working.</p></div><a className="d-btn-y" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Unlock Pro — ₹799</a></div>}
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
                    : <div className="pro-wall"><div><b>No fix-kit yet.</b><p>Unlock the ₹799 kit to get written fixes, a growth blueprint, and copy-paste snippets saved to your account.</p></div><a className="d-btn-y" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Get the fix-kit — ₹799</a></div>
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
                      <select disabled={!isPro} defaultValue="off"><option value="off">Off</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                    <div className="set-row"><div><b>Score-drop alerts</b><p>Get notified if your overall health falls.</p></div>
                      <label className="switch"><input type="checkbox" disabled={!isPro} /><span /></label></div>
                    {!isPro && <a className="d-btn-y sm" href={"/?audit=" + encodeURIComponent(activeSite.url)}>Unlock Pro to enable — ₹799</a>}
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
