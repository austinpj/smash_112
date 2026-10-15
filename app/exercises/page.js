"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GROUPS = ["Chest","Back","Shoulders","Biceps","Triceps","Forearms","Legs","Quads","Hamstrings","Glutes","Calves","Core","Full body","Cardio","Flexibility"];

export default function Exercises() {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState([]);
  const [userId, setUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", muscle_group: "Chest", equipment: "", category: "strength" });
  const [err, setErr] = useState("");

  async function load() {
    const { data } = await supabase.from("exercises").select("*").order("muscle_group").order("name");
    setList(data || []);
  }
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e) {
    e.preventDefault();
    setErr("");
    const met = form.category === "cardio" ? 6 : form.category === "bodyweight" ? 5 : 5;
    const { error } = await supabase.from("exercises").insert({ ...form, met, user_id: userId });
    if (error) return setErr(error.message);
    setForm({ ...form, name: "", equipment: "" });
    load();
  }
  async function remove(id) {
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) return alertLike(setErr, "Can't delete — it's used in a logged workout.");
    load();
  }

  const shown = list.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()) || x.muscle_group.toLowerCase().includes(search.toLowerCase()));
  const grouped = shown.reduce((acc, x) => ((acc[x.muscle_group] ||= []).push(x), acc), {});

  return (
    <>
      <h1>Exercise library</h1>
      <form className="card" onSubmit={add}>
        <h2>Add your own exercise</h2>
        <div className="grid">
          <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Muscle group</label>
            <select value={form.muscle_group} onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}>
              {GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select></div>
          <div className="field"><label>Equipment</label><input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="Dumbbell, Machine…" /></div>
          <div className="field"><label>Type</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="strength">Strength (reps × kg)</option>
              <option value="bodyweight">Bodyweight (reps)</option>
              <option value="cardio">Cardio (minutes / km)</option>
            </select></div>
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn">Add exercise</button>
      </form>

      <div className="field"><input placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {Object.entries(grouped).map(([g, items]) => (
        <div className="card" key={g}>
          <h2>{g} <span className="muted small">({items.length})</span></h2>
          <table><tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.name} {x.user_id && <span className="pill">yours</span>}</td>
                <td className="muted">{x.equipment}</td>
                <td style={{ textAlign: "right" }}>
                  {x.user_id && <button className="btn danger sm" onClick={() => remove(x.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
    </>
  );
}

function alertLike(setErr, msg) { setErr(msg); window.scrollTo({ top: 0, behavior: "smooth" }); }
