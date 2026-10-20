"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

// Opened from the "reset password" email link — choose a new password here.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (p1.length < 6) return setErr("Password must be at least 6 characters.");
    if (p1 !== p2) return setErr("The two passwords don't match.");
    setErr(""); setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => { router.push("/"); router.refresh(); }, 1500);
  }

  return (
    <div style={{ maxWidth: 440, margin: "24px auto" }}>
      <h1>Set a new password 🔑</h1>
      <form className="card" onSubmit={submit}>
        {done ? (
          <p style={{ margin: 0 }}>✅ Password changed! Taking you to Smash…</p>
        ) : (
          <>
            <div className="field"><label>New password</label>
              <PasswordInput value={p1} onChange={(e) => setP1(e.target.value)} minLength={6} autoComplete="new-password" required autoFocus /></div>
            <div className="field"><label>Type it again</label>
              <PasswordInput value={p2} onChange={(e) => setP2(e.target.value)} minLength={6} autoComplete="new-password" required /></div>
            {err && <p className="error">{err}</p>}
            <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
          </>
        )}
      </form>
    </div>
  );
}
