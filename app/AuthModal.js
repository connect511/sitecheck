"use client";

import { useState } from "react";
import { getSupabase } from "./lib/supabaseClient";
import I from "./lib/icons";

export default function AuthModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    const sb = getSupabase();
    if (!sb) { setMsg("Login isn't configured yet."); return; }
    if (!email || !password) { setMsg("Enter email and password."); return; }
    if (mode === "signup" && password.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    setBusy(true); setMsg("");
    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) { onAuthed?.(data.user); onClose?.(); return; }
        setMsg("Account created! Check your email to confirm, then log in.");
        setMode("login");
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed?.(data.user);
        onClose?.();
      }
    } catch (e) {
      setMsg(e.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  const isLogin = mode === "login";
  const PERKS = [
    ["chart", "Track your store's health over time"],
    ["target", "See exactly what's costing you sales"],
    ["wrench", "Get copy-paste fixes in your dashboard"],
    ["alert", "Alerts when your score drops"],
  ];

  return (
    <div className="au2-overlay" onClick={onClose}>
      <div className="au2-modal" onClick={(e) => e.stopPropagation()}>
        <button className="au2-x" onClick={onClose} aria-label="Close"><I n="x" size={15} /></button>

        <div className="au2-side">
          <div className="au2-logo">DIGI<span>STICK</span><i>SITECHECK</i></div>
          <div className="au2-side-body">
            <h2>{isLogin ? "Welcome back." : "Find where your store leaks sales."}</h2>
            <p className="au2-side-sub">{isLogin ? "Your Growth Workspace is waiting." : "Free scan, free dashboard. Pay only if you want the fixes done for you."}</p>
            <ul className="au2-perks">
              {PERKS.map(([ic, t]) => (
                <li key={t}><span className="au2-perk-ic"><I n={ic} size={15} /></span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="au2-side-foot"><I n="shield" size={13} /> Trusted by D2C brands &amp; Shopify stores</div>
        </div>

        <div className="au2-form">
          <div className="au2-tabs">
            <button className={isLogin ? "on" : ""} onClick={() => { setMode("login"); setMsg(""); }}>Log in</button>
            <button className={!isLogin ? "on" : ""} onClick={() => { setMode("signup"); setMsg(""); }}>Sign up</button>
          </div>
          <h3>{isLogin ? "Log in to your dashboard" : "Create your free account"}</h3>
          <p className="au2-sub">{isLogin ? "Pick up right where you left off." : "Takes 20 seconds. No card needed."}</p>

          <label className="au2-label">Email</label>
          <div className="au2-input"><I n="mail" size={15} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@store.com" autoComplete="email" /></div>

          <label className="au2-label">Password</label>
          <div className="au2-input"><I n="lock" size={15} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={isLogin ? "Your password" : "Min. 6 characters"} autoComplete={isLogin ? "current-password" : "new-password"} /></div>

          {msg && <div className="au2-msg">{msg}</div>}

          <button className="au2-cta" onClick={submit} disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"} <I n="arrowRight" size={14} /></button>

          <div className="au2-switch">
            {isLogin ? <>New to SiteCheck? <button onClick={() => { setMode("signup"); setMsg(""); }}>Create an account</button></>
              : <>Already have an account? <button onClick={() => { setMode("login"); setMsg(""); }}>Log in</button></>}
          </div>
          <div className="au2-legal">By continuing you agree to our <a href="/terms">Terms</a> &amp; <a href="/privacy">Privacy Policy</a>.</div>
        </div>
      </div>
    </div>
  );
}
