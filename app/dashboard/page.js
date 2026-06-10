"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthModal from "../AuthModal";

function scoreColor(v) {
  if (v == null) return "var(--muted)";
  if (v >= 90) return "var(--good)";
  if (v >= 50) return "var(--warn)";
  return "var(--bad)";
}

function MiniRing({ value, label }) {
  const r = 30, c = 2 * Math.PI * r, pct = value == null ? 0 : value / 100;
  return (
    <div className="dring">
      <svg width="74" height="74" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="37" cy="37" r={r} fill="none" stroke={scoreColor(value)} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 37 37)" />
      </svg>
      <div className="dring-val" style={{ color: scoreColor(value) }}>{value ?? "—"}</div>
      <div className="dring-lbl">{label}</div>
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
  const [newUrl, setNewUrl] = useState("");
  const [busy, setBusy] = useState("");
  const configured = supabaseConfigured();

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
    if (r.sites) { setSites(r.sites); setScans(r.scans || []); if (!active && r.sites[0]) setActive(r.sites[0].id); }
  }, [api, active]);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setLoading(false);
      if (data?.user) loadData();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
      if (session?.user) loadData();
    });
    return () => sub?.subscription?.unsubscribe();
  }, [configured]); // eslint-disable-line

  async function runScan(siteUrl, siteId) {
    setBusy("scanning");
    try {
      const res = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: siteUrl }) });
      const data = await res.json();
      if (res.ok) {
        await api("saveScan", { site_id: siteId, scores: data.pagespeed?.scores, checks: data.seo?.checks });
        await loadData();
      }
    } finally { setBusy(""); }
  }

  async function addSite() {
    if (!newUrl.trim()) return;
    setBusy("adding");
    const r = await api("addSite", { url: newUrl.trim() });
    setNewUrl("");
    if (r.site) { await loadData(); setActive(r.site.id); await runScan(r.site.url, r.site.id); }
    setBusy("");
  }

  async function logout() { const sb = getSupabase(); await sb?.auth.signOut(); setUser(null); setSites([]); setScans([]); }

  if (loading) return <div className="dash-wrap"><div className="dash-loading">Loading…</div></div>;

  if (!configured) {
    return <div className="dash-wrap"><div className="dash-empty">
      <h2>Dashboard not configured yet</h2>
      <p>Add your Supabase keys (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) and the service role key in Vercel to enable accounts.</p>
      <a className="btn-yellow" href="/" style={{ display: "inline-block", width: "auto", padding: "12px 24px" }}>← Back to scanner</a>
    </div></div>;
  }

  if (!user) {
    return (
      <div className="dash-wrap">
        <div className="dash-empty">
          <div className="auth-logo">DIGI<span className="sq">STICK</span></div>
          <h2>Your SiteCheck dashboard</h2>
          <p>Log in to track your store's health, see exactly where you're lacking, and access your fix-kit anytime.</p>
          <button className="btn-yellow" onClick={() => setAuthOpen(true)} style={{ width: "auto", padding: "13px 28px" }}>Log in / Sign up</button>
          <a className="dash-back" href="/">← Back to free scanner</a>
        </div>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={setUser} />}
      </div>
    );
  }

  const activeSite = sites.find((s) => s.id === active);
  const siteScans = scans.filter((s) => s.site_id === active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latest = siteScans[0];
  const checks = latest?.checks || [];
  const groups = { "SEO & technical": checks.filter((c) => c.cat !== "cro"), "Conversion (CRO)": checks.filter((c) => c.cat === "cro") };

  return (
    <div className="dash-wrap">
      <div className="dash-top">
        <a href="/" className="logo">DIGI<span className="sq">STICK</span> <span className="dash-tag">Dashboard</span></a>
        <div className="dash-user">{user.email}<button onClick={logout}>Log out</button></div>
      </div>

      <div className="dash-body">
        <aside className="dash-side">
          <div className="dash-side-h">Your sites</div>
          {sites.map((s) => (
            <button key={s.id} className={`site-item ${active === s.id ? "on" : ""}`} onClick={() => setActive(s.id)}>
              <span className="site-url">{s.label || s.url.replace(/^https?:\/\//, "")}</span>
              {s.is_pro && <span className="pro-badge">PRO</span>}
            </button>
          ))}
          <div className="add-site">
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSite()} placeholder="yourstore.com" />
            <button onClick={addSite} disabled={busy === "adding"}>{busy === "adding" ? "…" : "+ Add"}</button>
          </div>
        </aside>

        <main className="dash-main">
          {!activeSite && <div className="dash-empty2">Add a site to get started — we'll scan it and show you exactly where it's lacking.</div>}

          {activeSite && (
            <>
              <div className="dash-site-head">
                <div>
                  <h2>{activeSite.url.replace(/^https?:\/\//, "")}</h2>
                  {latest && <span className="dash-when">Last scanned {new Date(latest.created_at).toLocaleString("en-IN")}</span>}
                </div>
                <button className="rescan" onClick={() => runScan(activeSite.url, activeSite.id)} disabled={busy === "scanning"}>{busy === "scanning" ? "Scanning…" : "↻ Re-scan"}</button>
              </div>

              {!latest && <div className="dash-empty2">No scan yet. Hit Re-scan to run the first audit.</div>}

              {latest && (
                <>
                  <div className="dash-rings">
                    <div className="overall"><div className="overall-num" style={{ color: scoreColor(latest.overall) }}>{latest.overall ?? "—"}</div><div className="overall-lbl">Overall health</div></div>
                    <MiniRing value={latest.scores?.performance} label="Performance" />
                    <MiniRing value={latest.scores?.seo} label="SEO" />
                    <MiniRing value={latest.scores?.accessibility} label="Accessibility" />
                    <MiniRing value={latest.scores?.bestPractices} label="Best Practices" />
                  </div>

                  {Object.entries(groups).map(([name, list]) => list.length > 0 && (
                    <div key={name}>
                      <div className="dash-group-h">{name} <span className="dash-fail">{list.filter((c) => !c.ok).length} to fix</span></div>
                      <div className="dash-checks">
                        {list.map((c) => (
                          <div className="dash-check" key={c.label}>
                            <span className={`icon ${c.ok ? "ok" : "no"}`}>{c.ok ? "✓" : "✕"}</span>
                            <div><div className="dc-label">{c.label}</div><div className="dc-detail">{c.detail}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* PRO: history trend */}
                  <div className="dash-group-h">Score history {!activeSite.is_pro && <span className="pro-lock">PRO</span>}</div>
                  {activeSite.is_pro ? (
                    siteScans.length > 1 ? (
                      <div className="trend">
                        {siteScans.slice(0, 12).reverse().map((s, i) => (
                          <div className="trend-bar" key={i} title={new Date(s.created_at).toLocaleDateString("en-IN")}>
                            <div className="trend-fill" style={{ height: (s.overall || 0) + "%", background: scoreColor(s.overall) }} />
                            <span>{s.overall}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="dash-empty2">Re-scan over time to build your trend line.</div>
                  ) : (
                    <div className="pro-upsell">
                      <div>📈 Track your scores over time, save your fix-kit &amp; growth blueprint, and use the AI assistant.</div>
                      <a className="btn-yellow" href={"/?audit=" + encodeURIComponent(activeSite.url)} style={{ width: "auto", padding: "11px 22px" }}>Unlock Pro — ₹799</a>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
