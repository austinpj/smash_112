"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) { router.push("/profile"); router.refresh(); }
        else setMsg("Account created. Check your email and click the confirmation link, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/"); router.refresh();
      }
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function switchTo(m) {
    setMode(m); setErr(""); setMsg("");
  }

  return (
    <div className="auth">
      <div className="auth-inner">
        <h1 className="auth-logo">SMASH</h1>
        <p className="auth-tag">Lift. Log. Level up.</p>
        <div className="chips">
          <span>🏋️ 100+ exercises</span>
          <span>📸 Food photo AI</span>
          <span>📈 Progress & PRs</span>
        </div>
      <form className="card" onSubmit={submit}>
        <div className="segmented">
          <span className={"knob" + (mode === "signup" ? " right" : "")} />
          <button type="button" className={mode === "signin" ? "on" : ""} onClick={() => switchTo("signin")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => switchTo("signup")}>Create account</button>
        </div>
        {mode === "signup" && (
          <div className="field slide-in">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)} required
              style={{ width: "100%", paddingRight: 46 }} />
            <button type="button" onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? "Hide password" : "Show password"}
              title={showPw ? "Hide password" : "Show password"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", padding: 8, cursor: "pointer",
                color: showPw ? "var(--accent)" : "var(--muted)", display: "flex" }}>
              {showPw ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <p className="muted small" style={{ textAlign: "center", marginBottom: 0 }}>
          Your data is private to your account.
        </p>
      </form>
      </div>
    </div>
  );
}
