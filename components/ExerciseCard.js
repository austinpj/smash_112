"use client";
import { e1rm, fmt } from "@/lib/calc";
import { checkPR } from "@/components/WorkoutExtras";

// One exercise in the workout: your best ever, set boxes (last time's numbers as faint hints) and PR badges
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
      {!e.best && !e.last && <p className="muted small">First time logging this one — today sets your baseline 💪</p>}
      {!cardio && <BestEver best={e.best} />}
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

const nice = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// Your all-time best for this exercise + what to hit next time to beat it
function BestEver({ best }) {
  if (!best) return null;
  const h = best.heavySet, s = best.strongSet, r = best.repSet;
  if (h) {
    const sameSet = s && s.weight === h.weight && s.reps === h.reps;
    // Fewest reps at your best weight that would beat your strongest set (= a new PR)
    let need = (h.reps || 0) + 1;
    while (need < 50 && e1rm(h.weight, need) <= best.e1rm + 0.05) need++;
    return (
      <div className="best-ever">
        🏆 <span className="muted">Best ever:</span> <b>{fmt(h.weight, 1)} kg × {h.reps || "-"}</b>
        <span className="muted"> ({nice(h.date)})</span>
        {s && !sameSet && (
          <span className="muted"> · strongest set <b>{s.reps}×{fmt(s.weight, 1)} kg</b> ({nice(s.date)})</span>
        )}
        <span className="beat muted small">
          🎯 To beat it: <b>{fmt(h.weight, 1)} kg × {need}</b> or <b>{fmt(h.weight + 2.5, 1)} kg × {Math.max(1, h.reps || 1)}</b>
        </span>
      </div>
    );
  }
  if (r) {
    return (
      <div className="best-ever">
        🏆 <span className="muted">Best ever:</span> <b>{r.reps} reps</b><span className="muted"> ({nice(r.date)})</span>
        <span className="beat muted small">🎯 To beat it: <b>{r.reps + 1} reps</b></span>
      </div>
    );
  }
  return null;
}
