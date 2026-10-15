"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { e1rm, totalVolume, setCalories, fmt } from "@/lib/calc";

export default function WorkoutDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [w, setW] = useState(null);
  const [weight, setWeight] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data }, { data: bw }] = await Promise.all([
        supabase
          .from("workouts")
          .select("*, workout_sets(*, exercises(name, muscle_group, category, met))")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("body_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1),
      ]);
      if (!data) return setMissing(true);
      setW(data);
      setWeight(bw?.[0]?.weight_kg ? Number(bw[0].weight_kg) : null);
    })();
  }, [id]);

  async function remove() {
    if (!window.confirm("Delete this workout?")) return;
    await createClient().from("workouts").delete().eq("id", id);
    router.push("/workouts");
  }

  if (missing) return <p>Workout not found. <Link href="/workouts">Back</Link></p>;
  if (!w) return <p className="muted">Loading…</p>;

  const sets = [...w.workout_sets].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.set_number - b.set_number);
  const groups = [];
  sets.forEach((s) => {
    let g = groups.find((x) => x.exercise_id === s.exercise_id);
    if (!g) groups.push((g = { exercise_id: s.exercise_id, exercise: s.exercises, sets: [] }));
    g.sets.push(s);
  });
  const kcal = weight ? sets.reduce((sum, s) => sum + setCalories(s, s.exercises, weight), 0) : null;

  return (
    <>
      <div className="row between">
        <h1>{w.title || "Workout"}</h1>
        <button className="btn danger sm" onClick={remove}>Delete</button>
      </div>
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="label">Date</div><div className="value" style={{ fontSize: "1.1rem" }}>{w.performed_on}</div></div>
        <div className="stat"><div className="label">Sets</div><div className="value">{sets.length}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{fmt(totalVolume(sets))}</div><div className="sub">kg</div></div>
        <div className="stat"><div className="label">Calories (est.)</div><div className="value">{kcal === null ? "—" : fmt(kcal)}</div><div className="sub">kcal</div></div>
      </div>
      {groups.map((g) => {
        const cardio = g.exercise?.category === "cardio";
        const best = Math.max(0, ...g.sets.map((s) => e1rm(s.weight_kg, s.reps)));
        return (
          <div className="card" key={g.exercise_id}>
            <div className="row between">
              <b>{g.exercise?.name}</b>
              {!cardio && best > 0 && <span className="muted small">Best est. 1RM {fmt(best, 1)} kg</span>}
            </div>
            <table style={{ marginTop: 8 }}>
              <thead>
                {cardio ? <tr><th>Set</th><th>Minutes</th><th>Distance (km)</th></tr>
                  : <tr><th>Set</th><th>Reps</th><th>Weight (kg)</th><th>Volume</th></tr>}
              </thead>
              <tbody>
                {g.sets.map((s, i) => cardio ? (
                  <tr key={s.id}><td>{i + 1}</td><td>{fmt((s.duration_sec || 0) / 60, 1)}</td><td>{s.distance_km ?? "—"}</td></tr>
                ) : (
                  <tr key={s.id}><td>{i + 1}</td><td>{s.reps ?? "—"}</td><td>{s.weight_kg ?? "—"}</td><td>{fmt((s.reps || 0) * (s.weight_kg || 0))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {w.notes && <div className="card"><b>Notes</b><p>{w.notes}</p></div>}
      <Link href="/workouts">← All workouts</Link>
    </>
  );
}
