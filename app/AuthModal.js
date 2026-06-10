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
    setBusy(true); setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Account created! Check your email if confirmation is required, then log in.");
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

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-x" onClick={onClose}>×</button>
        <div className="auth-logo">DIGI<span className="sq">STICK</span></div>
        <h3 className="auth-h">{mode === "login" ? "Welcome back" : "Create your account"}</h3>
        <p className="auth-sub">{mode === "login" ? "Log in to see your dashboard and saved reports." : "Track your store's health and unlock your fix-kit."}</p>
        <input className="auth-input" type="email" placeholder="you@store.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="auth-btn" onClick={submit} disabled={busy}>{busy ? "…" : mode === "login" ? "Log in" : "Sign up"}</button>
        {msg && <div className="auth-msg">{msg}</div>}
        <div className="auth-switch">
          {mode === "login" ? (
            <>New here? <button onClick={() => { setMode("signup"); setMsg(""); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode("login"); setMsg(""); }}>Log in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
