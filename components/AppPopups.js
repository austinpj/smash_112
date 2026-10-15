"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_LEVELS, GOALS, bodyStats, e1rm, fmt, stepStats, STEP_GOAL } from "@/lib/calc";

// ───────────── date helpers (local time) ─────────────
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function lastSunday(from = new Date()) {
  const d = new Date(from); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): Sunday = 0
  return d;
}
const niceDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const LS_KEY = "smash-weekly-seen";

export default function AppPopups() {
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [weight, setWeight] = useState(null);
  const [show, setShow] = useState(null); // "onboarding" | "weekly" | null

  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
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
    // Let the Home page open the report on demand
    const open = () => setShow("weekly");
    window.addEventListener("smash:weekly", open);
    return () => window.removeEventListener("smash:weekly", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pathname.startsWith("/login") || !show) return null;
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

// ═════════════════════════ Weekly report ═════════════════════════
function WeeklyReport({ profile, onClose }) {
  const [r, setR] = useState(null);
  const end = lastSunday();
  const start = addDays(end, -6);
  const prevStart = addDays(end, -13);
  const prevEnd = addDays(end, -7);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [S, E, PS, PE] = [start, end, prevStart, prevEnd].map(iso);
      const [{ data: sets }, { data: food }, { data: steps }, { data: weights }] = await Promise.all([
        supabase.from("workout_sets")
          .select("reps, weight_kg, exercise_id, workout_id, exercises(name), workouts!inner(performed_on)")
          .lte("workouts.performed_on", E).limit(10000),
        supabase.from("food_logs").select("eaten_on, calories, protein_g").gte("eaten_on", PS).lte("eaten_on", E),
        supabase.from("daily_steps").select("day, steps").gte("day", PS).lte("day", E),
        supabase.from("body_logs").select("logged_on, weight_kg").lte("logged_on", E).order("logged_on"),
      ]);
      const inRange = (d, a, b) => d >= a && d <= b;
      const allSets = sets || [];
      const wk = allSets.filter((s) => inRange(s.workouts.performed_on, S, E));
      const pw = allSets.filter((s) => inRange(s.workouts.performed_on, PS, PE));
      const vol = (arr) => arr.reduce((a, s) => a + (s.reps || 0) * (s.weight_kg || 0), 0);

      // New personal records this week (best estimated 1RM beats everything before)
      const before = {}, now = {};
      allSets.forEach((s) => {
        const v = e1rm(s.weight_kg, s.reps); if (!v) return;
        const target = s.workouts.performed_on < S ? before : inRange(s.workouts.performed_on, S, E) ? now : null;
        if (target && (!target[s.exercise_id] || v > target[s.exercise_id].v)) target[s.exercise_id] = { v, name: s.exercises?.name };
      });
      const prs = Object.entries(now)
        .filter(([id, x]) => !before[id] || x.v > before[id].v)
        .map(([id, x]) => ({ name: x.name, v: x.v, prev: before[id]?.v || null }))
        .sort((a, b) => b.v - a.v).slice(0, 5);

      const foodWk = (food || []).filter((f) => inRange(f.eaten_on, S, E));
      const foodDays = new Set(foodWk.map((f) => f.eaten_on)).size;
      const kcal = foodWk.reduce((a, f) => a + Number(f.calories || 0), 0);
      const prot = foodWk.reduce((a, f) => a + Number(f.protein_g || 0), 0);

      const stepWk = (steps || []).filter((x) => inRange(x.day, S, E));
      const stepPw = (steps || []).filter((x) => inRange(x.day, PS, PE));
      const stepsByDay = Array.from({ length: 7 }, (_, i) => {
        const d = iso(addDays(start, i));
        return { d, label: addDays(start, i).toLocaleDateString("en-IN", { weekday: "narrow" }), steps: stepWk.find((x) => x.day === d)?.steps || 0 };
      });
      const totalSteps = stepWk.reduce((a, x) => a + x.steps, 0);

      const ws = weights || [];
      const wEnd = ws.length ? Number(ws[ws.length - 1].weight_kg) : null;
      const wBefore = [...ws].reverse().find((x) => x.logged_on < S);
      const latestW = wEnd;
      const stats = bodyStats(profile, latestW);
      const walkKcal = stepStats(totalSteps, latestW, profile?.height_cm).kcal;

      setR({
        workouts: new Set(wk.map((s) => s.workout_id)).size,
        prevWorkouts: new Set(pw.map((s) => s.workout_id)).size,
        sets: wk.length, prevSets: pw.length,
        volume: vol(wk), prevVolume: vol(pw),
        prs,
        foodDays, avgKcal: foodDays ? kcal / foodDays : null, avgProt: foodDays ? prot / foodDays : null,
        target: stats.target, proteinTarget: stats.protein,
        totalSteps, prevSteps: stepPw.reduce((a, x) => a + x.steps, 0),
        goalDays: stepWk.filter((x) => x.steps >= STEP_GOAL).length,
        stepsByDay, walkKcal,
        weightChange: wEnd !== null && wBefore ? wEnd - Number(wBefore.weight_kg) : null, wEnd,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function close() {
    const sunday = iso(lastSunday());
    try { localStorage.setItem(LS_KEY, sunday); } catch {}
    if (profile?.id && "last_weekly_report" in (profile || {})) {
      await createClient().from("profiles").update({ last_weekly_report: sunday }).eq("id", profile.id);
    }
    onClose();
  }

  const name = profile?.full_name?.split(" ")[0] || "there";
  const headline = !r ? "" :
    r.workouts >= 4 ? "Beast mode this week! 🔥" :
    r.workouts >= 2 ? "Solid week — keep the streak going 💪" :
    r.workouts === 1 ? "Good start — aim for one more session 👊" :
    r.totalSteps > 0 ? "Nice moving! Let's add a workout this week 🚶" :
    "Fresh week, fresh start ⚡";
  const maxSteps = r ? Math.max(STEP_GOAL, ...r.stepsByDay.map((x) => x.steps)) : 1;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Weekly report">
        <button className="modal-x" onClick={close} aria-label="Close">×</button>
        <div className="report-hero">
          <span className="pill">Weekly report · {niceDate(start)} – {niceDate(end)}</span>
          <h2 className="report-title">Hey {name}, {headline}</h2>
        </div>

        {!r ? <p className="muted">Crunching your numbers…</p> : (
          <div className="modal-body">
            <h3 className="report-h">🏋️ Training</h3>
            <div className="grid">
              <MiniStat label="Workouts" value={r.workouts} delta={r.workouts - r.prevWorkouts} />
              <MiniStat label="Sets" value={r.sets} delta={r.sets - r.prevSets} />
              <MiniStat label="Volume" value={`${fmt(r.volume)} kg`} delta={r.volume - r.prevVolume} unit=" kg" />
            </div>
            {r.prs.length > 0 && (
              <div className="pr-list">
                <div className="muted small" style={{ marginBottom: 6 }}>🏆 New personal records (est. 1-rep max)</div>
                {r.prs.map((p, i) => (
                  <div className="pr-row" key={i} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                    <span>{p.name}</span>
                    <b>{fmt(p.v, 1)} kg {p.prev && <span className="up">+{fmt(p.v - p.prev, 1)}</span>}</b>
                  </div>
                ))}
              </div>
            )}

            <h3 className="report-h">🚶 Activity</h3>
            <div className="week-bars">
              {r.stepsByDay.map((x, i) => (
                <div className="wb" key={x.d} title={`${x.d}: ${fmt(x.steps)} steps`}>
                  <div className="wb-track">
                    <div className={"wb-fill" + (x.steps >= STEP_GOAL ? " hit" : "")}
                      style={{ height: `${(x.steps / maxSteps) * 100}%`, animationDelay: `${0.2 + i * 0.06}s` }} />
                  </div>
                  <span className="muted small">{x.label}</span>
                </div>
              ))}
            </div>
            <div className="grid">
              <MiniStat label="Total steps" value={fmt(r.totalSteps)} delta={r.totalSteps - r.prevSteps} />
              <MiniStat label="10k days" value={`${r.goalDays} / 7`} />
              <MiniStat label="Walking burn" value={r.walkKcal ? `${fmt(r.walkKcal)} kcal` : "—"} />
            </div>

            <h3 className="report-h">🍽️ Nutrition</h3>
            <div className="grid">
              <MiniStat label="Avg calories / day" value={r.avgKcal ? fmt(r.avgKcal) : "—"} sub={r.target ? `target ${fmt(r.target)}` : ""} />
              <MiniStat label="Avg protein / day" value={r.avgProt ? `${fmt(r.avgProt)} g` : "—"} sub={r.proteinTarget ? `target ${fmt(r.proteinTarget)} g` : ""} />
              <MiniStat label="Days logged" value={`${r.foodDays} / 7`} />
            </div>

            <h3 className="report-h">⚖️ Body</h3>
            <div className="grid">
              <MiniStat label="Current weight" value={r.wEnd ? `${fmt(r.wEnd, 1)} kg` : "—"} />
              <MiniStat label="Change this week" value={r.weightChange === null ? "—" : `${r.weightChange > 0 ? "+" : ""}${fmt(r.weightChange, 1)} kg`}
                sub={r.weightChange === null ? "log weight weekly to track" : ""} />
            </div>
          </div>
        )}

        <div className="modal-foot">
          <span className="muted small">Next report: Sunday {niceDate(addDays(end, 7))}</span>
          <button className="btn" onClick={close}>Let's crush next week ⚡</button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, delta, unit = "" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: "1.35rem" }}>{value}</div>
      {delta !== undefined && delta !== 0 && (
        <div className={"delta " + (delta > 0 ? "up" : "down")}>
          {delta > 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}{unit} vs last week
        </div>
      )}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
