"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/calc";

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const CSS = `
.coach { margin-top: 22px; padding: 16px; border-radius: 16px; border: 1px solid rgba(139,92,246,.35);
  background: linear-gradient(160deg, rgba(139,92,246,.12), rgba(46,242,196,.06)); }
.coach li { margin: 3px 0; }
.coach-change { margin-top: 12px; padding: 12px; border-radius: 12px; border: 1px solid rgba(198,255,61,.35); background: rgba(198,255,61,.07); }
`;

// ═════════════════════════ AI coach ═════════════════════════
export default function CoachCard({ r, profile, start, end }) {
  const key = `smash-coach-${iso(end)}`;
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState("");

  async function run(force) {
    if (!force) { try { const cached = JSON.parse(localStorage.getItem(key) || "null"); if (cached) return setC(cached); } catch {} }
    setBusy(true); setErr("");
    try {
      const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
      const res = await fetch("/api/coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            sex: profile?.sex, age, height_cm: profile?.height_cm, weight_kg: r.wEnd,
            activity_level: profile?.activity_level, goal: profile?.goal,
            current_calorie_target: Math.round(r.stats.target || 0) || null,
            current_protein_target: Math.round(r.stats.protein || 0) || null,
            maintenance_kcal: Math.round(r.stats.tdee || 0) || null,
          },
          week: {
            dates: `${iso(start)} to ${iso(end)}`,
            workouts: r.workouts, prev_workouts: r.prevWorkouts, sets: r.sets, volume_kg: Math.round(r.volume),
            prev_volume_kg: Math.round(r.prevVolume), new_prs: r.prs.map((p) => p.name),
            food_days_logged: r.foodDays, avg_kcal: r.avgKcal && Math.round(r.avgKcal), avg_protein_g: r.avgProt && Math.round(r.avgProt),
            total_steps: r.totalSteps, days_10k: r.goalDays,
            weight_change_kg: r.weightChange, weight_history: r.weights,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI coach failed");
      setC(json);
      try { localStorage.setItem(key, JSON.stringify(json)); } catch {}
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { run(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function apply(kcal, prot) {
    const { error } = await createClient().from("profiles")
      .update({ calorie_target_override: kcal, protein_target_override: prot }).eq("id", profile.id);
    if (error) return setErr(error.message.includes("column") ? "Run supabase/coach.sql in Supabase first." : error.message);
    setApplied(kcal || prot ? "New targets applied ✓ — Home and Food now use them." : "Back to automatic targets ✓");
  }

  const changes = c && (c.calorie_target || c.protein_target);
  return (
    <div className="coach">
      <style>{CSS}</style>
      <div className="row between">
        <h3 className="report-h" style={{ margin: 0 }}>✨ AI Coach</h3>
        {c && !busy && <button className="btn secondary sm" onClick={() => run(true)}>Refresh</button>}
      </div>
      {busy && <p className="muted small">Analysing your week…</p>}
      {err && <p className="error">{err} <button className="btn secondary sm" onClick={() => run(true)}>Try again</button></p>}
      {c && (
        <>
          <p style={{ margin: "8px 0 4px" }}>{c.summary}</p>
          {c.wins.length > 0 && <CoachList title="✅ Going well" items={c.wins} />}
          {c.issues.length > 0 && <CoachList title="⚠️ Needs attention" items={c.issues} />}
          {c.actions.length > 0 && <CoachList title="🎯 Next week" items={c.actions} />}
          {changes ? (
            <div className="coach-change">
              <div className="muted small">Suggested new daily targets</div>
              <div className="row" style={{ gap: 16, margin: "4px 0" }}>
                {c.calorie_target && <b>{fmt(r.stats.target)} → {fmt(c.calorie_target)} kcal</b>}
                {c.protein_target && <b>{fmt(r.stats.protein)} → {fmt(c.protein_target)} g protein</b>}
              </div>
              <p className="muted small" style={{ margin: "0 0 8px" }}>{c.target_reason}</p>
              {!applied && <button className="btn sm" onClick={() => apply(c.calorie_target || Math.round(r.stats.target) || null, c.protein_target || Math.round(r.stats.protein) || null)}>Apply new targets</button>}
            </div>
          ) : <p className="muted small">Your current targets look right — no change needed.</p>}
          {r.stats.custom && !applied && <button className="btn secondary sm" style={{ marginTop: 8 }} onClick={() => apply(null, null)}>Use automatic targets instead</button>}
          {applied && <p className="muted small">{applied}</p>}
          <p className="muted small" style={{ marginBottom: 0 }}>AI suggestions are general guidance, not medical advice.</p>
        </>
      )}
    </div>
  );
}

function CoachList({ title, items }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="small" style={{ fontWeight: 700 }}>{title}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{items.map((x, i) => <li key={i} className="small">{x}</li>)}</ul>
    </div>
  );
}
