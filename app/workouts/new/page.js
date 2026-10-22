"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setCalories, fmt, todayISO } from "@/lib/calc";
import { RepeatCard, PRToast, WORKOUT_CSS, loadHistory, checkPR, bestIncluding, pickHype } from "@/components/WorkoutExtras";
import ExerciseCard from "@/components/ExerciseCard";

const emptySet = () => ({ reps: "", weight_kg: "", minutes: "", distance_km: "" });
const DRAFT_KEY = "smash-workout-draft";

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
  const [recent, setRecent] = useState([]); // workouts from the last 2 weeks, for "Repeat a workout"
  const [pr, setPr] = useState(null); // the PR celebration popup
  const celebrated = useRef(new Set());
  const closePr = useCallback(() => setPr(null), []);

  // Fill in "last time" (most recent session of each exercise, any day) and all-time bests
  async function refreshHistory(list, onDate) {
    const ids = [...new Set(list.map((e) => e.exercise.id))];
    const h = await loadHistory(supabase, ids, onDate || todayISO());
    setEntries((cur) => cur.map((e) => (h[e.exercise.id] ? { ...e, last: h[e.exercise.id].last || e.last, best: h[e.exercise.id].best } : e)));
  }

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
          refreshHistory(d.entries, d.date);
        }
      } catch {}
      setDraftReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setEntries([...entries, { exercise: data, sets: [emptySet()], last: null, best: null }]);
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

      const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
      const { data: rw } = await supabase
        .from("workouts")
        .select("id, title, performed_on, workout_sets(set_number, reps, weight_kg, duration_sec, distance_km, created_at, exercise_id, exercises(*))")
        .gte("performed_on", since)
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(14);
      setRecent((rw || []).filter((x) => x.workout_sets?.length));
    })();
  }, [supabase]);

  // Load a previous workout: same exercises, same order, same number of sets (boxes left empty)
  function repeatWorkout(w) {
    const sets = [...w.workout_sets].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.set_number - b.set_number);
    const groups = [];
    sets.forEach((st) => {
      if (!st.exercises) return;
      let g = groups.find((x) => x.exercise.id === st.exercise_id);
      if (!g) groups.push((g = { exercise: st.exercises, prev: [] }));
      g.prev.push(st);
    });
    const list = groups.map((g) => ({
      exercise: g.exercise,
      last: { date: w.performed_on, sets: g.prev },
      best: null,
      sets: g.prev.map(() => emptySet()), // same number of sets, empty boxes to fill in today
    }));
    setEntries(list);
    setTitle(w.title || "");
    refreshHistory(list, date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const groups = ["All", ...Array.from(new Set(exercises.map((e) => e.muscle_group)))];
  const filtered = exercises.filter(
    (e) => (group === "All" || e.muscle_group === group) && e.name.toLowerCase().includes(search.toLowerCase())
  );

  async function addExercise() {
    const ex = exercises.find((e) => e.id === picked);
    if (!ex) return;
    setPicked("");
    // The most recent time you did this exercise (any day) + your all-time best, for PRs
    const h = (await loadHistory(supabase, [ex.id], date))[ex.id] || {};
    setEntries((cur) => [...cur, { exercise: ex, sets: [emptySet()], last: h.last || null, best: h.best || null }]);
  }

  function updateSet(i, j, field, value) {
    const next = entries.map((e, ei) =>
      ei !== i ? e : { ...e, sets: e.sets.map((s, sj) => (sj !== j ? s : { ...s, [field]: value })) }
    );
    setEntries(next);
  }
  // When you finish typing a set, check if it beats your best ever → celebrate!
  function celebrate(i, j) {
    const e = entries[i];
    if (!e || e.exercise.category === "cardio") return;
    const s = e.sets[j];
    const res = checkPR(bestIncluding(e.best, e.sets, j), s);
    const key = `${e.exercise.id}|${j}|${s.reps}|${s.weight_kg}`;
    if (!res || celebrated.current.has(key)) return;
    celebrated.current.add(key);
    setPr({ ...pickHype(), ...res, exercise: e.exercise.name });
  }

  function addSet(i) {
    setEntries(entries.map((e, ei) => (ei !== i ? e : { ...e, sets: [...e.sets, emptySet()] })));
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

  const prExercises = entries.filter((e) => e.exercise.category !== "cardio" && e.sets.some((s) => checkPR(e.best, s))).length;

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
      <style>{WORKOUT_CSS}</style>
      <PRToast pr={pr} onClose={closePr} />
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

      {entries.length === 0 && recent.length > 0 && <RepeatCard recent={recent} onPick={repeatWorkout} />}

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

      {entries.map((e, i) => (
        <ExerciseCard key={i} e={e} onRemove={() => removeEntry(i)} onAddSet={() => addSet(i)}
          onSet={(j, field, v) => updateSet(i, j, field, v)} onRemoveSet={(j) => removeSet(i, j)} onDone={(j) => celebrate(i, j)} />
      ))}

      <div className="card">
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {prExercises > 0 && (
          <p style={{ margin: "0 0 8px", fontWeight: 800, color: "#facc15" }}>🏆 New personal record{prExercises > 1 ? `s in ${prExercises} exercises` : ""} today — great work!</p>
        )}
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
