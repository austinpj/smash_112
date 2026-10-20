"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_LEVELS, GOALS, bodyStats, fmt, todayISO } from "@/lib/calc";
import { AppLockSettings } from "@/components/AppLock";
import { InstallSettings } from "@/components/InstallApp";
import ChangePassword from "@/components/ChangePassword";

export default function Profile() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [entry, setEntry] = useState({ logged_on: todayISO(), weight_kg: "", body_fat_pct: "", waist_cm: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("body_logs").select("*").order("logged_on", { ascending: false }).limit(60),
    ]);
    setProfile(p || {});
    setLogs(l || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    const { id, created_at, ...fields } = profile;
    ["birth_year", "height_cm"].forEach((k) => { if (fields[k] === "") fields[k] = null; });
    if (!fields.sex) fields.sex = null;
    const { error } = await supabase.from("profiles").update(fields).eq("id", id);
    if (error) setErr(error.message); else setMsg("Saved.");
  }

  async function addWeight(e) {
    e.preventDefault();
    setErr("");
    const row = { logged_on: entry.logged_on, weight_kg: Number(entry.weight_kg) };
    if (entry.body_fat_pct) row.body_fat_pct = Number(entry.body_fat_pct);
    if (entry.waist_cm) row.waist_cm = Number(entry.waist_cm);
    const { error } = await supabase.from("body_logs").insert(row);
    if (error) return setErr(error.message);
    setEntry({ ...entry, weight_kg: "", body_fat_pct: "", waist_cm: "" });
    load();
  }

  async function removeLog(id) {
    await supabase.from("body_logs").delete().eq("id", id);
    load();
  }

  if (!profile) return <p className="muted">Loading…</p>;
  const weight = logs[0]?.weight_kg ? Number(logs[0].weight_kg) : null;
  const s = bodyStats(profile, weight);
  const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

  return (
    <>
      <h1>Profile & body stats</h1>

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="BMI" value={fmt(s.bmi, 1)} sub={s.bmiCategory} />
        <Stat label="BMR" value={fmt(s.bmr)} sub="kcal at complete rest" />
        <Stat label="Maintenance (TDEE)" value={fmt(s.tdee)} sub="kcal / day" />
        <Stat label="Daily calorie target" value={fmt(s.target)} sub={GOALS[profile.goal]?.label} />
        <Stat label="Protein target" value={s.protein ? `${fmt(s.protein)} g` : "—"} sub="per day" />
      </div>
      <p className="muted small">BMR uses the Mifflin–St Jeor equation; maintenance = BMR × activity factor. These are estimates — adjust based on how your weight actually changes over 2–3 weeks.</p>

      <form className="card" onSubmit={saveProfile}>
        <h2>About you</h2>
        <div className="grid">
          <div className="field"><label>Name</label><input value={profile.full_name || ""} onChange={set("full_name")} /></div>
          <div className="field"><label>Sex (for BMR formula)</label>
            <select value={profile.sex || ""} onChange={set("sex")}>
              <option value="">Select…</option><option value="female">Female</option><option value="male">Male</option>
            </select></div>
          <div className="field"><label>Birth year</label><input type="number" value={profile.birth_year ?? ""} onChange={set("birth_year")} /></div>
          <div className="field"><label>Height (cm)</label><input type="number" step="0.1" value={profile.height_cm ?? ""} onChange={set("height_cm")} /></div>
          <div className="field"><label>Activity level</label>
            <select value={profile.activity_level || "moderate"} onChange={set("activity_level")}>
              {Object.entries(ACTIVITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div className="field"><label>Goal</label>
            <select value={profile.goal || "maintain"} onChange={set("goal")}>
              {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
        </div>
        {err && <p className="error">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button className="btn">Save profile</button>
      </form>

      <form className="card" onSubmit={addWeight}>
        <h2>Log body weight</h2>
        <div className="grid">
          <div className="field"><label>Date</label><input type="date" value={entry.logged_on} onChange={(e) => setEntry({ ...entry, logged_on: e.target.value })} /></div>
          <div className="field"><label>Weight (kg)</label><input required type="number" step="0.1" inputMode="decimal" value={entry.weight_kg} onChange={(e) => setEntry({ ...entry, weight_kg: e.target.value })} /></div>
          <div className="field"><label>Body fat % (optional)</label><input type="number" step="0.1" value={entry.body_fat_pct} onChange={(e) => setEntry({ ...entry, body_fat_pct: e.target.value })} /></div>
          <div className="field"><label>Waist cm (optional)</label><input type="number" step="0.1" value={entry.waist_cm} onChange={(e) => setEntry({ ...entry, waist_cm: e.target.value })} /></div>
        </div>
        <button className="btn">Add entry</button>
        {logs.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Date</th><th>Weight</th><th>Body fat</th><th>Waist</th><th /></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.logged_on}</td><td>{l.weight_kg} kg</td>
                    <td>{l.body_fat_pct ? `${l.body_fat_pct}%` : "—"}</td><td>{l.waist_cm ? `${l.waist_cm} cm` : "—"}</td>
                    <td style={{ textAlign: "right" }}><button type="button" className="btn danger sm" onClick={() => removeLog(l.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>

      <ChangePassword />
      <InstallSettings />
      <AppLockSettings />
    </>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
