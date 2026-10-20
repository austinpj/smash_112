"use client";
import { useEffect, useState } from "react";

const KEY = "smash-install-dismissed";

// The browser's "you can install this" event fires only once, very early.
// We keep it on window so the Profile page's Install button can use it later.
function rememberPrompt(e) {
  e.preventDefault();
  window.__smashInstall = e;
  window.dispatchEvent(new Event("smash:installable"));
}
if (typeof window !== "undefined" && !window.__smashInstallHooked) {
  window.__smashInstallHooked = true;
  window.addEventListener("beforeinstallprompt", rememberPrompt);
  window.addEventListener("appinstalled", () => { window.__smashInstall = null; window.dispatchEvent(new Event("smash:installed")); });
}
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const CSS = `
.install-bar {
  position: fixed; z-index: 40; left: 12px; right: 12px; bottom: 20px;
  max-width: 460px; margin: 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 18px;
  background: rgba(20, 23, 31, .94); border: 1px solid rgba(198,255,61,.3);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 20px 40px -12px rgba(0,0,0,.8), 0 0 30px -12px rgba(198,255,61,.5);
  animation: rise .5s cubic-bezier(.22,1,.36,1) both;
}
.install-bar .ic {
  width: 42px; height: 42px; flex: none; border-radius: 12px; display: grid; place-items: center;
  background: linear-gradient(135deg, #c6ff3d, #2ef2c4); color: #07080c;
}
.install-bar .tx { flex: 1; font-size: .88rem; line-height: 1.35; }
.install-bar .x { background: none; border: 0; color: var(--muted); font-size: 1.3rem; cursor: pointer; padding: 4px; }
@media (max-width: 820px) { .install-bar { bottom: 96px; } }
`;

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null); // Android / desktop Chrome install event
  const [mode, setMode] = useState(null);     // "prompt" | "ios" | null

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch {}
    if (isStandalone() || dismissed) return;

    const onPrompt = () => { if (window.__smashInstall) { setPrompt(window.__smashInstall); setMode("prompt"); } };
    const onInstalled = () => setMode(null);
    onPrompt();
    window.addEventListener("smash:installable", onPrompt);
    window.addEventListener("smash:installed", onInstalled);

    // iPhone/iPad Safari has no install button — show instructions instead
    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setMode("ios");

    return () => {
      window.removeEventListener("smash:installable", onPrompt);
      window.removeEventListener("smash:installed", onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setMode(null);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setMode(null);
    setPrompt(null);
    window.__smashInstall = null; // each install event can only be used once
  }

  if (!mode) return null;
  return (
    <>
      <style>{CSS}</style>
      <div className="install-bar" role="dialog" aria-label="Install Smash">
        <div className="ic">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        </div>
        <div className="tx">
          <b>Install Smash</b><br />
          {mode === "ios"
            ? <span className="muted small">Tap <b>Share</b> <span aria-hidden="true">⬆️</span> then <b>Add to Home Screen</b></span>
            : <span className="muted small">Open it like an app — full screen, one tap away.</span>}
        </div>
        {mode === "prompt" && <button className="btn sm" onClick={install}>Install</button>}
        <button className="x" onClick={dismiss} aria-label="Not now">×</button>
      </div>
    </>
  );
}

// ───────────── Profile page card: install any time ─────────────
function detectDevice() {
  const ua = window.navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat/i.test(ua)) return "inapp";
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/android/i.test(ua)) return /firefox/i.test(ua) ? "android-firefox" : "android";
  if (/Edg\//.test(ua)) return "edge";
  if (/firefox/i.test(ua)) return "firefox";
  if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) return "mac-safari";
  return "desktop";
}

const STEPS = {
  ios: ["Open Smash in Safari (or Chrome on newer iPhones).", "Tap the Share button ⬆️ (bottom or top of the screen).", "Scroll down and tap “Add to Home Screen”, then “Add”."],
  android: ["Tap the ⋮ menu (top-right in Chrome).", "Tap “Add to Home screen” or “Install app”.", "Tap “Install” / “Add”."],
  "android-firefox": ["Tap the ⋮ menu.", "Tap “Install” or “Add to Home screen”."],
  samsung: ["Tap the ≡ menu at the bottom.", "Tap “Add page to” → “Home screen”."],
  edge: ["Click the ⋯ menu (top-right).", "Go to “Apps” → “Install this site as an app”."],
  desktop: ["Look for the install icon 🖥️⬇ at the right end of the address bar and click it.", "Or open the ⋮ menu → “Cast, save and share” → “Install page as app”."],
  "mac-safari": ["Click File (top menu bar) → “Add to Dock”."],
  firefox: ["Firefox on computers can’t install apps. Open Smash in Chrome or Edge and install from there."],
  inapp: ["You’re inside another app’s browser (WhatsApp, Instagram…).", "Tap ⋯ / ⋮ and choose “Open in Chrome” or “Open in Safari”, then come back to this page."],
};

export function InstallSettings() {
  const [state, setState] = useState("loading"); // loading | installed | ready | manual
  const [device, setDevice] = useState("desktop");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setDevice(detectDevice());
    const check = () => setState(isStandalone() ? "installed" : window.__smashInstall ? "ready" : "manual");
    const done = () => { setState("installed"); setMsg("Installed! Look for Smash on your home screen / desktop."); };
    check();
    window.addEventListener("smash:installable", check);
    window.addEventListener("smash:installed", done);
    return () => { window.removeEventListener("smash:installable", check); window.removeEventListener("smash:installed", done); };
  }, []);

  async function install() {
    const e = window.__smashInstall;
    if (!e) return setState("manual");
    e.prompt();
    const { outcome } = await e.userChoice;
    window.__smashInstall = null;
    if (outcome === "accepted") { setState("installed"); setMsg("Installed! Look for Smash on your home screen / desktop."); }
    else setState("manual");
  }

  if (state === "loading") return null;
  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>📲 Install app</h2>
        <span className="pill" style={state === "installed" ? {} : { background: "rgba(255,255,255,.06)", color: "var(--muted)" }}>
          {state === "installed" ? "Installed" : "Not installed"}
        </span>
      </div>
      <p className="muted small">Put Smash on your home screen so it opens full screen like a normal app — no browser bars, one tap away.</p>

      {state === "installed" && <p className="small" style={{ marginBottom: 0 }}>✅ {msg || "You’re using the installed app."}</p>}

      {state === "ready" && <button className="btn" onClick={install}>Install Smash</button>}

      {state === "manual" && (
        <>
          <p className="small" style={{ fontWeight: 700, margin: "0 0 6px" }}>How to install on this device:</p>
          <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {(STEPS[device] || STEPS.desktop).map((t) => <li key={t}>{t}</li>)}
          </ol>
          <p className="muted small" style={{ marginBottom: 0 }}>Already installed? Just open Smash from your home screen or app list.</p>
        </>
      )}
    </div>
  );
}
