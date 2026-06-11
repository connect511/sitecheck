"use client";

import { useState } from "react";
import { getSupabase } from "./lib/supabaseClient";
import I from "./lib/icons";

export default function AuthModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [step, setStep] = useState("form");  // form | otp  (signup only)
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);

  function note(text, isErr = false) { setMsg(text); setErr(isErr); }

  async function submit() {
    const sb = getSupabase();
    if (!sb) { note("Login isn't configured yet.", true); return; }
    if (!email || !password) { note("Enter email and password.", true); return; }
    if (mode === "signup" && password.length < 6) { note("Password must be at least 6 characters.", true); return; }
    setBusy(true); note("");
    try {
      if (mode === "signup") {
        // Sign up — Supabase emails a 6-digit code (when "Confirm email" is on + OTP token in template).
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { phone: phone.trim() } } });
        if (error) throw error;
        if (data.session) { onAuthed?.(data.user); onClose?.(); return; } // confirmation disabled → straight in
        setStep("otp");
        note("We sent a verification code to " + email + ". Enter it below.");
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed?.(data.user);
        onClose?.();
      }
    } catch (e) {
      note(e.message || "Something went wrong.", true);
    } finally { setBusy(false); }
  }

  async function verifyOtp() {
    const sb = getSupabase();
    const code = otp.replace(/\D/g, "");
    if (code.length < 6) { note("Enter the full code from your email.", true); return; }
    setBusy(true); note("");
    try {
      const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: "signup" });
      if (error) throw error;
      onAuthed?.(data.user);
      onClose?.();
    } catch (e) {
      note(e.message || "That code didn't work — check it and try again.", true);
    } finally { setBusy(false); }
  }

  async function resend() {
    const sb = getSupabase();
    setBusy(true); note("");
    try {
      const { error } = await sb.auth.resend({ type: "signup", email });
      if (error) throw error;
      note("A new code is on its way to " + email + ".");
    } catch (e) {
      note(e.message || "Couldn't resend — wait a moment and try again.", true);
    } finally { setBusy(false); }
  }

  function switchMode(m) { setMode(m); setStep("form"); setOtp(""); note(""); }

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
          {step === "otp" ? (
            <>
              <button className="au2-back" onClick={() => { setStep("form"); note(""); }}><I n="arrowRight" size={13} style={{ transform: "rotate(180deg)" }} /> Back</button>
              <div className="au2-otp-ic"><I n="mail" size={26} /></div>
              <h3>Verify your email</h3>
              <p className="au2-sub">Enter the code we sent to <b>{email}</b>.</p>

              <label className="au2-label">Verification code</label>
              <div className="au2-input au2-otp"><input inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && verifyOtp()} placeholder="Enter code" autoFocus /></div>

              {msg && <div className={err ? "au2-msg" : "au2-note"}>{msg}</div>}

              <button className="au2-cta" onClick={verifyOtp} disabled={busy}>{busy ? "Verifying…" : "Verify & continue"} <I n="arrowRight" size={14} /></button>
              <div className="au2-switch">Didn&apos;t get it? <button onClick={resend} disabled={busy}>Resend code</button></div>
            </>
          ) : (
            <>
              <div className="au2-tabs">
                <button className={isLogin ? "on" : ""} onClick={() => switchMode("login")}>Log in</button>
                <button className={!isLogin ? "on" : ""} onClick={() => switchMode("signup")}>Sign up</button>
              </div>
              <h3>{isLogin ? "Log in to your dashboard" : "Create your free account"}</h3>
              <p className="au2-sub">{isLogin ? "Pick up right where you left off." : "Takes 20 seconds. No card needed."}</p>

              <label className="au2-label">Email</label>
              <div className="au2-input"><I n="mail" size={15} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@store.com" autoComplete="email" /></div>

              {!isLogin && (<>
                <label className="au2-label">Phone</label>
                <div className="au2-input"><I n="phone" size={15} /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" autoComplete="tel" /></div>
              </>)}

              <label className="au2-label">Password</label>
              <div className="au2-input"><I n="lock" size={15} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={isLogin ? "Your password" : "Min. 6 characters"} autoComplete={isLogin ? "current-password" : "new-password"} /></div>

              {msg && <div className={err ? "au2-msg" : "au2-note"}>{msg}</div>}

              <button className="au2-cta" onClick={submit} disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Send verification code"} <I n="arrowRight" size={14} /></button>

              <div className="au2-switch">
                {isLogin ? <>New to SiteCheck? <button onClick={() => switchMode("signup")}>Create an account</button></>
                  : <>Already have an account? <button onClick={() => switchMode("login")}>Log in</button></>}
              </div>
              <div className="au2-legal">By continuing you agree to our <a href="/terms">Terms</a> &amp; <a href="/privacy">Privacy Policy</a>.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
