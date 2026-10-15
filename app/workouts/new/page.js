"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { e1rm, setCalories, fmt, todayISO } from "@/lib/calc";

const emptySet = () => ({ reps: "", weight_kg: "", minutes: "", distance_km: "" });
const DRAFT_KEY = "smash-workout-draft";
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
.new-ex { margin-top: 12px; padding: 14px; border-radius: 14px; border: 1px dashed rgba(198,255,61,.3); animation: rise .3s var(--ease) both; }
`;

const GROUPS = ["Chest","Back","Shoulders","Biceps","Triceps","Forearms","Legs","Quads","Hamstrings","Glutes","Calves","Core","Full body","Cardio","Flexibility"];

export default function NewWorkout() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [exercises, setExercises] = useState([]);
  const [weight, setWeight] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState([]); // [{exercise, sets, last}]
  const [group, setGroup] = useState("All");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userId, setUserId] = useState(null);
  const [draftReady, setDraftReady] = useState(false); // don't overwrite the saved draft before it's loaded
  const [resumed, setResumed] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [showNewEx, setShowNewEx] = useState(false);
  const [newEx, setNewEx] = useState({ name: "", muscle_group: "Chest", equipment: "", category: "strength" });

  // ── Load any workout-in-progress saved on this device ──
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id || null;
      setUserId(uid);
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
        if (d && d.userId === uid && d.entries?.length) {
          setTitle(d.title || ""); setDate(d.date || todayISO()); setDuration(d.duration || "");
          setNotes(d.notes || ""); setEntries(d.entries); setResumed(true); setSavedAt(d.savedAt);
        }
      } catch {}
      setDraftReady(true);
    })();
  }, [supabase]);

  // ── Auto-save on every change ──
  useEffect(() => {
    if (!draftReady) return;
    try {
      if (entries.length === 0 && !title && !notes) { localStorage.removeItem(DRAFT_KEY); return; }
      const now = Date.now();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ userId, title, date, duration, notes, entries, savedAt: now }));
      setSavedAt(now);
    } catch {}
  }, [draftReady, userId, title, date, duration, notes, entries]);

  function discardDraft() {
    if (!window.confirm("Discard this workout in progress?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setEntries([]); setTitle(""); setNotes(""); setDuration(""); setDate(todayISO()); setResumed(false);
  }

  async function createExercise(e) {
    e.preventDefault();
    if (!newEx.name.trim()) return;
    const met = newEx.category === "cardio" ? 6 : 5;
    const { data, error } = await supabase.from("exercises")
      .insert({ ...newEx, name: newEx.name.trim(), met, user_id: userId }).select().single();
    if (error) return setErr(error.message);
    setExercises([...exercises, data].sort((a, b) => a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name)));
    setEntries([...entries, { exercise: data, sets: [emptySet()], last: null }]);
    setNewEx({ ...newEx, name: "", equipment: "" });
    setShowNewEx(false);
  }

  useEffect(() => {
    (async () => {
      const [{ data: ex }, { data: w }] = await Promise.all([
        supabase.from("exercises").select("*").order("muscle_group").order("name"),
        supabase.from("body_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1),
      ]);
      setExercises(ex || []);
      setWeight(w?.[0]?.weight_kg ? Number(w[0].weight_kg) : null);
    })();
  }, [supabase]);

  const groups = ["All", ...Array.from(new Set(exercises.map((e) => e.muscle_group)))];
  const filtered = exercises.filter(
    (e) => (group === "All" || e.muscle_group === group) && e.name.toLowerCase().includes(search.toLowerCase())
  );

  async function addExercise() {
    const ex = exercises.find((e) => e.id === picked);
    if (!ex) return;
    // Fetch the most recent session for this exercise to show "last time"
    const { data: prev } = await supabase
      .from("workout_sets")
      .select("reps, weight_kg, duration_sec, distance_km, workout_id, workouts(performed_on)")
      .eq("exercise_id", ex.id)
      .order("created_at", { ascending: false })
      .limit(20);
    let last = null;
    if (prev && prev.length) {
      const wid = prev[0].workout_id;
      last = { date: prev[0].workouts?.performed_on, sets: prev.filter((p) => p.workout_id === wid).reverse() };
    }
    setEntries([...entries, { exercise: ex, sets: [emptySet()], last }]);
    setPicked("");
  }

  function updateSet(i, j, field, value) {
    const next = entries.map((e, ei) =>
      ei !== i ? e : { ...e, sets: e.sets.map((s, sj) => (sj !== j ? s : { ...s, [field]: value })) }
    );
    setEntries(next);
  }
  function addSet(i) {
    const prevSet = entries[i].sets[entries[i].sets.length - 1];
    setEntries(entries.map((e, ei) => (ei !== i ? e : { ...e, sets: [...e.sets, { ...prevSet }] })));
  }
  function removeSet(i, j) {
    setEntries(entries.map((e, ei) => (ei !== i ? e : { ...e, sets: e.sets.filter((_, sj) => sj !== j) })));
  }
  function removeEntry(i) {
    setEntries(entries.filter((_, ei) => ei !== i));
  }

  const toRow = (s, ex) =>
    ex.category === "cardio"
      ? { duration_sec: s.minutes ? Math.round(Number(s.minutes) * 60) : null, distance_km: s.distance_km || null }
      : { reps: s.reps ? Number(s.reps) : null, weight_kg: s.weight_kg ? Number(s.weight_kg) : null };

  const summary = entries.reduce(
    (acc, e) => {
      e.sets.forEach((s) => {
        const row = toRow(s, e.exercise);
        acc.sets += 1;
        acc.volume += (row.reps || 0) * (row.weight_kg || 0);
        if (weight) acc.kcal += setCalories(row, e.exercise, weight);
      });
      return acc;
    },
    { sets: 0, volume: 0, kcal: 0 }
  );

  async function save() {
    setErr("");
    if (entries.length === 0) return setErr("Add at least one exercise.");
    setSaving(true);
    try {
      const { data: workout, error } = await supabase
        .from("workouts")
        .insert({
          title: title || entries.map((e) => e.exercise.muscle_group).filter((v, i, a) => a.indexOf(v) === i).join(" / "),
          performed_on: date,
          duration_min: duration ? Number(duration) : null,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      const rows = entries.flatMap((e) =>
        e.sets
          .map((s, j) => ({ workout_id: workout.id, exercise_id: e.exercise.id, set_number: j + 1, ...toRow(s, e.exercise) }))
          .filter((r) => r.reps || r.weight_kg || r.duration_sec || r.distance_km)
      );
      if (rows.length) {
        const { error: e2 } = await supabase.from("workout_sets").insert(rows);
        if (e2) throw e2;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/workouts/${workout.id}`);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  }

  return (
    <>
      <style>{DRAFT_CSS}</style>
      <h1>Log a workout</h1>
      {(entries.length > 0 || title) && (
        <div className="draft-bar">
          <span className="draft-dot" />
          <span>
            {resumed ? "Workout in progress restored · " : ""}Auto-saved
            {savedAt ? ` at ${new Date(savedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}
            <span className="muted small"> — safe to refresh or switch tabs</span>
          </span>
          <button className="btn danger sm" onClick={discardDraft}>Discard</button>
        </div>
      )}
      <div className="card">
        <div className="grid">
          <div className="field">
            <label>Title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Push day" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Total time (min)</label>
            <input type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Add exercise</h2>
        <div className="grid">
          <div className="field">
            <label>Muscle group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. squat" />
          </div>
        </div>
        <div className="row">
          <select value={picked} onChange={(e) => setPicked(e.target.value)} style={{ flex: 1, minWidth: 200 }}>
            <option value="">Choose exercise ({filtered.length})</option>
            {filtered.map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.equipment}</option>
            ))}
          </select>
          <button className="btn" onClick={addExercise} disabled={!picked}>Add</button>
        </div>
        {!showNewEx ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Can’t find it?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setShowNewEx(true); setNewEx({ ...newEx, name: search }); }}>
              + Create a new exercise here
            </a>
          </p>
        ) : (
          <form onSubmit={createExercise} className="new-ex">
            <div className="grid">
              <div className="field"><label>Exercise name</label>
                <input autoFocus required value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} /></div>
              <div className="field"><label>Muscle group</label>
                <select value={newEx.muscle_group} onChange={(e) => setNewEx({ ...newEx, muscle_group: e.target.value })}>
                  {GROUPS.map((g) => <option key={g}>{g}</option>)}
                </select></div>
              <div className="field"><label>Type</label>
                <select value={newEx.category} onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}>
                  <option value="strength">Strength (reps × kg)</option>
                  <option value="bodyweight">Bodyweight (reps)</option>
                  <option value="cardio">Cardio (minutes / km)</option>
                </select></div>
            </div>
            <div className="row">
              <button className="btn sm">Create &amp; add to workout</button>
              <button type="button" className="btn secondary sm" onClick={() => setShowNewEx(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {entries.map((e, i) => {
        const cardio = e.exercise.category === "cardio";
        const best = Math.max(0, ...e.sets.map((s) => e1rm(s.weight_kg, s.reps)));
        return (
          <div className="card" key={i}>
            <div className="row between">
              <div>
                <b>{e.exercise.name}</b> <span className="pill">{e.exercise.muscle_group}</span>
              </div>
              <button className="btn danger sm" onClick={() => removeEntry(i)}>Remove</button>
            </div>
            {e.last && (
              <p className="muted small">
                Last time ({e.last.date}):{" "}
                {e.last.sets.map((s) => cardio
                  ? `${fmt((s.duration_sec || 0) / 60)} min${s.distance_km ? ` / ${s.distance_km} km` : ""}`
                  : `${s.reps ?? "-"}×${s.weight_kg ?? 0}kg`).join(", ")}
              </p>
            )}
            <div className="set-grid muted small" style={{ gridTemplateColumns: "32px 1fr 1fr 32px", marginTop: 8 }}>
              <span>Set</span><span>{cardio ? "Minutes" : "Reps"}</span><span>{cardio ? "Distance (km)" : "Weight (kg)"}</span><span />
            </div>
            {e.sets.map((s, j) => (
              <div className="set-grid" key={j} style={{ gridTemplateColumns: "32px 1fr 1fr 32px" }}>
                <span className="muted">{j + 1}</span>
                {cardio ? (
                  <>
                    <input type="number" inputMode="decimal" value={s.minutes} onChange={(ev) => updateSet(i, j, "minutes", ev.target.value)} />
                    <input type="number" inputMode="decimal" value={s.distance_km} onChange={(ev) => updateSet(i, j, "distance_km", ev.target.value)} />
                  </>
                ) : (
                  <>
                    <input type="number" inputMode="numeric" value={s.reps} onChange={(ev) => updateSet(i, j, "reps", ev.target.value)} />
                    <input type="number" inputMode="decimal" step="0.5" value={s.weight_kg} onChange={(ev) => updateSet(i, j, "weight_kg", ev.target.value)} />
                  </>
                )}
                <button className="btn secondary sm" onClick={() => removeSet(i, j)} aria-label="Remove set">×</button>
              </div>
            ))}
            <div className="row between">
              <button className="btn secondary sm" onClick={() => addSet(i)}>+ Add set</button>
              {!cardio && best > 0 && <span className="muted small">Est. 1-rep max: {fmt(best, 1)} kg</span>}
            </div>
          </div>
        );
      })}

      <div className="card">
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="muted small">
          {summary.sets} sets · {fmt(summary.volume)} kg volume
          {weight ? ` · ~${fmt(summary.kcal)} kcal burned (estimate)` : " · add your weight in Profile to estimate calories burned"}
        </p>
        {err && <p className="error">{err}</p>}
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save workout"}</button>
      </div>
    </>
  );
}
