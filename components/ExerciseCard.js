"use client";
import { useState } from "react";
import { e1rm, fmt } from "@/lib/calc";
import { checkPR } from "@/components/WorkoutExtras";

// One exercise in the workout: your best ever, set boxes (last time's numbers as faint hints) and PR badges
export default function ExerciseCard({ e, n, total = 1, dragging, onDragStart, onMoveTo, onRemove, onAddSet, onSet, onRemoveSet, onDone }) {
  const [picking, setPicking] = useState(false); // showing the "Move to position" buttons
  const cardio = e.exercise.category === "cardio";
  const best = Math.max(0, ...e.sets.map((s) => e1rm(s.weight_kg, s.reps)));
  return (
    <div className={"card ex-card" + (dragging ? " dragging" : "")} id={`ex-card-${n}`}>
      <style>{MOVE_CSS}</style>
      <div className="row between" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="drag-handle" onPointerDown={onDragStart} aria-label="Hold and drag to move this exercise" title="Hold and drag to move">
            <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="4" r="1.8" /><circle cx="11" cy="4" r="1.8" />
              <circle cx="5" cy="10" r="1.8" /><circle cx="11" cy="10" r="1.8" />
              <circle cx="5" cy="16" r="1.8" /><circle cx="11" cy="16" r="1.8" />
            </svg>
          </button>
          <button type="button" className={"ex-num" + (picking ? " on" : "")} onClick={() => setPicking(!picking)}
            aria-label={`Exercise ${n}. Tap to move it to another position`} title="Tap to move">{n}</button>
          <b>{e.exercise.name}</b> <span className="pill">{e.exercise.muscle_group}</span>
        </div>
        <button className="btn danger sm" onClick={onRemove}>Remove</button>
      </div>
      {picking && total > 1 && (
        <div className="move-to">
          <span className="muted small">Move to position:</span>
          {Array.from({ length: total }, (_, k) => (
            <button key={k} type="button" className={"mt-chip" + (k + 1 === n ? " here" : "")} disabled={k + 1 === n}
              onClick={() => { setPicking(false); onMoveTo(k); }}>{k + 1}</button>
          ))}
        </div>
      )}
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

const MOVE_CSS = `
.ex-num { display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px;
  font: inherit; font-size: .82rem; font-weight: 800; color: #07080c; background: var(--accent); cursor: pointer; }
.ex-num.on { outline: 2px solid #fff; outline-offset: 2px; }
.move-to { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0 4px; padding: 10px 12px;
  border-radius: 12px; border: 1px dashed rgba(198,255,61,.4); background: rgba(198,255,61,.06); animation: rise .25s var(--ease) both; }
.mt-chip { min-width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,.05);
  color: var(--text); font: inherit; font-weight: 800; cursor: pointer; }
.mt-chip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.mt-chip.here { opacity: .35; cursor: default; }
.drag-handle { display: grid; place-items: center; width: 34px; height: 34px; margin-left: -6px; border-radius: 10px;
  border: 1px solid var(--line); background: rgba(255,255,255,.04); color: var(--muted);
  cursor: grab; touch-action: none; -webkit-user-select: none; user-select: none; }
.drag-handle:hover { color: var(--accent); border-color: rgba(198,255,61,.4); }
.ex-card { transition: transform .15s var(--ease), box-shadow .2s; }
.ex-card.dragging { position: relative; z-index: 5; transform: scale(1.02);
  box-shadow: 0 0 0 2px var(--accent), 0 24px 50px -16px rgba(0,0,0,.9), 0 0 30px -8px var(--accent); }
.ex-card.dragging .drag-handle { cursor: grabbing; color: #07080c; background: var(--accent); border-color: var(--accent); }
body.ex-dragging { -webkit-user-select: none; user-select: none; cursor: grabbing; }
.ex-moved { animation: exMoved 1s var(--ease); }
@keyframes exMoved { 0% { box-shadow: 0 0 0 2px var(--accent), 0 0 30px -6px var(--accent); } 100% { box-shadow: none; } }
`;

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
