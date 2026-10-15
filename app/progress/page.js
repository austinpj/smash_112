"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { e1rm, fmt } from "@/lib/calc";

export default function Progress() {
  const [sets, setSets] = useState(null);
  const [weights, setWeights] = useState([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: s }, { data: w }] = await Promise.all([
        supabase
          .from("workout_sets")
          .select("reps, weight_kg, duration_sec, distance_km, exercise_id, workout_id, exercises(name, category), workouts(performed_on)")
          .limit(5000),
        supabase.from("body_logs").select("logged_on, weight_kg").order("logged_on"),
      ]);
      setSets(s || []);
      setWeights(w || []);
    })();
  }, []);

  // Personal records per exercise
  const records = useMemo(() => {
    if (!sets) return [];
    const map = {};
    sets.forEach((s) => {
      const r = (map[s.exercise_id] ||= { id: s.exercise_id, name: s.exercises?.name, category: s.exercises?.category, maxWeight: 0, best1rm: 0, maxReps: 0, sessions: new Set(), last: "" });
      r.maxWeight = Math.max(r.maxWeight, Number(s.weight_kg || 0));
      r.maxReps = Math.max(r.maxReps, Number(s.reps || 0));
      r.best1rm = Math.max(r.best1rm, e1rm(s.weight_kg, s.reps));
      r.sessions.add(s.workout_id);
      const d = s.workouts?.performed_on || "";
      if (d > r.last) r.last = d;
    });
    return Object.values(map).sort((a, b) => b.sessions.size - a.sessions.size);
  }, [sets]);

  // Per-session history for the selected exercise
  const history = useMemo(() => {
    if (!sets || !selected) return [];
    const byWorkout = {};
    sets.filter((s) => s.exercise_id === selected).forEach((s) => {
      const h = (byWorkout[s.workout_id] ||= { date: s.workouts?.performed_on, sets: 0, volume: 0, top: 0, best1rm: 0, minutes: 0, km: 0 });
      h.sets += 1;
      h.volume += (s.reps || 0) * (s.weight_kg || 0);
      h.top = Math.max(h.top, Number(s.weight_kg || 0));
      h.best1rm = Math.max(h.best1rm, e1rm(s.weight_kg, s.reps));
      h.minutes += (s.duration_sec || 0) / 60;
      h.km += Number(s.distance_km || 0);
    });
    return Object.values(byWorkout).sort((a, b) => a.date.localeCompare(b.date));
  }, [sets, selected]);

  if (sets === null) return <p className="muted">Loading…</p>;
  const sel = records.find((r) => r.id === selected);
  const cardio = sel?.category === "cardio";

  return (
    <>
      <h1>Progress</h1>

      <div className="card">
        <h2>Exercise history</h2>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose an exercise you’ve logged…</option>
          {records.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {sel && history.length > 0 && (
          <>
            <LineChart
              points={history.map((h) => ({ x: h.date, y: cardio ? h.minutes : h.best1rm || h.volume }))}
              label={cardio ? "Minutes per session" : "Estimated 1-rep max (kg)"}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  {cardio ? <tr><th>Date</th><th>Minutes</th><th>Km</th></tr>
                    : <tr><th>Date</th><th>Sets</th><th>Top weight</th><th>Est. 1RM</th><th>Volume</th></tr>}
                </thead>
                <tbody>
                  {[...history].reverse().map((h, i) => cardio ? (
                    <tr key={i}><td>{h.date}</td><td>{fmt(h.minutes, 1)}</td><td>{fmt(h.km, 2)}</td></tr>
                  ) : (
                    <tr key={i}><td>{h.date}</td><td>{h.sets}</td><td>{fmt(h.top, 1)} kg</td><td>{fmt(h.best1rm, 1)} kg</td><td>{fmt(h.volume)} kg</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Body weight</h2>
        {weights.length < 2 ? (
          <p className="muted">Log your weight on the Profile page at least twice to see a trend.</p>
        ) : (
          <LineChart points={weights.map((w) => ({ x: w.logged_on, y: Number(w.weight_kg) }))} label="Weight (kg)" />
        )}
      </div>

      <div className="card table-wrap">
        <h2>Personal records</h2>
        {records.length === 0 ? <p className="muted">Log some workouts to see your records.</p> : (
          <table>
            <thead><tr><th>Exercise</th><th>Heaviest</th><th>Best est. 1RM</th><th>Most reps</th><th>Sessions</th><th>Last</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); setSelected(r.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{r.name}</a></td>
                  <td>{r.maxWeight ? `${fmt(r.maxWeight, 1)} kg` : "—"}</td>
                  <td>{r.best1rm ? `${fmt(r.best1rm, 1)} kg` : "—"}</td>
                  <td>{r.maxReps || "—"}</td>
                  <td>{r.sessions.size}</td>
                  <td className="muted">{r.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// Small dependency-free SVG line chart
function LineChart({ points, label }) {
  if (points.length === 0) return null;
  const W = 600, H = 200, P = 32;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => (points.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (points.length - 1));
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.y)}`).join(" ");
  return (
    <div style={{ margin: "12px 0" }}>
      <div className="muted small">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={label}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" />
        <text x={4} y={y(max) + 4} fontSize="11" fill="var(--muted)">{fmt(max, 1)}</text>
        <text x={4} y={y(min) + 4} fontSize="11" fill="var(--muted)">{fmt(min, 1)}</text>
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r="4" fill="var(--accent)">
            <title>{`${p.x}: ${fmt(p.y, 1)}`}</title>
          </circle>
        ))}
        <text x={P} y={H - 8} fontSize="11" fill="var(--muted)">{points[0].x}</text>
        <text x={W - P} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{points[points.length - 1].x}</text>
      </svg>
    </div>
  );
}
