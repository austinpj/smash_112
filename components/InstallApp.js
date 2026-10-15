"use client";
import { useEffect, useState } from "react";

const KEY = "smash-install-dismissed";
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
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch {}
    if (standalone || dismissed) return;

    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setMode("prompt"); };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone/iPad Safari has no install button — show instructions instead
    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
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
