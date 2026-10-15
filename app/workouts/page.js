"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { totalVolume, fmt } from "@/lib/calc";

const DRAFT_CSS = `
.draft-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; margin: -6px 0 16px;
  border-radius: 14px; border: 1px solid rgba(198,255,61,.25);
  background: rgba(198,255,61,.07); color: var(--text); font-size: .9rem;
}
.draft-bar > span:nth-child(2) { flex: 1; }
.draft-bar.resume { margin-top: 0; }
.draft-bar.resume:hover { opacity: 1; border-color: var(--accent); }
.draft-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; transform: scale(.8); } }
`;

export default function Workouts() {
  const [workouts, setWorkouts] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem("smash-workout-draft") || "null");
      if (d?.entries?.length) setDraft(d);
    } catch {}
  }, []);

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
        <Link className="btn" href="/workouts/new">{draft ? "Continue workout" : "+ Log workout"}</Link>
      </div>
      <style>{DRAFT_CSS}</style>
      {draft && (
        <Link href="/workouts/new" className="draft-bar resume">
          <span className="draft-dot" />
          <span><b>Workout in progress</b> — {draft.entries.length} exercise{draft.entries.length > 1 ? "s" : ""},{" "}
            {draft.entries.reduce((a, e) => a + e.sets.length, 0)} sets</span>
          <span className="btn sm">Continue →</span>
        </Link>
      )}
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
