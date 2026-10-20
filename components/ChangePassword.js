"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

// Profile page card: change your password (or get a reset email if you forgot the current one)
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function close() { setOpen(false); setCur(""); setP1(""); setP2(""); setErr(""); }

  async function save(e) {
    e.preventDefault();
    if (p1.length < 6) return setErr("New password must be at least 6 characters.");
    if (p1 !== p2) return setErr("The two new passwords don't match.");
    if (p1 === cur) return setErr("The new password is the same as the current one.");
    setErr(""); setMsg(""); setBusy(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    // Check the current password first, so nobody can change it on an unlocked phone
    const { error: wrong } = await supabase.auth.signInWithPassword({ email: session?.user?.email, password: cur });
    if (wrong) { setBusy(false); return setErr("Current password is wrong."); }
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(error.message);
    close();
    setMsg("Password changed.");
  }

  async function sendReset() {
    setErr(""); setMsg(""); setBusy(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.auth.resetPasswordForEmail(session?.user?.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    close();
    setMsg(`Reset link sent to ${session?.user?.email}. Open it on this device.`);
  }

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>🔑 Password</h2>
      <p className="muted small">Change the password you use to sign in to Smash.</p>

      {!open && <button className="btn secondary" onClick={() => { setMsg(""); setOpen(true); }}>Change password</button>}

      {open && (
        <form onSubmit={save}>
          <div className="field"><label>Current password</label>
            <PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} required autoFocus /></div>
          <div className="field"><label>New password</label>
            <PasswordInput value={p1} onChange={(e) => setP1(e.target.value)} minLength={6} autoComplete="new-password" required /></div>
          <div className="field"><label>Type new password again</label>
            <PasswordInput value={p2} onChange={(e) => setP2(e.target.value)} minLength={6} autoComplete="new-password" required /></div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
            <button type="button" className="btn secondary" onClick={close}>Cancel</button>
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            Forgot your current password?{" "}
            <button type="button" onClick={sendReset} disabled={busy}
              style={{ background: "none", border: 0, padding: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", font: "inherit" }}>
              Email me a reset link
            </button>
          </p>
        </form>
      )}

      {err && <p className="error">{err}</p>}
      {msg && !err && <p className="small" style={{ marginBottom: 0 }}>✓ {msg}</p>}
    </div>
  );
}
