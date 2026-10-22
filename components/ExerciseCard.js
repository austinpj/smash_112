"use client";
import { e1rm, fmt } from "@/lib/calc";
import { checkPR } from "@/components/WorkoutExtras";

// One exercise in the workout: "last time" line, set boxes (with last time's numbers as hints) and PR badges
export default function ExerciseCard({ e, onRemove, onAddSet, onSet, onRemoveSet, onDone }) {
  const cardio = e.exercise.category === "cardio";
  const best = Math.max(0, ...e.sets.map((s) => e1rm(s.weight_kg, s.reps)));
  return (
    <div className="card">
      <div className="row between">
        <div>
          <b>{e.exercise.name}</b> <span className="pill">{e.exercise.muscle_group}</span>
        </div>
        <button className="btn danger sm" onClick={onRemove}>Remove</button>
      </div>
      {e.last ? (
        <div className="last-time">
          <span className="muted">Last time · {new Date(e.last.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}: </span>
          <b>{e.last.sets.map((s) => cardio
            ? `${fmt((s.duration_sec || 0) / 60)} min${s.distance_km ? ` / ${s.distance_km} km` : ""}`
            : `${s.reps ?? "-"}×${s.weight_kg ?? 0}kg`).join(", ")}</b>
          {!cardio && e.best?.weight > 0 && <span className="muted"> · best ever {fmt(e.best.weight, 1)} kg</span>}
        </div>
      ) : (
        <p className="muted small">First time logging this one — today sets your baseline 💪</p>
      )}
      <div className="set-grid muted small" style={{ gridTemplateColumns: "32px 1fr 1fr 32px", marginTop: 8 }}>
        <span>Set</span><span>{cardio ? "Minutes" : "Reps"}</span><span>{cardio ? "Distance (km)" : "Weight (kg)"}</span><span />
      </div>
      {e.sets.map((s, j) => {
        const isPr = !cardio && checkPR(e.best, s);
        const prev = e.last?.sets?.[j];
        return (
        <div className={"set-grid" + (isPr ? " set-pr" : "")} key={j} style={{ gridTemplateColumns: "32px 1fr 1fr 32px" }}>
          <span className="muted">{j + 1}{isPr && <span className="pr-badge">PR</span>}</span>
          {cardio ? (
            <>
              <input type="number" inputMode="decimal" value={s.minutes} onChange={(ev) => onSet(j, "minutes", ev.target.value)} />
              <input type="number" inputMode="decimal" value={s.distance_km} onChange={(ev) => onSet(j, "distance_km", ev.target.value)} />
            </>
          ) : (
            <>
              <input type="number" inputMode="numeric" value={s.reps} placeholder={prev?.reps != null ? String(prev.reps) : ""}
                onChange={(ev) => onSet(j, "reps", ev.target.value)} onBlur={() => onDone(j)} />
              <input type="number" inputMode="decimal" step="0.5" value={s.weight_kg} placeholder={prev?.weight_kg != null ? String(prev.weight_kg) : ""}
                onChange={(ev) => onSet(j, "weight_kg", ev.target.value)} onBlur={() => onDone(j)} />
            </>
          )}
          <button className="btn secondary sm" onClick={() => onRemoveSet(j)} aria-label="Remove set">×</button>
        </div>
        );
      })}
      <div className="row between">
        <button className="btn secondary sm" onClick={onAddSet}>+ Add set</button>
        {!cardio && best > 0 && <span className="muted small">Est. 1-rep max: {fmt(best, 1)} kg</span>}
      </div>
    </div>
  );
}
