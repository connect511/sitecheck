"use client";

import { useState } from "react";
import { getSupabase } from "./lib/supabaseClient";

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
        // If email confirmation is off, session exists immediately → log them in.
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

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-x" onClick={onClose} aria-label="Close">×</button>

        {/* Left brand panel */}
        <div className="auth-side">
          <div className="auth-side-glow" />
          <div className="auth-logo">DIGI<span>STICK</span></div>
          <div className="auth-side-body">
            <h2>{isLogin ? "Welcome back." : "Find out where your store leaks sales."}</h2>
            <ul className="auth-perks">
              <li><span>📊</span> Track your store's health over time</li>
              <li><span>🎯</span> See exactly what's costing you sales</li>
              <li><span>🛠</span> Get copy-paste fixes in your dashboard</li>
              <li><span>🔔</span> Alerts when your score drops</li>
            </ul>
          </div>
          <div className="auth-side-foot">Trusted by D2C brands &amp; Shopify stores</div>
        </div>

        {/* Right form panel */}
        <div className="auth-form">
          <div className="auth-tabs">
            <button className={isLogin ? "on" : ""} onClick={() => { setMode("login"); setMsg(""); }}>Log in</button>
            <button className={!isLogin ? "on" : ""} onClick={() => { setMode("signup"); setMsg(""); }}>Sign up</button>
            <span className="auth-tab-ind" style={{ transform: isLogin ? "translateX(0)" : "translateX(100%)" }} />
          </div>

          <h3 className="auth-h">{isLogin ? "Log in to your dashboard" : "Create your free account"}</h3>
          <p className="auth-sub">{isLogin ? "Pick up right where you left off." : "No card needed. Your first scan saves instantly."}</p>

          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" placeholder="you@store.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />

          <label className="auth-label">Password</label>
          <input className="auth-input" type="password" placeholder={isLogin ? "Your password" : "At least 6 characters"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

          <button className="auth-btn" onClick={submit} disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Log in →" : "Create account →"}
          </button>

          {msg && <div className="auth-msg">{msg}</div>}

          <div className="auth-switch">
            {isLogin ? (
              <>New to SiteCheck? <button onClick={() => { setMode("signup"); setMsg(""); }}>Create an account</button></>
            ) : (
              <>Already have an account? <button onClick={() => { setMode("login"); setMsg(""); }}>Log in</button></>
            )}
          </div>
          <div className="auth-legal">By continuing you agree to our <a href="/terms" target="_blank">Terms</a> &amp; <a href="/privacy" target="_blank">Privacy Policy</a>.</div>
        </div>
      </div>
    </div>
  );
}
