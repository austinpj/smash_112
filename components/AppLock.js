"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ───────────── Settings ─────────────
const LOCK_AFTER_MS = 30 * 60 * 1000; // lock after 30 minutes without use
const MAX_TRIES = 5;                   // wrong PINs before signing out
const ACTIVE_KEY = "smash-last-active";
const TRIES_KEY = "smash-lock-tries";
const cfgKey = (uid) => `smash-lock-${uid}`;

// ───────────── Small helpers ─────────────
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
function readLock(uid) {
  try { return JSON.parse(ls.get(cfgKey(uid)) || "null"); } catch { return null; }
}
function writeLock(uid, cfg) {
  if (cfg) ls.set(cfgKey(uid), JSON.stringify(cfg)); else ls.del(cfgKey(uid));
  window.dispatchEvent(new Event("smash:lock-changed"));
}
const markActive = () => ls.set(ACTIVE_KEY, String(Date.now()));

// The PIN is never stored — only a scrambled fingerprint (hash) of it.
async function hashPin(uid, pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`smash:${uid}:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const b64u = {
  enc(buf) {
    let s = "";
    new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(str) {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

// Fingerprint / Face ID using the phone's own scanner. Nothing biometric ever leaves the phone.
async function biometricAvailable() {
  try {
    return !!window.PublicKeyCredential &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}
async function registerBiometric(uid, label) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Smash", id: location.hostname },
      user: { id: new TextEncoder().encode(uid), name: label || "Smash user", displayName: label || "Smash user" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000,
    },
  });
  return b64u.enc(cred.rawId);
}
async function verifyBiometric(credId) {
  const a = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: b64u.dec(credId), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  const flags = new Uint8Array(a.response.authenticatorData)[32];
  return (flags & 0x04) !== 0; // the phone confirmed it was the owner
}

function useSessionUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}
function useLockConfig(uid) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    const load = () => setCfg(uid ? readLock(uid) : null);
    load();
    window.addEventListener("smash:lock-changed", load);
    return () => window.removeEventListener("smash:lock-changed", load);
  }, [uid]);
  return cfg;
}

const CSS = `
.lock-screen {
  position: fixed; inset: 0; z-index: 1000;
  display: grid; place-items: center; padding: 24px 16px;
  background: radial-gradient(circle at 20% 0%, rgba(198,255,61,.14), transparent 50%),
              radial-gradient(circle at 90% 100%, rgba(139,92,246,.16), transparent 55%), #07080c;
  animation: fade .25s ease both;
}
.lock-inner { width: 100%; max-width: 330px; text-align: center; }
.lock-logo {
  width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 18px; display: grid; place-items: center;
  background: linear-gradient(135deg, #c6ff3d, #2ef2c4); color: #07080c;
  box-shadow: 0 0 40px rgba(198,255,61,.45);
}
.lock-title { font-size: 1.4rem; font-weight: 800; margin: 0 0 4px; }
.pin-dots { display: flex; justify-content: center; gap: 16px; margin: 22px 0 10px; }
.pin-dots span { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3); transition: all .2s; }
.pin-dots span.on { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 12px var(--accent); transform: scale(1.1); }
.pin-dots.shake { animation: shake .4s; }
.pin-err { min-height: 22px; color: var(--danger); font-size: .85rem; }
.keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 10px auto 18px; max-width: 280px; }
.key {
  height: 64px; border-radius: 50%; aspect-ratio: 1; margin: 0 auto;
  border: 1px solid var(--line); background: rgba(255,255,255,.05); color: var(--text);
  font: inherit; font-size: 1.5rem; font-weight: 600; cursor: pointer;
  transition: background .15s, transform .1s;
}
.key:active { transform: scale(.92); background: rgba(198,255,61,.18); }
.key.ghost { background: none; border-color: transparent; font-size: 1.1rem; }
.lock-link { background: none; border: 0; color: var(--muted); font: inherit; font-size: .85rem; cursor: pointer; text-decoration: underline; }
.lock-settings .pin-input { max-width: 160px; letter-spacing: .5em; font-size: 1.2rem; text-align: center; }
`;

// ═════════════════════════ The lock screen ═════════════════════════
export default function AppLock() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionUser();
  const uid = user?.id;
  const cfg = useLockConfig(uid);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const onLoginPage = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const enabled = !!(uid && cfg?.pinHash) && !onLoginPage;

  // Lock if more than 30 minutes have passed since the app was last used
  const check = useCallback(() => {
    if (!enabled) return;
    const last = Number(ls.get(ACTIVE_KEY) || 0);
    if (!last || Date.now() - last > LOCK_AFTER_MS) setLocked(true);
  }, [enabled]);

  useEffect(() => {
    if (onLoginPage) { markActive(); return; } // signing in with a password counts as unlocking
    if (!enabled) return;
    check();
    let lastWrite = 0;
    const activity = () => {
      if (locked) return;
      const n = Date.now();
      const last = Number(ls.get(ACTIVE_KEY) || 0);
      if (!last || n - last > LOCK_AFTER_MS) return setLocked(true); // came back after 30+ min
      if (n - lastWrite > 15000) { lastWrite = n; markActive(); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const lockNow = () => setLocked(true);
    const timer = setInterval(check, 60000);
    const evts = ["pointerdown", "keydown", "scroll", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("smash:lock-now", lockNow);
    return () => {
      clearInterval(timer);
      evts.forEach((e) => window.removeEventListener(e, activity));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("smash:lock-now", lockNow);
    };
  }, [enabled, check, locked, onLoginPage]);

  function unlock() {
    ls.del(TRIES_KEY);
    markActive();
    setLocked(false); setPin(""); setErr("");
  }

  async function signOutAndReset(message) {
    writeLock(uid, null); // forget the PIN so a new one can be set after signing in
    ls.del(TRIES_KEY);
    await createClient().auth.signOut();
    setLocked(false); setPin("");
    router.push("/login" + (message ? `?msg=${encodeURIComponent(message)}` : ""));
    router.refresh();
  }

  async function press(d) {
    if (pin.length >= 4) return;
    const p = pin + d;
    setPin(p); setErr("");
    if (p.length < 4) return;
    if ((await hashPin(uid, p)) === cfg.pinHash) return unlock();
    const tries = Number(ls.get(TRIES_KEY) || 0) + 1;
    ls.set(TRIES_KEY, String(tries));
    setShake(true);
    setTimeout(() => { setShake(false); setPin(""); }, 420);
    if (tries >= MAX_TRIES) return signOutAndReset("Too many wrong PINs");
    setErr(`Wrong PIN · ${MAX_TRIES - tries} ${MAX_TRIES - tries === 1 ? "try" : "tries"} left`);
  }

  async function unlockWithBiometric() {
    setErr("");
    try {
      if (await verifyBiometric(cfg.credId)) unlock();
      else setErr("Couldn't confirm it's you — use your PIN.");
    } catch {
      setErr("Fingerprint/Face cancelled — use your PIN.");
    }
  }

  if (!enabled || !locked) return null;
  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="Smash is locked">
      <style>{CSS}</style>
      <div className="lock-inner">
        <div className="lock-logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        </div>
        <h2 className="lock-title">Smash is locked</h2>
        <p className="muted small" style={{ margin: 0 }}>Enter your PIN{cfg.credId ? " or use your fingerprint / face" : ""}</p>

        <div className={"pin-dots" + (shake ? " shake" : "")}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? "on" : ""} />)}
        </div>
        <div className="pin-err">{err}</div>

        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} className="key" onClick={() => press(d)}>{d}</button>
          ))}
          {cfg.credId
            ? <button className="key ghost" onClick={unlockWithBiometric} aria-label="Use fingerprint or face">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 11v3M8.5 8.5A5 5 0 0 1 17 12v1.5M7 12a5 5 0 0 0 .4 2M12 7a5 5 0 0 0-5 5M16.5 17a9 9 0 0 1-1.5 3M9 21a12 12 0 0 1-2-5M12 17v1a8 8 0 0 0 1 4M4.5 9A9 9 0 0 1 19.5 9" />
                </svg>
              </button>
            : <span />}
          <button className="key" onClick={() => press("0")}>0</button>
          <button className="key ghost" onClick={() => { setPin(pin.slice(0, -1)); setErr(""); }} aria-label="Delete">⌫</button>
        </div>

        {cfg.credId && <button className="btn" style={{ width: "100%", marginBottom: 14 }} onClick={unlockWithBiometric}>Unlock with fingerprint / face</button>}
        <button className="lock-link" onClick={() => signOutAndReset("Sign in to reset your PIN")}>Forgot PIN? Sign in with your password</button>
      </div>
    </div>
  );
}

// ═════════════════════════ Settings card (shown on the Profile page) ═════════════════════════
export function AppLockSettings() {
  const user = useSessionUser();
  const uid = user?.id;
  const cfg = useLockConfig(uid);
  const [bioOk, setBioOk] = useState(false);
  const [step, setStep] = useState("idle"); // idle | new1 | new2 | offerBio | off
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { biometricAvailable().then(setBioOk); }, []);
  const reset = () => { setStep("idle"); setP1(""); setP2(""); setErr(""); };
  const fourDigits = (v) => v.replace(/\D/g, "").slice(0, 4);

  async function savePin(e) {
    e.preventDefault();
    if (p2 !== p1) { setErr("PINs don't match — try again."); setP1(""); setP2(""); return setStep("new1"); }
    const pinHash = await hashPin(uid, p1);
    writeLock(uid, { pinHash, credId: cfg?.credId || null });
    markActive();
    setMsg("App Lock is on.");
    if (bioOk && !cfg?.credId) { setP1(""); setP2(""); setErr(""); return setStep("offerBio"); }
    reset();
  }

  async function addBio() {
    setErr("");
    try {
      const credId = await registerBiometric(uid, user?.email);
      writeLock(uid, { ...readLock(uid), credId });
      setMsg("Fingerprint / face unlock is on.");
      reset();
    } catch {
      setErr("Fingerprint/face setup was cancelled or isn't supported on this browser.");
    }
  }
  function removeBio() {
    writeLock(uid, { ...cfg, credId: null });
    setMsg("Fingerprint / face unlock turned off. Your PIN still works.");
  }
  async function turnOff(e) {
    e.preventDefault();
    if ((await hashPin(uid, p1)) !== cfg.pinHash) { setP1(""); return setErr("Wrong PIN."); }
    writeLock(uid, null);
    setMsg("App Lock is off.");
    reset();
  }

  if (!uid) return null;
  return (
    <div className="card lock-settings">
      <style>{CSS}</style>
      <div className="row between">
        <h2 style={{ margin: 0 }}>🔒 App Lock</h2>
        <span className="pill" style={cfg ? {} : { background: "rgba(255,255,255,.06)", color: "var(--muted)" }}>{cfg ? "On" : "Off"}</span>
      </div>
      <p className="muted small">
        Asks for your PIN{bioOk ? " or fingerprint / face" : ""} when Smash hasn’t been used for 30 minutes.
        Works on this phone or computer only.
      </p>

      {step === "idle" && !cfg && <button className="btn" onClick={() => { setMsg(""); setStep("new1"); }}>Turn on App Lock</button>}

      {step === "idle" && cfg && (
        <div className="row">
          {bioOk && (cfg.credId
            ? <button className="btn secondary sm" onClick={removeBio}>Turn off fingerprint / face</button>
            : <button className="btn sm" onClick={addBio}>Use fingerprint / face</button>)}
          <button className="btn secondary sm" onClick={() => { setMsg(""); setStep("new1"); }}>Change PIN</button>
          <button className="btn secondary sm" onClick={() => window.dispatchEvent(new Event("smash:lock-now"))}>Lock now</button>
          <button className="btn danger sm" onClick={() => { setMsg(""); setStep("off"); }}>Turn off</button>
        </div>
      )}

      {(step === "new1" || step === "new2") && (
        <form onSubmit={step === "new1" ? (e) => { e.preventDefault(); if (p1.length === 4) setStep("new2"); } : savePin}>
          <label>{step === "new1" ? "Choose a 4-digit PIN" : "Type the same PIN again"}</label>
          <div className="row">
            <input className="pin-input" type="password" inputMode="numeric" autoComplete="off" autoFocus key={step}
              value={step === "new1" ? p1 : p2}
              onChange={(e) => (step === "new1" ? setP1 : setP2)(fourDigits(e.target.value))} />
            <button className="btn sm" disabled={(step === "new1" ? p1 : p2).length !== 4}>{step === "new1" ? "Next" : "Save PIN"}</button>
            <button type="button" className="btn secondary sm" onClick={reset}>Cancel</button>
          </div>
        </form>
      )}

      {step === "offerBio" && (
        <div className="row">
          <span className="muted small" style={{ flex: 1 }}>Also unlock with your fingerprint or face?</span>
          <button className="btn sm" onClick={addBio}>Yes, set it up</button>
          <button className="btn secondary sm" onClick={reset}>Not now</button>
        </div>
      )}

      {step === "off" && (
        <form onSubmit={turnOff}>
          <label>Enter your PIN to turn App Lock off</label>
          <div className="row">
            <input className="pin-input" type="password" inputMode="numeric" autoComplete="off" autoFocus
              value={p1} onChange={(e) => setP1(fourDigits(e.target.value))} />
            <button className="btn danger sm" disabled={p1.length !== 4}>Turn off</button>
            <button type="button" className="btn secondary sm" onClick={reset}>Cancel</button>
          </div>
        </form>
      )}

      {err && <p className="error">{err}</p>}
      {msg && !err && <p className="muted small" style={{ marginBottom: 0 }}>✓ {msg}</p>}
    </div>
  );
}
