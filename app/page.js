"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bodyStats, totalVolume, setCalories, stepStats, STEP_GOAL, fmt, todayISO, startOfWeekISO } from "@/lib/calc";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [steps, setSteps] = useState(0);
  const [stepsReady, setStepsReady] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const today = todayISO();
      const weekStart = startOfWeekISO();
      const [{ data: profile }, { data: weights }, { data: food }, { data: workouts }] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("body_logs").select("weight_kg, logged_on").order("logged_on", { ascending: false }).limit(1),
        supabase.from("food_logs").select("calories, protein_g").eq("eaten_on", today),
        supabase
          .from("workouts")
          .select("id, title, performed_on, workout_sets(reps, weight_kg, duration_sec, exercises(name, met))")
          .gte("performed_on", weekStart)
          .order("performed_on", { ascending: false }),
      ]);
      const { data: stepRow, error: stepErr } = await supabase
        .from("daily_steps").select("steps").eq("day", today).maybeSingle();
      if (stepErr) setStepsReady(false);
      setSteps(stepRow?.steps || 0);
      const weight = weights?.[0]?.weight_kg ? Number(weights[0].weight_kg) : null;
      const stats = bodyStats(profile, weight);
      const eaten = (food || []).reduce((s, f) => s + Number(f.calories || 0), 0);
      const protein = (food || []).reduce((s, f) => s + Number(f.protein_g || 0), 0);
      const allSets = (workouts || []).flatMap((w) => w.workout_sets || []);
      const todaySets = (workouts || []).filter((w) => w.performed_on === today).flatMap((w) => w.workout_sets || []);
      const workoutBurn = weight ? todaySets.reduce((s, x) => s + setCalories(x, x.exercises, weight), 0) : null;
      setData({ profile, weight, stats, eaten, protein, workouts: workouts || [], weekVolume: totalVolume(allSets), weekSets: allSets.length, workoutBurn });
    })();
  }, []);

  if (!data) return <p className="muted">Loading…</p>;
  const { profile, weight, stats, eaten, protein, workouts, weekVolume, weekSets, workoutBurn } = data;
  const walk = stepStats(steps, weight, profile?.height_cm);
  const burnedToday = weight ? (workoutBurn || 0) + (walk.kcal || 0) : null;
  const profileIncomplete = !profile?.height_cm || !profile?.birth_year || !profile?.sex || !weight;
  const pct = stats.target ? Math.min(100, (eaten / stats.target) * 100) : 0;

  return (
    <>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <h1>Hi{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <button className="btn secondary sm" style={{ marginTop: 14 }}
          onClick={() => window.dispatchEvent(new Event("smash:weekly"))}>📊 Weekly report</button>
      </div>

      {profileIncomplete && (
        <div className="card">
          <b>Finish your profile</b>
          <p className="muted">Add your height, birth year, sex and current weight so calorie targets and BMI can be calculated.</p>
          <Link className="btn sm" href="/profile">Go to profile</Link>
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Today’s food</h2>
          <Link href="/food" className="btn sm">+ Add food</Link>
        </div>
        <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: "10px 0 6px" }}>
          {fmt(eaten)} <span className="muted">/ {fmt(stats.target)} kcal</span>
        </p>
        <div className="bar"><div style={{ width: pct + "%" }} /></div>
        <p className="muted small">
          Protein {fmt(protein)} g / {fmt(stats.protein)} g target
          {stats.target ? ` · ${fmt(Math.max(0, stats.target - eaten))} kcal left` : ""}
        </p>
      </div>

      <StepsCard steps={steps} walk={walk} ready={stepsReady} hasWeight={!!weight}
        onSaved={(n) => setSteps(n)} userId={profile?.id} />

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="Workouts this week" value={workouts.length} />
        <Stat label="Sets this week" value={weekSets} />
        <Stat label="Volume this week" value={fmt(weekVolume)} sub="kg lifted (reps × weight)" />
        <Stat label="Burned today (est.)" value={burnedToday === null ? "—" : fmt(burnedToday)} sub="kcal from workouts + steps" />
        <Stat label="Weight" value={weight ? `${fmt(weight, 1)} kg` : "—"} sub={stats.bmi ? `BMI ${fmt(stats.bmi, 1)}` : ""} />
        <Stat label="Maintenance (TDEE)" value={fmt(stats.tdee)} sub="kcal / day" />
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>This week’s workouts</h2>
          <Link href="/workouts/new" className="btn sm">+ Log workout</Link>
        </div>
        {workouts.length === 0 ? (
          <p className="muted">No workouts yet this week.</p>
        ) : (
          <table style={{ marginTop: 10 }}>
            <tbody>
              {workouts.map((w) => (
                <tr key={w.id}>
                  <td><Link href={`/workouts/${w.id}`}>{w.title || "Workout"}</Link></td>
                  <td className="muted">{w.performed_on}</td>
                  <td className="muted">{w.workout_sets.length} sets</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StepsCard({ steps, walk, ready, hasWeight, onSaved, userId }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const R = 52, C = 2 * Math.PI * R;

  async function save(e) {
    e.preventDefault();
    const n = Math.round(Number(input));
    if (!input || Number.isNaN(n) || n < 0) return setErr("Enter a number of steps.");
    setBusy(true); setErr("");
    const { error } = await createClient()
      .from("daily_steps")
      .upsert({ user_id: userId, day: todayISO(), steps: n, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved(n); setInput("");
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Steps today</h2>
        <span className="pill">Goal {fmt(STEP_GOAL)}</span>
      </div>
      {!ready ? (
        <p className="muted">Step tracking isn’t switched on yet — run <b>supabase/steps.sql</b> in the Supabase SQL Editor.</p>
      ) : (
        <div className="steps-wrap">
          <div className="ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c6ff3d" />
                  <stop offset="100%" stopColor="#2ef2c4" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r={R} className="ring-bg" />
              <circle cx="60" cy="60" r={R} className="ring-fg"
                style={{ strokeDasharray: C, strokeDashoffset: C * (1 - walk.pct / 100), "--c": C }} />
            </svg>
            <div className="ring-center">
              <div className="ring-num">{fmt(steps)}</div>
              <div className="muted small">{fmt(walk.pct)}%</div>
            </div>
          </div>
          <div className="steps-side">
            <div className="steps-stats">
              <div><div className="muted small">Distance</div><b>{fmt(walk.km, 2)} km</b></div>
              <div><div className="muted small">Calories burned</div><b>{hasWeight ? `${fmt(walk.kcal)} kcal` : "add weight"}</b></div>
              <div><div className="muted small">To goal</div><b>{fmt(Math.max(0, STEP_GOAL - steps))}</b></div>
            </div>
            <form className="row" onSubmit={save}>
              <input type="number" inputMode="numeric" placeholder="Today’s total steps"
                value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
              <button className="btn" disabled={busy}>{busy ? "Saving…" : steps ? "Update" : "Save"}</button>
            </form>
            <p className="muted small" style={{ margin: "6px 0 0" }}>
              Copy the number from your phone’s step counter (Google Fit, Samsung Health, Apple Health).
            </p>
            {err && <p className="error">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
