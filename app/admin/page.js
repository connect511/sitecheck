"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabaseClient";
import AuthModal from "../AuthModal";
import I from "../lib/icons";

const STAGES = ["new", "contacted", "proposal", "won", "lost"];
const STAGE_LABEL = { new: "New", contacted: "Contacted", proposal: "Proposal", won: "Won", lost: "Lost" };
const KINDS = [["note", "Note"], ["recommendation", "Recommendation"], ["offer", "Offer"]];

function hostOf(u) { return (u || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }
function inr(n) { return "₹" + (n || 0).toLocaleString("en-IN"); }
function ago(t) {
  const ms = Date.now() - new Date(t).getTime();
  const d = Math.floor(ms / 864e5);
  if (d > 30) return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (d >= 1) return d + "d ago";
  const h = Math.floor(ms / 36e5);
  if (h >= 1) return h + "h ago";
  return Math.max(1, Math.floor(ms / 6e4)) + "m ago";
}
function scoreColor(v) { if (v == null) return "var(--g-muted)"; if (v >= 70) return "var(--g-success)"; if (v >= 50) return "#d97706"; return "var(--g-danger)"; }

const BK_STATUSES = ["paid", "confirmed", "completed", "cancelled"];
const BK_LABEL = { pending: "Awaiting payment", paid: "Paid", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [detail, setDetail] = useState(null);   // { user, sites, scans, reports, messages }
  const [busy, setBusy] = useState("");
  const [msgTo, setMsgTo] = useState(null);     // client object being messaged
  const [msg, setMsg] = useState({ title: "", body: "", kind: "recommendation", site_id: "" });
  const [view, setView] = useState("clients");   // clients | bookings | inbox
  const [bookings, setBookings] = useState([]);
  const [threads, setThreads] = useState([]);
  const [thread, setThread] = useState(null);    // open thread
  const [tReply, setTReply] = useState("");
  const configured = supabaseConfigured();

  const token = useCallback(async () => {
    const sb = getSupabase(); if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  }, []);

  const api = useCallback(async (action, payload) => {
    const t = await token();
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ action, payload }) });
    const j = await res.json().catch(() => ({}));
    if (res.status === 403) { setDenied(true); return null; }
    return j;
  }, [token]);

  const loadOverview = useCallback(async () => {
    const [r, b, t] = await Promise.all([api("overview"), api("listBookings"), api("listThreads")]);
    if (r?.stats) { setStats(r.stats); setClients(r.clients || []); }
    if (b?.bookings) setBookings(b.bookings);
    if (t?.threads) setThreads(t.threads);
  }, [api]);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    const sb = getSupabase();
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data?.user || null);
      if (data?.user) await loadOverview();
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(async (_e, s) => { setUser(s?.user || null); if (s?.user) { setLoading(true); await loadOverview(); setLoading(false); } });
    return () => sub?.subscription?.unsubscribe();
  }, [configured, loadOverview]);

  async function openDetail(c) {
    setBusy("detail");
    const r = await api("clientDetail", { user_id: c.id });
    setBusy("");
    if (r?.user) setDetail(r);
  }
  async function setStage(site_id, status) {
    await api("setLeadStatus", { site_id, status });
    setClients((cs) => cs.map((c) => ({ ...c, sites: c.sites.map((s) => s.id === site_id ? { ...s, lead_status: status } : s) })));
    if (detail) setDetail((d) => ({ ...d, sites: d.sites.map((s) => s.id === site_id ? { ...s, lead_status: status } : s) }));
  }
  async function sendMsg() {
    if (!msg.title.trim() || !msg.body.trim() || !msgTo) return;
    setBusy("send");
    const r = await api("sendMessage", { user_id: msgTo.id, site_id: msg.site_id || null, title: msg.title, body: msg.body, kind: msg.kind });
    setBusy("");
    if (r?.ok) {
      setMsg({ title: "", body: "", kind: "recommendation", site_id: "" });
      setMsgTo(null);
      if (detail?.user?.id === r.message.user_id) setDetail((d) => ({ ...d, messages: [r.message, ...d.messages] }));
      setClients((cs) => cs.map((c) => c.id === r.message.user_id ? { ...c, messages: c.messages + 1 } : c));
      alert("Message sent — it now shows in the client's dashboard.");
    } else alert(r?.error || "Could not send.");
  }
  async function setBkStatus(id, status) {
    await api("setBookingStatus", { booking_id: id, status });
    setBookings((bs) => bs.map((b) => b.id === id ? { ...b, status } : b));
  }
  const admFileRef = useRef(null);
  const [admFile, setAdmFile] = useState(null);
  async function sendThreadReply() {
    const t = tReply.trim();
    if ((!t && !admFile) || !thread) return;
    let file_url = null, file_name = null;
    if (admFile) {
      const sb = getSupabase();
      const path = `admin/${Date.now()}_${admFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await sb.storage.from("chat-files").upload(path, admFile);
      if (upErr) { alert("Upload failed: " + upErr.message); return; }
      const { data: pub } = sb.storage.from("chat-files").getPublicUrl(path);
      file_url = pub?.publicUrl || null; file_name = admFile.name;
    }
    const r = await api("sendMessage", { user_id: thread.user_id, title: "", body: t || (file_name ? "📎 " + file_name : ""), kind: "note", file_url, file_name });
    if (r?.ok) {
      const m = r.message;
      setThread((th) => ({ ...th, messages: [...th.messages, m], last: m, needsReply: false }));
      setThreads((ts) => ts.map((x) => x.user_id === thread.user_id ? { ...x, messages: [...x.messages, m], last: m, needsReply: false } : x));
      setTReply(""); setAdmFile(null);
    } else alert(r?.error || "Could not send.");
  }
  async function logout() { const sb = getSupabase(); await sb?.auth.signOut(); setUser(null); setStats(null); }

  /* ---- Gates ---- */
  if (loading) return <div className="gcc adm"><div className="gcc-load">Loading admin panel…</div></div>;
  if (!configured) return <div className="gcc adm"><div className="gcc-gate"><h2>Backend not configured</h2><p>Add Supabase keys in Vercel and redeploy.</p></div></div>;
  if (!user) return (
    <div className="gcc adm"><div className="gcc-gate">
      <div className="g-logo">DIGI<span>STICK</span><i>ADMIN</i></div>
      <h2>Digistick back office</h2>
      <p>Sign in with an authorized admin account to manage clients.</p>
      <button className="g-btn-primary" onClick={() => setAuthOpen(true)}>Log in</button>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={setUser} />}
    </div></div>
  );
  if (denied) return (
    <div className="gcc adm"><div className="gcc-gate">
      <h2>Not authorized</h2>
      <p>{user.email} is not on the admin list. Add it to the <b>ADMIN_EMAILS</b> environment variable in Vercel and redeploy.</p>
      <button className="g-btn-primary" onClick={logout}>Switch account</button>
    </div></div>
  );

  const shown = clients.filter((c) => {
    if (filter && !(c.email || "").toLowerCase().includes(filter.toLowerCase()) && !c.sites.some((s) => s.url.includes(filter.toLowerCase()))) return false;
    if (stageFilter !== "all" && !c.sites.some((s) => (s.lead_status || "new") === stageFilter)) return false;
    return true;
  });

  return (
    <div className="gcc adm">
      <main className="g-main adm-main">
        <div className="adm-top">
          <div className="g-logo">DIGI<span>STICK</span><i>BACK OFFICE</i></div>
          <div className="adm-top-r"><span className="g-dim">{user.email}</span><button className="g-rescan" onClick={loadOverview}><I n="refresh" size={14} /> Refresh</button><button className="g-rescan" onClick={logout}>Log out</button></div>
        </div>

        {/* ---- Overview stats ---- */}
        {stats && (
          <div className="adm-stats">
            {[
              ["users", stats.users, "Total clients", `+${stats.newUsers7d} this week`],
              ["store", stats.sites, "Stores tracked", `${stats.scans} scans run`],
              ["star", stats.proSites, "Pro unlocks", `${stats.conversion}% conversion`],
              ["money", inr(stats.revenue), "Revenue (est.)", `${stats.messagesSent} messages sent`],
            ].map(([ic, v, l, sub]) => (
              <div className="g-card adm-stat" key={l}><span className="adm-stat-ic"><I n={ic} size={19} /></span><div className="adm-stat-v">{v}</div><div className="adm-stat-l">{l}</div><div className="adm-stat-sub">{sub}</div></div>
            ))}
          </div>
        )}

        {/* ---- View switcher ---- */}
        <div className="adm-tabs">
          {[["clients", "users", "Clients & Leads"], ["bookings", "calendar", `Bookings${bookings.filter((b) => b.status === "paid").length ? " (" + bookings.filter((b) => b.status === "paid").length + " new)" : ""}`], ["inbox", "chat", `Inbox${threads.filter((t) => t.needsReply).length ? " (" + threads.filter((t) => t.needsReply).length + ")" : ""}`]].map(([v, ic, lbl]) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}><I n={ic} size={14} /> {lbl}</button>
          ))}
        </div>

        {/* ---- Clients table ---- */}
        {view === "clients" && <div className="g-card">
          <div className="g-card-h">
            <h3>Clients & leads</h3>
            <input className="adm-search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search email or store…" />
            <select className="adm-stage-filter" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="adm-table">
            <div className="adm-tr head"><span>Client</span><span>Stores</span><span>Score</span><span>Plan</span><span>Lead stage</span><span>Last active</span><span></span></div>
            {shown.map((c) => (
              <div className="adm-tr" key={c.id}>
                <span className="adm-email">{c.email || c.id.slice(0, 8)}<i>{c.scans} scans · {c.messages} msgs</i></span>
                <span className="adm-sites">{c.sites.length ? c.sites.map((s) => <em key={s.id}>{hostOf(s.url)}</em>) : <i className="g-dim">no store yet</i>}</span>
                <span>{c.sites[0] ? <b style={{ color: scoreColor(c.sites[0].latest_score) }}>{c.sites[0].latest_score ?? "—"}</b> : "—"}</span>
                <span>{c.is_pro ? <b className="adm-pro">PRO</b> : <i className="g-dim">Free</i>}</span>
                <span>
                  {c.sites[0] ? (
                    <select className="adm-stage" value={c.sites[0].lead_status || "new"} onChange={(e) => setStage(c.sites[0].id, e.target.value)}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  ) : "—"}
                </span>
                <span className="g-dim">{ago(c.last_activity)}</span>
                <span className="adm-actions">
                  <button className="g-btn-ghost dark sm2" onClick={() => openDetail(c)}>{busy === "detail" ? "…" : "View"}</button>
                  <button className="g-btn-primary sm" onClick={() => { setMsgTo(c); setMsg((m) => ({ ...m, site_id: c.sites[0]?.id || "" })); }}>Message</button>
                </span>
              </div>
            ))}
            {shown.length === 0 && <p className="g-dim" style={{ padding: 18 }}>No clients match.</p>}
          </div>
        </div>}

        {/* ---- Bookings ---- */}
        {view === "bookings" && (
          <div className="g-card">
            <div className="g-card-h"><h3>Service bookings & allotments</h3><span className="g-chip">{bookings.length} total</span></div>
            <div className="adm-table">
              <div className="adm-tr bk head"><span>Client</span><span>Service</span><span>Specialist</span><span>Advance / Total</span><span>Phone</span><span>Status</span><span>Booked</span></div>
              {bookings.map((b) => (
                <div className="adm-tr bk" key={b.id}>
                  <span className="adm-email">{b.email}</span>
                  <span><b style={{ fontSize: 12.5 }}>{b.service_name}</b></span>
                  <span>{b.member_name}</span>
                  <span><b style={{ color: "var(--g-success)" }}>{inr(b.advance_amount)}</b> / {inr(b.price)}</span>
                  <span>{b.phone || "—"}</span>
                  <span>
                    {b.status === "pending" ? <i className="g-dim">Awaiting payment</i> : (
                      <select className="adm-stage" value={b.status} onChange={(e) => setBkStatus(b.id, e.target.value)}>
                        {BK_STATUSES.map((st) => <option key={st} value={st}>{BK_LABEL[st]}</option>)}
                      </select>
                    )}
                  </span>
                  <span className="g-dim">{ago(b.created_at)}</span>
                </div>
              ))}
              {bookings.length === 0 && <p className="g-dim" style={{ padding: 18 }}>No bookings yet.</p>}
            </div>
          </div>
        )}

        {/* ---- Inbox ---- */}
        {view === "inbox" && (
          <div className="adm-inbox">
            <div className="g-card adm-threads">
              <div className="g-card-h"><h3>Conversations</h3></div>
              {threads.length === 0 && <p className="g-dim">No messages yet.</p>}
              {threads.map((t) => (
                <button key={t.user_id} className={`adm-thread ${thread?.user_id === t.user_id ? "on" : ""}`} onClick={() => setThread(t)}>
                  <span className="bk-av">{(t.email || "?")[0].toUpperCase()}</span>
                  <div className="adm-thread-body">
                    <b>{t.email}</b>
                    <span>{t.last?.sender === "user" ? "Them: " : "You: "}{(t.last?.body || "").slice(0, 44)}</span>
                  </div>
                  {t.needsReply && <span className="adm-needs">Reply</span>}
                </button>
              ))}
            </div>
            <div className="g-card adm-convo">
              {!thread ? <div className="g-empty sm"><p>Select a conversation.</p></div> : (
                <>
                  <div className="g-card-h"><h3>{thread.email}</h3></div>
                  <div className="g-thread adm-thread-msgs">
                    {thread.messages.map((m) => (
                      <div className={`g-bubble ${m.sender === "user" ? "them" : "me"}`} key={m.id}>
                        {m.title && <b>{m.title}</b>}
                        <p>{m.body}</p>
                        {m.file_url && <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="g-bubble-file"><span>📎</span> {m.file_name || "Attachment"}</a>}
                        <time>{new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
                      </div>
                    ))}
                  </div>
                  <div className="g-reply">
                    <input type="file" ref={admFileRef} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setAdmFile(f); e.target.value = ""; }} />
                    <button className="g-attach-btn" onClick={() => admFileRef.current?.click()} title={admFile ? admFile.name : "Attach file"} style={admFile ? { borderColor: "var(--g-primary)", color: "var(--g-primary)" } : undefined}>📎</button>
                    <input value={tReply} onChange={(e) => setTReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendThreadReply()} placeholder={admFile ? `Attach: ${admFile.name}` : `Reply to ${thread.email}…`} />
                    <button onClick={sendThreadReply}><I n="send" size={15} /></button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ---- Client detail drawer ---- */}
      {detail && (
        <div className="adm-overlay" onClick={() => setDetail(null)}>
          <div className="adm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adm-d-head">
              <div><h3>{detail.user.email || "Client"}</h3><span className="g-dim">Joined {detail.user.created_at ? new Date(detail.user.created_at).toLocaleDateString("en-IN") : "—"} · {detail.reports.length} fix-kit{detail.reports.length !== 1 ? "s" : ""} purchased</span></div>
              <button className="ai-x dark" onClick={() => setDetail(null)}><I n="x" size={15} /></button>
            </div>

            <div className="adm-d-sec">Stores</div>
            {detail.sites.map((s) => {
              const sScans = detail.scans.filter((x) => x.site_id === s.id);
              const latest = sScans[0];
              const failed = (latest?.checks || []).filter((c) => !c.ok);
              return (
                <div className="adm-site" key={s.id}>
                  <div className="adm-site-top">
                    <b>{hostOf(s.url)}</b>
                    {s.is_pro && <span className="adm-pro">PRO</span>}
                    <select className="adm-stage" value={s.lead_status || "new"} onChange={(e) => setStage(s.id, e.target.value)}>
                      {STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
                    </select>
                    <b className="adm-site-score" style={{ color: scoreColor(latest?.overall) }}>{latest?.overall ?? "—"}</b>
                  </div>
                  {latest && <div className="adm-site-meta">{sScans.length} scans · last {ago(latest.created_at)} · {failed.length} open issues</div>}
                  {failed.slice(0, 4).map((c) => <div className="adm-issue" key={c.label}><I n="x" size={11} /> {c.label}</div>)}
                  {failed.length > 4 && <div className="g-dim" style={{ fontSize: 11 }}>+{failed.length - 4} more issues</div>}
                </div>
              );
            })}
            {detail.sites.length === 0 && <p className="g-dim">No stores added yet.</p>}

            <div className="adm-d-sec">Messages sent</div>
            {detail.messages.length === 0 && <p className="g-dim">None yet.</p>}
            {detail.messages.map((m) => (
              <div className="adm-msg" key={m.id}>
                <div className="adm-msg-top"><b>{m.title}</b><span className="g-dim">{ago(m.created_at)}{m.read_at ? " · ✓ read" : " · unread"}</span></div>
                <p>{m.body}</p>
              </div>
            ))}

            <button className="g-btn-primary" style={{ marginTop: 14, width: "100%" }} onClick={() => { setMsgTo({ id: detail.user.id, email: detail.user.email, sites: detail.sites }); setMsg((m) => ({ ...m, site_id: detail.sites[0]?.id || "" })); }}>+ Send message / recommendation</button>
          </div>
        </div>
      )}

      {/* ---- Message composer ---- */}
      {msgTo && (
        <div className="adm-overlay" onClick={() => setMsgTo(null)}>
          <div className="adm-compose" onClick={(e) => e.stopPropagation()}>
            <div className="adm-d-head"><h3>Message {msgTo.email}</h3><button className="ai-x dark" onClick={() => setMsgTo(null)}><I n="x" size={15} /></button></div>
            <div className="adm-c-row">
              <select value={msg.kind} onChange={(e) => setMsg((m) => ({ ...m, kind: e.target.value }))}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              {msgTo.sites?.length > 0 && (
                <select value={msg.site_id} onChange={(e) => setMsg((m) => ({ ...m, site_id: e.target.value }))}>
                  <option value="">All stores</option>
                  {msgTo.sites.map((s) => <option key={s.id} value={s.id}>{hostOf(s.url)}</option>)}
                </select>
              )}
            </div>
            <input className="adm-c-title" value={msg.title} onChange={(e) => setMsg((m) => ({ ...m, title: e.target.value }))} placeholder="Title — e.g. We can recover your speed score" />
            <textarea className="adm-c-body" value={msg.body} onChange={(e) => setMsg((m) => ({ ...m, body: e.target.value }))} rows={6} placeholder="Write your recommendation or offer. The client sees this in their dashboard under Messages." />
            <button className="g-btn-primary" style={{ width: "100%" }} onClick={sendMsg} disabled={busy === "send"}>{busy === "send" ? "Sending…" : "Send to client"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
