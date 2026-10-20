"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FrogPond from "@/components/FrogPond";

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const L = (ml) => (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : ml % 100 === 0 ? 1 : 2);
const QUICK = [[250, "Glass", "🥛"], [500, "Bottle", "🧴"], [750, "Big bottle", "🍶"], [1000, "1 litre", "💧"]];
const LS = "smash-water-settings";

export default function WaterPage() {
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [goal, setGoal] = useState(3000);
  const [frog, setFrog] = useState("Freddy");
  const [weight, setWeight] = useState(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const since = iso(addDays(new Date(), -40));
      const [{ data: p }, { data: w }, { data: rows, error }] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("body_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1),
        supabase.from("water_logs").select("id, day, ml, created_at").gte("day", since).order("created_at"),
      ]);
      if (error) setMissing(true);
      const kg = w?.[0]?.weight_kg ? Number(w[0].weight_kg) : null;
      setWeight(kg);
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(LS) || "{}"); } catch {}
      const suggested = kg ? clampGoal(Math.round((kg * 35) / 250) * 250) : 3000;
      setGoal(p?.water_goal_ml || saved.goal || suggested);
      setFrog(p?.frog_name || saved.frog || "Freddy");
      setLogs(rows || []);
      setReady(true);
    })();
  }, []);

  const today = iso(now);
  const s = useMemo(() => summarise(logs, goal, today), [logs, goal, today]);
  const pct = Math.min(1, s.todayMl / goal);
  const dead = s.diedYesterday && s.todayMl === 0;
  const night = now.getHours() >= 19 || now.getHours() < 5;
  const hoursLeft = 24 - now.getHours();
  const left = Math.max(0, goal - s.todayMl);
  const name = `${frog}${s.generation > 1 ? ` #${s.generation}` : ""}`;

  async function add(ml) {
    ml = Math.round(Number(ml));
    if (!(ml > 0 && ml <= 3000)) return setErr("Enter between 1 and 3000 ml.");
    setErr(""); setBusy(true);
    const { data, error } = await createClient().from("water_logs").insert({ day: today, ml }).select("id, day, ml, created_at").single();
    setBusy(false);
    if (error) return setErr(error.message);
    setLogs((x) => [...x, data]);
    setCustom("");
    if (navigator.vibrate) navigator.vibrate(30);
  }

  async function remove(id) {
    const { error } = await createClient().from("water_logs").delete().eq("id", id);
    if (error) return setErr(error.message);
    setLogs((x) => x.filter((r) => r.id !== id));
  }

  async function saveSettings(g, f) {
    const goalMl = clampGoal(Math.round(Number(g) * 1000));
    const frogName = (f || "Freddy").trim().slice(0, 20) || "Freddy";
    setGoal(goalMl); setFrog(frogName); setEditing(false);
    try { localStorage.setItem(LS, JSON.stringify({ goal: goalMl, frog: frogName })); } catch {}
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.from("profiles").update({ water_goal_ml: goalMl, frog_name: frogName }).eq("id", session.user.id);
  }

  if (!ready) return <p className="muted">Loading…</p>;

  if (missing) {
    return (
      <>
        <h1>Water 💧</h1>
        <div className="card">
          <b>One-time setup needed</b>
          <p className="muted">Run the file <code>supabase/water.sql</code> in Supabase → SQL Editor, then refresh this page.</p>
        </div>
      </>
    );
  }

  const line = dead
    ? `I didn't make it last night… 💀 Drink some water to hatch a new frog.`
    : pct >= 1 ? `RIBBIT! 🎉 My pond is crystal clear. You kept me alive today!`
    : pct >= 0.6 ? `The lilies are blooming! 🌸 Just ${L(left)} L more and I'm safe.`
    : pct >= 0.3 ? `Better… but the pond is still murky. Keep sipping! 🐸`
    : s.todayMl > 0 ? `So… thirsty… the water is filthy. Please, more! 🥺`
    : `I'm drying out! Give me a glass of water please 🥺`;

  return (
    <>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Water 💧</h1>
          <p className="muted small" style={{ margin: "2px 0 14px" }}>Keep {name} alive — hit your goal every day.</p>
        </div>
        <button className="btn secondary sm" style={{ marginBottom: 14 }} onClick={() => setEditing(!editing)}>⚙️ Goal</button>
      </div>

      {editing && <Settings goal={goal} frog={frog} weight={weight} onSave={saveSettings} onCancel={() => setEditing(false)} />}

      {s.diedYesterday && (
        <div className="card" style={{ borderColor: "rgba(255,93,108,.45)", background: "rgba(255,93,108,.08)" }}>
          <b>💀 {s.lastName(frog)} died last night.</b>
          <span className="muted"> You drank {L(s.yesterdayMl)} L of {L(goal)} L. {s.todayMl > 0 ? `${name} has hatched — don't let this one die!` : "Drink water to hatch a new frog."}</span>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 14 }}>
        <FrogPond health={dead ? 0 : pct} dead={dead} night={night} grave={s.diedYesterday && !dead} />
        <div className="frog-bubble">{line}</div>
      </div>

      <div className="card">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <div><span style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-.03em" }}>{L(s.todayMl)}</span>
            <span className="muted"> / {L(goal)} L</span></div>
          <b style={{ color: pct >= 1 ? "var(--accent)" : "var(--text)" }}>{Math.round(pct * 100)}%</b>
        </div>
        <div className="water-bar"><span style={{ width: `${pct * 100}%` }} /></div>
        {pct < 1 && now.getHours() >= 18 && (
          <p className="error" style={{ marginBottom: 0 }}>⏰ {name} dies at midnight unless you drink {L(left)} L more ({hoursLeft} h left).</p>
        )}
        {pct >= 1 && <p style={{ color: "var(--accent)", margin: "8px 0 0", fontWeight: 700 }}>✅ Goal done — {name} is safe tonight!</p>}

        <div className="water-quick">
          {QUICK.map(([ml, label, icon]) => (
            <button key={ml} className="water-btn" disabled={busy} onClick={() => add(ml)}>
              <span style={{ fontSize: "1.4rem" }}>{icon}</span><b>+{ml} ml</b><span className="muted small">{label}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input type="number" inputMode="numeric" placeholder="Other amount (ml)" value={custom}
            onChange={(e) => setCustom(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn" disabled={busy || !custom} onClick={() => add(custom)}>Add</button>
        </div>
        {err && <p className="error">{err}</p>}
      </div>

      <div className="grid">
        <div className="card"><div className="muted small">Streak</div><b style={{ fontSize: "1.4rem" }}>🔥 {s.streak} day{s.streak === 1 ? "" : "s"}</b></div>
        <div className="card"><div className="muted small">Frogs lost (30 days)</div><b style={{ fontSize: "1.4rem" }}>💀 {s.deaths30}</b></div>
      </div>

      <div className="card">
        <b>Last 7 days</b>
        <div className="water-week">
          {s.week.map((d) => (
            <div key={d.day} className={"ww" + (d.day === today ? " today" : "")}>
              <div style={{ fontSize: "1.3rem" }}>{d.icon}</div>
              <div className="small" style={{ fontWeight: 700 }}>{d.ml ? L(d.ml) : "–"}</div>
              <div className="muted small">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {s.todayRows.length > 0 && (
        <div className="card">
          <b>Today's drinks</b>
          {s.todayRows.slice().reverse().map((r) => (
            <div key={r.id} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span>💧 {r.ml} ml <span className="muted small">· {new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span>
              <button className="btn secondary sm" onClick={() => remove(r.id)} aria-label="Delete">✕</button>
            </div>
          ))}
        </div>
      )}

      <style>{CSS}</style>
    </>
  );
}

function Settings({ goal, frog, weight, onSave, onCancel }) {
  const [g, setG] = useState(String(goal / 1000));
  const [f, setF] = useState(frog);
  const suggest = weight ? clampGoal(Math.round((weight * 35) / 250) * 250) : null;
  return (
    <div className="card">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="field"><label>Daily goal (litres)</label>
          <input type="number" inputMode="decimal" step="0.25" min="1" max="6" value={g} onChange={(e) => setG(e.target.value)} /></div>
        <div className="field"><label>Frog's name</label>
          <input value={f} maxLength={20} onChange={(e) => setF(e.target.value)} /></div>
      </div>
      {suggest && (
        <p className="muted small" style={{ marginTop: 0 }}>
          Suggested for {weight} kg: <b>{L(suggest)} L</b> (about 35 ml per kg).{" "}
          <button type="button" className="btn secondary sm" onClick={() => setG(String(suggest / 1000))}>Use this</button>
        </p>
      )}
      <p className="muted small">Add more on heavy workout or very hot days. The goal is kept between 1 and 6 L, because drinking far more than your body needs can be harmful.</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" onClick={() => onSave(g, f)}>Save</button>
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function clampGoal(ml) { return Math.max(1000, Math.min(6000, ml || 3000)); }

// Works out deaths, streak and the 7-day strip from the raw logs
function summarise(logs, goal, today) {
  const byDay = {};
  for (const r of logs) byDay[r.day] = (byDay[r.day] || 0) + r.ml;
  const first = logs.length ? logs.reduce((m, r) => (r.day < m ? r.day : m), logs[0].day) : today;
  const t = new Date(today + "T12:00:00");
  const dayAt = (n) => iso(addDays(t, n));
  const missed = (d) => d >= first && d < today && (byDay[d] || 0) < goal;

  const yesterday = dayAt(-1);
  let streak = 0;
  for (let i = -1; i > -40; i--) { const d = dayAt(i); if (d < first || (byDay[d] || 0) < goal) break; streak++; }
  if ((byDay[today] || 0) >= goal) streak++;

  let deaths30 = 0, deathsAll = 0;
  for (let i = -1; i > -41; i--) { if (missed(dayAt(i))) { deathsAll++; if (i >= -30) deaths30++; } }

  const week = [];
  for (let i = -6; i <= 0; i++) {
    const d = dayAt(i), ml = byDay[d] || 0;
    const icon = d === today ? (ml >= goal ? "🐸" : "⏳") : d < first ? "·" : ml >= goal ? "🐸" : "💀";
    week.push({ day: d, ml, icon, label: new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "short" }) });
  }

  const diedYesterday = missed(yesterday);
  const generation = deathsAll + 1;
  return {
    todayMl: byDay[today] || 0,
    yesterdayMl: byDay[yesterday] || 0,
    todayRows: logs.filter((r) => r.day === today),
    diedYesterday, streak, deaths30, week, generation,
    lastName: (f) => `${f}${generation - 1 > 1 ? ` #${generation - 1}` : ""}`,
  };
}

const CSS = `
.frog-bubble {
  position: absolute; left: 12px; right: 12px; top: 12px;
  background: rgba(10, 12, 18, .78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(198,255,61,.25); border-radius: 14px;
  padding: 8px 12px; font-size: .86rem; font-weight: 600;
  animation: rise .5s var(--ease) both;
}
.water-bar { height: 12px; border-radius: 99px; background: rgba(255,255,255,.07); overflow: hidden; margin-top: 8px; }
.water-bar span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #38bdf8, var(--accent-2), var(--accent));
  box-shadow: 0 0 12px rgba(46,242,196,.6); transition: width .8s var(--ease); }
.water-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0 12px; }
.water-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 4px;
  background: rgba(56,189,248,.08); border: 1px solid rgba(56,189,248,.25); border-radius: 14px; color: var(--text);
  font: inherit; cursor: pointer; transition: transform .15s var(--ease), background .2s; }
.water-btn:active { transform: scale(.93); background: rgba(56,189,248,.2); }
.water-btn b { font-size: .8rem; }
.water-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 10px; text-align: center; }
.ww { padding: 8px 2px; border-radius: 12px; background: rgba(255,255,255,.03); }
.ww.today { outline: 1px solid var(--accent); }
@media (max-width: 420px) { .water-quick { grid-template-columns: repeat(2, 1fr); } }
`;
