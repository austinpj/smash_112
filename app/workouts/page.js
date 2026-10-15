"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { totalVolume, fmt } from "@/lib/calc";

export default function Workouts() {
  const [workouts, setWorkouts] = useState(null);

  useEffect(() => {
    createClient()
      .from("workouts")
      .select("id, title, performed_on, duration_min, workout_sets(reps, weight_kg, exercise_id)")
      .order("performed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setWorkouts(data || []));
  }, []);

  return (
    <>
      <div className="row between">
        <h1>Workouts</h1>
        <Link className="btn" href="/workouts/new">+ Log workout</Link>
      </div>
      {workouts === null ? (
        <p className="muted">Loading…</p>
      ) : workouts.length === 0 ? (
        <div className="card"><p className="muted">No workouts yet. Log your first one!</p></div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Workout</th><th>Exercises</th><th>Sets</th><th>Volume (kg)</th></tr>
            </thead>
            <tbody>
              {workouts.map((w) => (
                <tr key={w.id}>
                  <td>{w.performed_on}</td>
                  <td><Link href={`/workouts/${w.id}`}>{w.title || "Workout"}</Link></td>
                  <td>{new Set(w.workout_sets.map((s) => s.exercise_id)).size}</td>
                  <td>{w.workout_sets.length}</td>
                  <td>{fmt(totalVolume(w.workout_sets))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
