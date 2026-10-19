"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bodyStats, e1rm, fmt, stepStats, STEP_GOAL } from "@/lib/calc";
import CoachCard from "@/components/CoachCard";

// ───────────── date helpers (local time) ─────────────
export const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function lastSunday(from = new Date()) {
  const d = new Date(from); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): Sunday = 0
  return d;
}
export const niceDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const LS_KEY = "smash-weekly-seen";


// ═════════════════════════ Weekly report ═════════════════════════
export default function WeeklyReport({ profile, onClose }) {
  const [r, setR] = useState(null);
  const [step, setStep] = useState("loading"); // loading | checkin | report
  const [lastW, setLastW] = useState(null);
  const [newW, setNewW] = useState("");
  const [wErr, setWErr] = useState("");
  const [reload, setReload] = useState(0);
  const end = lastSunday();
  const start = addDays(end, -6);
  const prevStart = addDays(end, -13);
  const prevEnd = addDays(end, -7);

  // Weekly weigh-in: ask unless a weight was logged in the last 2 days
  useEffect(() => {
    (async () => {
      const { data } = await createClient().from("body_logs").select("logged_on, weight_kg")
        .order("logged_on", { ascending: false }).limit(1);
      const last = data?.[0];
      setLastW(last ? Number(last.weight_kg) : null);
      const recent = last && last.logged_on >= iso(addDays(new Date(), -2));
      setStep(recent ? "report" : "checkin");
    })();
  }, []);

  async function saveWeight(e) {
    e.preventDefault();
    const v = Number(newW);
    if (!v || v < 25 || v > 300) return setWErr("Enter your weight in kg, e.g. 64.5");
    const { error } = await createClient().from("body_logs").insert({ weight_kg: v, logged_on: iso(new Date()) });
    if (error) return setWErr(error.message);
    setStep("report"); setReload((x) => x + 1);
  }

  useEffect(() => {
    if (step !== "report") return;
    (async () => {
      const supabase = createClient();
      const [S, E, PS, PE] = [start, end, prevStart, prevEnd].map(iso);
      const [{ data: sets }, { data: food }, { data: steps }, { data: weights }] = await Promise.all([
        supabase.from("workout_sets")
          .select("reps, weight_kg, exercise_id, workout_id, exercises(name), workouts!inner(performed_on)")
          .lte("workouts.performed_on", E).limit(10000),
        supabase.from("food_logs").select("eaten_on, calories, protein_g").gte("eaten_on", PS).lte("eaten_on", E),
        supabase.from("daily_steps").select("day, steps").gte("day", PS).lte("day", E),
        supabase.from("body_logs").select("logged_on, weight_kg").order("logged_on"),
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
        weights: ws.slice(-10).map((x) => ({ date: x.logged_on, kg: Number(x.weight_kg) })),
        stats,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reload]);

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

        {step === "checkin" && (
          <form className="modal-body" onSubmit={saveWeight}>
            <h3 className="report-h" style={{ marginTop: 6 }}>⚖️ Weekly weigh-in</h3>
            <p className="muted small">Weigh yourself in the morning, before breakfast, for the most accurate trend.</p>
            <div className="row">
              <input type="number" inputMode="decimal" step="0.1" autoFocus value={newW} onChange={(e) => { setNewW(e.target.value); setWErr(""); }}
                placeholder={lastW ? `Last: ${lastW} kg` : "Weight in kg"} style={{ maxWidth: 200, fontSize: "1.2rem" }} />
              <button className="btn">Save &amp; see my report</button>
              <button type="button" className="btn secondary sm" onClick={() => setStep("report")}>Skip</button>
            </div>
            {wErr && <p className="error">{wErr}</p>}
          </form>
        )}

        {step === "report" && !r && <p className="muted">Crunching your numbers…</p>}
        {step !== "report" || !r ? null : (
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

            <CoachCard r={r} profile={profile} start={start} end={end} />
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

export function MiniStat({ label, value, sub, delta, unit = "" }) {
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
