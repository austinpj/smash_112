"use client";
import { useEffect } from "react";
import { e1rm, fmt, todayISO } from "@/lib/calc";

// ───────────── History: "last time" + personal records ─────────────
// For each exercise: the most recent session (by workout date, any day of the week)
// and the all-time bests used to spot new PRs.
export async function loadHistory(supabase, ids, date) {
  const out = {};
  if (!ids.length) return out;
  const { data } = await supabase
    .from("workout_sets")
    .select("reps, weight_kg, duration_sec, distance_km, set_number, created_at, exercise_id, workout_id, workouts(performed_on)")
    .in("exercise_id", ids)
    .order("created_at", { ascending: false })
    .limit(3000);
  for (const id of ids) {
    const rows = (data || []).filter((r) => r.exercise_id === id && r.workouts?.performed_on && r.workouts.performed_on <= date);
    if (!rows.length) { out[id] = { last: null, best: null }; continue; }
    rows.sort((a, b) => b.workouts.performed_on.localeCompare(a.workouts.performed_on) || b.created_at.localeCompare(a.created_at));
    const wid = rows[0].workout_id;
    const last = {
      date: rows[0].workouts.performed_on,
      sets: rows.filter((r) => r.workout_id === wid).sort((a, b) => (a.set_number || 0) - (b.set_number || 0)),
    };
    const best = { weight: 0, e1rm: 0, reps: 0 };
    for (const r of rows) {
      const w = Number(r.weight_kg) || 0, n = Number(r.reps) || 0;
      if (w > best.weight) best.weight = w;
      if (w > 0 && n > 0) best.e1rm = Math.max(best.e1rm, e1rm(w, n));
      if (!w && n > best.reps) best.reps = n;
    }
    out[id] = { last, best };
  }
  return out;
}

// Does this set beat `best`? Returns { title, detail } or null.
export function checkPR(best, set) {
  if (!best) return null; // first time doing this exercise — nothing to beat yet
  const w = Number(set.weight_kg) || 0, r = Number(set.reps) || 0;
  if (!r) return null;
  if (w > 0) {
    if (w > best.weight) return { title: "Heaviest lift ever!", detail: `${w} kg × ${r} — your old best was ${fmt(best.weight, 1)} kg` };
    const e = e1rm(w, r);
    if (best.e1rm > 0 && e > best.e1rm + 0.05)
      return { title: "New strength PR!", detail: `${r} reps at ${w} kg — est. 1-rep max ${fmt(e, 1)} kg (was ${fmt(best.e1rm, 1)} kg)` };
    return null;
  }
  if (best.reps > 0 && r > best.reps) return { title: "New rep record!", detail: `${r} reps — your old best was ${best.reps}` };
  return null;
}

// Best of the history plus the other sets already done today (so the 2nd identical set doesn't celebrate again)
export function bestIncluding(best, sets, skip) {
  if (!best) return null;
  const b = { ...best };
  sets.forEach((s, j) => {
    if (j === skip) return;
    const w = Number(s.weight_kg) || 0, n = Number(s.reps) || 0;
    if (w > b.weight) b.weight = w;
    if (w > 0 && n > 0) b.e1rm = Math.max(b.e1rm, e1rm(w, n));
    if (!w && n > b.reps) b.reps = n;
  });
  return b;
}

const HYPE = [
  "🔥 BEAST MODE!",
  "🏆 NEW PERSONAL RECORD!",
  "💪 STRONGER THAN EVER!",
  "⚡ PR SMASHED!",
  "🚀 RECORD BROKEN!",
  "👑 THAT'S A NEW BEST!",
];
const CHEER = [
  "Past you just got beaten. Progressive overload done right.",
  "This is exactly how strength is built. Keep stacking these.",
  "Nobody handed you that — you earned it. Smash!",
  "Every PR is proof the work is working.",
  "New ceiling unlocked. Next week, we go again.",
];
export const pickHype = () => ({
  hype: HYPE[Math.floor(Math.random() * HYPE.length)],
  cheer: CHEER[Math.floor(Math.random() * CHEER.length)],
});

