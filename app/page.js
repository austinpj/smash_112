"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bodyStats, totalVolume, setCalories, fmt, todayISO, startOfWeekISO } from "@/lib/calc";

export default function Dashboard() {
  const [data, setData] = useState(null);

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
      const weight = weights?.[0]?.weight_kg ? Number(weights[0].weight_kg) : null;
      const stats = bodyStats(profile, weight);
      const eaten = (food || []).reduce((s, f) => s + Number(f.calories || 0), 0);
      const protein = (food || []).reduce((s, f) => s + Number(f.protein_g || 0), 0);
      const allSets = (workouts || []).flatMap((w) => w.workout_sets || []);
      const todaySets = (workouts || []).filter((w) => w.performed_on === today).flatMap((w) => w.workout_sets || []);
      const burnedToday = weight ? todaySets.reduce((s, x) => s + setCalories(x, x.exercises, weight), 0) : null;
      setData({ profile, weight, stats, eaten, protein, workouts: workouts || [], weekVolume: totalVolume(allSets), weekSets: allSets.length, burnedToday });
    })();
  }, []);

  if (!data) return <p className="muted">Loading…</p>;
  const { profile, weight, stats, eaten, protein, workouts, weekVolume, weekSets, burnedToday } = data;
  const profileIncomplete = !profile?.height_cm || !profile?.birth_year || !profile?.sex || !weight;
  const pct = stats.target ? Math.min(100, (eaten / stats.target) * 100) : 0;

  return (
    <>
      <h1>Hi{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>

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

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="Workouts this week" value={workouts.length} />
        <Stat label="Sets this week" value={weekSets} />
        <Stat label="Volume this week" value={fmt(weekVolume)} sub="kg lifted (reps × weight)" />
        <Stat label="Burned today (est.)" value={burnedToday === null ? "—" : fmt(burnedToday)} sub="kcal from logged exercise" />
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

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
