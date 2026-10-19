"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_LEVELS, GOALS, bodyStats, fmt } from "@/lib/calc";
import WeeklyReport, { iso, lastSunday, LS_KEY, MiniStat } from "@/components/WeeklyReport";

export default function AppPopups() {
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [weight, setWeight] = useState(null);
  const [show, setShow] = useState(null); // "onboarding" | "weekly" | null
  const checkedFor = useRef(null); // which signed-in user we've already checked

  // Let the Home page open the weekly report on demand
  useEffect(() => {
    const open = () => setShow("weekly");
    window.addEventListener("smash:weekly", open);
    return () => window.removeEventListener("smash:weekly", open);
  }, []);

  // Runs on every page change, so it also works straight after signing up or signing in
  // (the app moves to the next page without a full reload).
  useEffect(() => {
    if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || checkedFor.current === user.id) return;
      checkedFor.current = user.id;

      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("body_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1),
      ]);
      const latestWeight = w?.[0]?.weight_kg ? Number(w[0].weight_kg) : null;
      setProfile(p || { id: user.id });
      setWeight(latestWeight);

      const incomplete = !p?.sex || !p?.birth_year || !p?.height_cm || !latestWeight;
      if (incomplete) return setShow("onboarding");

      const sunday = iso(lastSunday());
      let seen = p && "last_weekly_report" in p ? p.last_weekly_report : null;
      if (!(p && "last_weekly_report" in p)) { try { seen = localStorage.getItem(LS_KEY); } catch {} }
      if (!seen || seen < sunday) setShow("weekly");
    })();
  }, [pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || !show) return null;
  if (show === "onboarding") return <Onboarding profile={profile} weight={weight} />;
  return <WeeklyReport profile={profile} onClose={() => setShow(null)} />;
}

// ═════════════════════════ Onboarding wizard ═════════════════════════
function Onboarding({ profile, weight }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    full_name: profile?.full_name || "",
    sex: profile?.sex || "",
    birth_year: profile?.birth_year || "",
    height_cm: profile?.height_cm || "",
    weight_kg: weight || "",
    activity_level: profile?.activity_level || "moderate",
    goal: profile?.goal || "maintain",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF({ ...f, [k]: v }); setErr(""); };
  const year = new Date().getFullYear();

  function next() {
    if (step === 0 && (!f.full_name.trim() || !f.sex)) return setErr("Please enter your name and choose one option.");
    if (step === 1) {
      const by = Number(f.birth_year), h = Number(f.height_cm), w = Number(f.weight_kg);
      if (!by || by < year - 100 || by > year - 10) return setErr("Enter a valid birth year (e.g. 1995).");
      if (!h || h < 100 || h > 230) return setErr("Enter your height in cm (e.g. 160).");
      if (!w || w < 25 || w > 300) return setErr("Enter your weight in kg (e.g. 62).");
    }
    setErr(""); setStep(step + 1);
  }

  async function finish() {
    setBusy(true); setErr("");
    const supabase = createClient();
    const fields = {
      full_name: f.full_name.trim(), sex: f.sex, birth_year: Number(f.birth_year),
      height_cm: Number(f.height_cm), activity_level: f.activity_level, goal: f.goal,
    };
    // Don't show a weekly report straight after signing up
    let { error } = await supabase.from("profiles").update({ ...fields, last_weekly_report: iso(lastSunday()) }).eq("id", profile.id);
    if (error) ({ error } = await supabase.from("profiles").update(fields).eq("id", profile.id));
    try { localStorage.setItem(LS_KEY, iso(lastSunday())); } catch {}
    if (!error && Number(f.weight_kg) !== Number(weight)) {
      ({ error } = await supabase.from("body_logs").insert({ weight_kg: Number(f.weight_kg) }));
    }
    if (error) { setBusy(false); return setErr(error.message); }
    window.location.reload();
  }

  const preview = bodyStats({ ...f }, Number(f.weight_kg));
  const steps = ["About you", "Body", "Lifestyle", "Your plan"];

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Set up your profile">
        <div className="modal-head">
          <div className="brand-mark" style={{ width: 38, height: 38 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </div>
          <div>
            <div className="muted small">Step {step + 1} of 4 · {steps[step]}</div>
            <h2 style={{ margin: 0 }}>{["Welcome to Smash! 👋", "Your body stats", "How active are you?", "You're all set 🎯"][step]}</h2>
          </div>
        </div>
        <div className="dots">{steps.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>

        <div className="modal-body" key={step}>
          {step === 0 && (
            <>
              <p className="muted">Let's set up your profile so Smash can calculate your calories, BMI and targets.</p>
              <div className="field"><label>Your name</label>
                <input autoFocus value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="e.g. Austin" /></div>
              <label>Sex (used for the calorie formula)</label>
              <div className="choice-grid two">
                {[["female", "Female", "♀"], ["male", "Male", "♂"]].map(([v, l, icon]) => (
                  <button type="button" key={v} className={"choice" + (f.sex === v ? " on" : "")} onClick={() => set("sex", v)}>
                    <span className="choice-icon">{icon}</span>{l}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <div className="field"><label>Birth year</label>
                <input type="number" inputMode="numeric" value={f.birth_year} onChange={(e) => set("birth_year", e.target.value)} placeholder="1995" /></div>
              <div className="field"><label>Height (cm)</label>
                <input type="number" inputMode="decimal" value={f.height_cm} onChange={(e) => set("height_cm", e.target.value)} placeholder="165" /></div>
              <div className="field"><label>Weight (kg)</label>
                <input type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} placeholder="65" /></div>
            </div>
          )}

          {step === 2 && (
            <>
              <label>Activity level</label>
              <div className="choice-grid">
                {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => (
                  <button type="button" key={k} className={"choice left" + (f.activity_level === k ? " on" : "")} onClick={() => set("activity_level", k)}>
                    {v.label}
                  </button>
                ))}
              </div>
              <label style={{ marginTop: 14 }}>Your goal</label>
              <div className="choice-grid three">
                {Object.entries(GOALS).map(([k, v]) => (
                  <button type="button" key={k} className={"choice" + (f.goal === k ? " on" : "")} onClick={() => set("goal", k)}>
                    <span className="choice-icon">{{ lose: "🔥", maintain: "⚖️", gain: "💪" }[k]}</span>{v.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="muted">Here's your starting plan, {f.full_name.split(" ")[0]}. You can change any of this later in Profile.</p>
              <div className="grid">
                <MiniStat label="Daily calories" value={fmt(preview.target)} sub="kcal target" />
                <MiniStat label="Protein" value={`${fmt(preview.protein)} g`} sub="per day" />
                <MiniStat label="BMI" value={fmt(preview.bmi, 1)} sub={preview.bmiCategory} />
                <MiniStat label="Maintenance" value={fmt(preview.tdee)} sub="kcal / day" />
              </div>
            </>
          )}
          {err && <p className="error">{err}</p>}
        </div>

        <div className="modal-foot">
          {step > 0 ? <button className="btn secondary" onClick={() => { setErr(""); setStep(step - 1); }}>Back</button> : <span />}
          {step < 3
            ? <button className="btn" onClick={next}>Next →</button>
            : <button className="btn" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Start Smashing ⚡"}</button>}
        </div>
      </div>
    </div>
  );
}