// ───────────── Big celebration popup ─────────────
export function PRToast({ pr, onClose }) {
  useEffect(() => {
    if (!pr) return;
    try { navigator.vibrate?.([60, 40, 120]); } catch {}
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [pr, onClose]);
  if (!pr) return null;
  const colors = ["#c6ff3d", "#2ef2c4", "#facc15", "#f472b6", "#60a5fa", "#fb923c"];
  return (
    <div className="pr-toast-wrap" onClick={onClose} role="alert">
      <div className="pr-confetti" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.08}s`, transform: `rotate(${i * 25}deg)` }} />
        ))}
      </div>
      <div className="pr-toast">
        <div className="pr-trophy">🏆</div>
        <div className="pr-hype">{pr.hype}</div>
        <div className="pr-ex">{pr.exercise} — {pr.title}</div>
        <div className="muted small">{pr.detail}</div>
        <div className="pr-cheer">{pr.cheer}</div>
      </div>
    </div>
  );
}

// ───────────── "Repeat a workout" card ─────────────
const DAY = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short" });
const DAY_LONG = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long" });
const SHORT = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// Two workouts are "the same workout" if they have the same title or mostly the same exercises
function similar(a, b) {
  const ta = (a.title || "").trim().toLowerCase(), tb = (b.title || "").trim().toLowerCase();
  if (ta && ta === tb) return true;
  const A = new Set(a.workout_sets.map((s) => s.exercise_id)), B = new Set(b.workout_sets.map((s) => s.exercise_id));
  const common = [...A].filter((x) => B.has(x)).length;
  return common > 0 && common >= Math.min(A.size, B.size) * 0.5;
}

export function RepeatCard({ recent, onPick }) {
  const today = todayISO();
  const todayName = new Date().toLocaleDateString("en-IN", { weekday: "long" });
  // What did you do on this weekday last week? Then find the MOST RECENT time you did that same workout
  // (e.g. Thursday → last Thursday was Back & Tris → you also did it on Monday → suggest Monday's).
  const sameDay = recent.find((w) => DAY_LONG(w.performed_on) === todayName && w.performed_on !== today);
  const suggested = sameDay
    ? recent.find((w) => w.performed_on !== today && w.performed_on >= sameDay.performed_on && similar(w, sameDay)) || sameDay
    : null;
  const label = (w) => w.title || "Workout";
  const count = (w) => new Set(w.workout_sets.map((s) => s.exercise_id)).size;

  return (
    <div className="card">
      <h2>🔁 Repeat a workout</h2>
      <p className="muted small" style={{ marginTop: -6 }}>
        Pick one you did recently — its exercises load in the same order with the same number of sets. Just fill in today’s reps and weights.
      </p>
      {suggested && (
        <button className="repeat-suggest" onClick={() => onPick(suggested)}>
          <span className="muted small">Today is {todayName} · you last did this on {DAY_LONG(suggested.performed_on)} ({SHORT(suggested.performed_on)})</span>
          <b>{label(suggested)}</b>
          <span className="muted small">{count(suggested)} exercises · {suggested.workout_sets.length} sets — tap to load</span>
        </button>
      )}
      <div className="repeat-list">
        {recent.filter((w) => w !== suggested).map((w) => (
          <button key={w.id} className="repeat-chip" onClick={() => onPick(w)}>
            <span className="pill">{DAY(w.performed_on)}</span>
            <span className="rc-title">{label(w)}</span>
            <span className="muted small">{SHORT(w.performed_on)} · {count(w)} ex</span>
          </button>
        ))}
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>Doing something different today? Skip this and add exercises below.</p>
    </div>
  );
}

export const WORKOUT_CSS = `
.draft-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; margin: -6px 0 16px;
  border-radius: 14px; border: 1px solid rgba(198,255,61,.25);
  background: rgba(198,255,61,.07); color: var(--text); font-size: .9rem;
}
.draft-bar > span:nth-child(2) { flex: 1; }
.draft-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; transform: scale(.8); } }
.repeat-suggest {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; text-align: left;
  padding: 14px 16px; margin-bottom: 12px; border-radius: 14px; cursor: pointer; font: inherit; color: var(--text);
  border: 1.5px solid var(--accent); background: rgba(198,255,61,.08); box-shadow: 0 0 24px -12px rgba(198,255,61,.7);
  transition: transform .2s;
}
.repeat-suggest b { font-size: 1.1rem; }
.repeat-suggest:hover { transform: translateY(-2px); }
.repeat-list { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); margin-bottom: 10px; }
.repeat-chip {
  display: flex; align-items: center; gap: 8px; text-align: left; padding: 10px 12px; border-radius: 12px; cursor: pointer;
  font: inherit; color: var(--text); border: 1px solid var(--line); background: rgba(255,255,255,.03); transition: border-color .2s, transform .2s;
}
.repeat-chip:hover { border-color: var(--accent); transform: translateY(-1px); }
.repeat-chip .rc-title { flex: 1; font-weight: 650; font-size: .9rem; }
.new-ex { margin-top: 12px; padding: 14px; border-radius: 14px; border: 1px dashed rgba(198,255,61,.3); animation: rise .3s var(--ease) both; }
.last-time { margin: 8px 0 4px; padding: 8px 12px; border-radius: 12px; background: rgba(46,242,196,.07); border: 1px solid rgba(46,242,196,.2); font-size: .85rem; }
.last-time b { color: var(--accent-2); }
.pr-badge { display: inline-block; margin-left: 4px; padding: 1px 7px; border-radius: 99px; font-size: .68rem; font-weight: 800;
  color: #07080c; background: linear-gradient(90deg, #facc15, var(--accent)); animation: prPop .5s var(--ease) both; }
.set-pr input { border-color: #facc15 !important; box-shadow: 0 0 12px -4px #facc15; }
@keyframes prPop { from { transform: scale(.3); opacity: 0 } 70% { transform: scale(1.2) } to { transform: scale(1); opacity: 1 } }
.pr-toast-wrap { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 16px;
  background: rgba(4,5,8,.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: fade .25s ease both; overflow: hidden; }
.pr-toast { position: relative; max-width: 380px; width: 100%; text-align: center; padding: 26px 22px; border-radius: 24px;
  background: linear-gradient(180deg, #1c2130, #11141b); border: 1.5px solid #facc15;
  box-shadow: 0 0 60px -10px rgba(250,204,21,.6), 0 30px 80px -20px rgba(0,0,0,.9); animation: modal-in .5s var(--ease) both; }
.pr-trophy { font-size: 3.4rem; line-height: 1; animation: prBounce 1s var(--ease) both; }
@keyframes prBounce { 0% { transform: scale(0) rotate(-30deg) } 60% { transform: scale(1.3) rotate(10deg) } 100% { transform: scale(1) } }
.pr-hype { margin-top: 8px; font-size: 1.5rem; font-weight: 900; letter-spacing: -.02em;
  background: linear-gradient(90deg, #facc15, var(--accent), var(--accent-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.pr-ex { margin: 6px 0 2px; font-weight: 700; }
.pr-cheer { margin-top: 12px; font-size: .9rem; color: var(--text); }
.pr-confetti { position: absolute; inset: 0; pointer-events: none; }
.pr-confetti i { position: absolute; top: -12px; width: 8px; height: 14px; border-radius: 2px; animation: prFall 2.4s cubic-bezier(.2,.7,.4,1) both; }
@keyframes prFall { to { top: 105%; transform: rotate(720deg) translateX(40px); opacity: .2 } }
`;
