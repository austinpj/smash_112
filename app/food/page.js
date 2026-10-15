"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bodyStats, fmt, todayISO } from "@/lib/calc";

const MEALS = ["breakfast", "lunch", "dinner", "snack", "other"];
const blankItem = () => ({ name: "", grams: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" });

function guessMeal() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

// Shrink the photo in the browser before sending (faster, cheaper, fits upload limits)
function resizeImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Couldn't open that image."));
    img.src = URL.createObjectURL(file);
  });
}

export default function Food() {
  const supabase = useMemo(() => createClient(), []);
  const [day, setDay] = useState(todayISO());
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [meal, setMeal] = useState(guessMeal());
  const [preview, setPreview] = useState("");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const { data } = await supabase.from("food_logs").select("*").eq("eaten_on", day).order("created_at");
    setLogs(data || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [day]);
  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from("profiles").select("*").maybeSingle(),
        supabase.from("body_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1),
      ]);
      setStats(bodyStats(p, w?.[0]?.weight_kg ? Number(w[0].weight_kg) : null));
    })();
  }, [supabase]);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setBusy(true); setItems([]); setNotes("");
    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
      const res = await fetch("/api/food/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      if (!json.items.length) throw new Error("No food found in the photo. You can add items manually below.");
      setItems(json.items);
      setNotes(json.notes);
      setSource("ai");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const upd = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const sum = (arr, k) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);

  async function save() {
    setErr("");
    const valid = items.filter((i) => i.name && i.calories !== "");
    if (!valid.length) return setErr("Add at least one item with a name and calories.");
    const { error } = await supabase.from("food_logs").insert({
      eaten_on: day,
      meal_type: meal,
      description: valid.map((i) => i.name).join(", "),
      calories: Math.round(sum(valid, "calories")),
      protein_g: sum(valid, "protein_g"),
      carbs_g: sum(valid, "carbs_g"),
      fat_g: sum(valid, "fat_g"),
      items: valid,
      source,
    });
    if (error) return setErr(error.message);
    setItems([]); setPreview(""); setNotes(""); setSource("manual");
    load();
  }

  async function remove(id) {
    await supabase.from("food_logs").delete().eq("id", id);
    load();
  }

  const totals = { kcal: sum(logs, "calories"), p: sum(logs, "protein_g"), c: sum(logs, "carbs_g"), f: sum(logs, "fat_g") };
  const target = stats?.target;

  return (
    <>
      <div className="row between">
        <h1>Food</h1>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: "auto" }} />
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="Calories" value={fmt(totals.kcal)} sub={target ? `of ${fmt(target)} target · ${fmt(target - totals.kcal)} left` : "set up Profile for a target"} />
        <Stat label="Protein" value={`${fmt(totals.p)} g`} sub={stats?.protein ? `of ${fmt(stats.protein)} g` : ""} />
        <Stat label="Carbs" value={`${fmt(totals.c)} g`} />
        <Stat label="Fat" value={`${fmt(totals.f)} g`} />
      </div>

      <div className="card">
        <h2>Add a meal</h2>
        <div className="grid">
          <div className="field">
            <label>Snap or upload a photo (AI estimates calories)</label>
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={busy} />
          </div>
          <div className="field">
            <label>Meal</label>
            <select value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEALS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
        {busy && <p className="muted">Analysing photo…</p>}
        {preview && <img src={preview} alt="Meal" className="preview-img" />}
        {notes && <p className="muted small">AI note: {notes}</p>}
        {err && <p className="error">{err}</p>}

        {items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Grams</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th /></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 130 }}><input value={it.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                    {["grams", "calories", "protein_g", "carbs_g", "fat_g"].map((k) => (
                      <td key={k} style={{ minWidth: 70 }}><input type="number" inputMode="decimal" value={it[k]} onChange={(e) => upd(i, k, e.target.value)} /></td>
                    ))}
                    <td><button className="btn secondary sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn secondary sm" onClick={() => setItems([...items, blankItem()])}>+ Add item manually</button>
          {items.length > 0 && (
            <>
              <span className="muted small">Total {fmt(sum(items, "calories"))} kcal</span>
              <button className="btn" onClick={save}>Save meal</button>
            </>
          )}
        </div>
        <p className="muted small">AI numbers are estimates — check portion sizes and edit before saving.</p>
      </div>

      <div className="card table-wrap">
        <h2>Meals on {day}</h2>
        {logs.length === 0 ? <p className="muted">Nothing logged.</p> : (
          <table>
            <thead><tr><th>Meal</th><th>What</th><th>kcal</th><th>P / C / F (g)</th><th /></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td><span className="pill">{l.meal_type}</span></td>
                  <td>{l.description}{l.source === "ai" && <span className="muted small"> · AI</span>}</td>
                  <td>{fmt(l.calories)}</td>
                  <td className="muted">{fmt(l.protein_g)} / {fmt(l.carbs_g)} / {fmt(l.fat_g)}</td>
                  <td style={{ textAlign: "right" }}><button className="btn danger sm" onClick={() => remove(l.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
