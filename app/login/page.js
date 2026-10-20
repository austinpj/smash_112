"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Shown when an email link was expired or opened in a different browser
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "link") {
      setErr("That email link has expired or was opened in a different browser. Please ask for a new one and open it on the same phone/computer.");
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setMsg("If that email has a Smash account, a reset link is on its way. Open it on this same device to set a new password.");
      } else if (mode === "signup") {
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
        {mode === "forgot" ? (
          <div className="slide-in">
            <h2 style={{ marginTop: 0 }}>Forgot password? 🔑</h2>
            <p className="muted small">Enter your account email and we'll send you a link to set a new password.</p>
          </div>
        ) : (
          <div className="segmented">
            <span className={"knob" + (mode === "signup" ? " right" : "")} />
            <button type="button" className={mode === "signin" ? "on" : ""} onClick={() => switchTo("signin")}>Sign in</button>
            <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => switchTo("signup")}>Create account</button>
          </div>
        )}
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
        {mode !== "forgot" && (
          <div className="field">
            <div className="row between" style={{ alignItems: "baseline" }}>
              <label>Password</label>
              {mode === "signin" && (
                <button type="button" onClick={() => switchTo("forgot")}
                  style={{ background: "none", border: 0, padding: 0, marginBottom: 6, color: "var(--accent)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
        )}
        {err && <p className="error">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
        {mode === "forgot" ? (
          <p className="small" style={{ textAlign: "center", marginBottom: 0 }}>
            <button type="button" onClick={() => switchTo("signin")}
              style={{ background: "none", border: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", font: "inherit" }}>
              ← Back to sign in
            </button>
          </p>
        ) : (
          <p className="muted small" style={{ textAlign: "center", marginBottom: 0 }}>
            Your data is private to your account.
          </p>
        )}
      </form>
      </div>
    </div>
  );
}
