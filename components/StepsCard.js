"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stepStats, STEP_GOAL, fmt } from "@/lib/calc";
import DayPicker, { daysAgo, dayLabel } from "@/components/DayPicker";

// Steps ring + "add steps" box. You can also pick Yesterday / an older day to fill in steps you forgot.
export default function StepsCard({ todaySteps, onTodaySaved, weight, heightCm, ready, userId }) {
  const today = daysAgo(0);
  const [day, setDay] = useState(today);
  const [daySteps, setDaySteps] = useState(null); // steps for a past day (null = loading)
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const R = 52, C = 2 * Math.PI * R;

  useEffect(() => {
    setMsg(""); setErr(""); setInput("");
    if (day === today) return;
    setDaySteps(null);
    createClient().from("daily_steps").select("steps").eq("day", day).maybeSingle()
      .then(({ data }) => setDaySteps(data?.steps || 0));
  }, [day, today]);

  const steps = day === today ? todaySteps : daySteps || 0;
  const walk = stepStats(steps, weight, heightCm);

  async function save(e) {
    e.preventDefault();
    const n = Math.round(Number(input));
    if (!input || Number.isNaN(n) || n < 0) return setErr("Enter a number of steps.");
    setBusy(true); setErr(""); setMsg("");
    const { error } = await createClient()
      .from("daily_steps")
      .upsert({ user_id: userId, day, steps: n, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" });
    setBusy(false);
    if (error) return setErr(error.message);
    if (day === today) onTodaySaved(n); else setDaySteps(n);
    setInput("");
    setMsg(`Saved ${fmt(n)} steps for ${dayLabel(day)}.`);
  }

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Steps {day === today ? "today" : dayLabel(day)}</h2>
        <span className="pill">Goal {fmt(STEP_GOAL)}</span>
      </div>
      {!ready ? (
        <p className="muted">Step tracking isn’t switched on yet — run <b>supabase/steps.sql</b> in the Supabase SQL Editor.</p>
      ) : (
        <>
          <DayPicker value={day} onChange={setDay} label="Adding steps for" />
          <div className="steps-wrap">
            <div className="ring">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c6ff3d" />
                    <stop offset="100%" stopColor="#2ef2c4" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r={R} className="ring-bg" />
                <circle cx="60" cy="60" r={R} className="ring-fg"
                  style={{ strokeDasharray: C, strokeDashoffset: C * (1 - walk.pct / 100), "--c": C }} />
              </svg>
              <div className="ring-center">
                <div className="ring-num">{day !== today && daySteps === null ? "…" : fmt(steps)}</div>
                <div className="muted small">{fmt(walk.pct)}%</div>
              </div>
            </div>
            <div className="steps-side">
              <div className="steps-stats">
                <div><div className="muted small">Distance</div><b>{fmt(walk.km, 2)} km</b></div>
                <div><div className="muted small">Calories burned</div><b>{weight ? `${fmt(walk.kcal)} kcal` : "add weight"}</b></div>
                <div><div className="muted small">To goal</div><b>{fmt(Math.max(0, STEP_GOAL - steps))}</b></div>
              </div>
              <form className="row" onSubmit={save}>
                <input type="number" inputMode="numeric" placeholder={day === today ? "Today’s total steps" : `Total steps ${dayLabel(day)}`}
                  value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                <button className="btn" disabled={busy}>{busy ? "Saving…" : steps ? "Update" : "Save"}</button>
              </form>
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                Copy the day’s total from your phone’s step counter (Google Fit, Samsung Health, Apple Health) — it keeps past days too.
              </p>
              {err && <p className="error">{err}</p>}
              {msg && !err && <p className="small" style={{ margin: "6px 0 0", color: "var(--accent)" }}>✓ {msg}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
