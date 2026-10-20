"use client";
import { useMemo, useState } from "react";
import { FOOD_GROUPS, ALL_FOODS, portionItem } from "@/lib/foods";

// Extra words people might type (Malayalam / local spellings) so search finds the right food
const ALIASES = {
  "White rice (cooked)": "choru chor rice sadam",
  "Kerala matta / red rice (cooked)": "choru matta rose rice chamba",
  "Chapati": "chapathi chappathi chapatti roti phulka",
  "Kerala parotta": "porotta parotta paratha barotta",
  "Poori": "puri",
  "Appam": "palappam vellayappam",
  "Puttu (rice, with coconut)": "puttu pittu",
  "Dosa (plain)": "dosha thosai",
  "Masala dosa": "masala dosha",
  "Idiyappam": "noolappam string hoppers",
  "Coconut chutney": "chammanthi thenga",
  "Dal / parippu curry": "parippu dal dhal lentil",
  "Kadala curry": "kadala chana chickpea",
  "Moru curry / pulissery": "moru kachiyathu pulissery",
  "Soya chunks curry": "soya meal maker",
  "Egg (boiled)": "mutta egg",
  "Omelette": "mutta omlet omelet",
  "Egg curry": "mutta curry",
  "Chicken curry (Kerala)": "kozhi chicken",
  "Chicken breast (grilled)": "kozhi chicken",
  "Chicken fry": "kozhi chicken fried",
  "Fish curry": "meen curry",
  "Fish fry": "meen varuthathu porichathu",
  "Beef fry / ularthiyathu": "beef ularthu erachi irachi",
  "Pazham pori": "ethakka appam banana fritter",
  "Parippu vada": "dal vada",
  "Uzhunnu vada": "medu vada ulundu",
  "Banana chips": "upperi kaya chips",
  "Peanuts": "kappalandi groundnut",
  "Banana (small, poovan)": "pazham poovan",
  "Nendran banana": "ethapazham nenthran pazham",
  "Tea with milk & sugar": "chaya chai",
  "Coffee with milk & sugar": "kaapi kappi",
  "Milk (toned)": "paal",
  "Curd / thairu": "thayir dahi yogurt",
  "Buttermilk / sambharam": "moru sambaram",
};
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");

export default function FoodPicker({ onAdd }) {
  const [q, setQ] = useState("");
  const [foodId, setFoodId] = useState("");
  const [qty, setQty] = useState(1);

  // The search box filters the dropdown below it
  const groups = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const match = (f) => words.every((w) => norm(`${f.name} ${ALIASES[f.name] || ""}`).includes(w));
    return FOOD_GROUPS.map((g) => ({ ...g, foods: words.length ? g.foods.filter(match) : g.foods })).filter((g) => g.foods.length);
  }, [q]);
  const count = groups.reduce((a, g) => a + g.foods.length, 0);

  function search(v) {
    setQ(v);
    // If the search leaves exactly one food, pick it automatically
    const words = norm(v).split(/\s+/).filter(Boolean);
    const hits = words.length ? ALL_FOODS.filter((f) => words.every((w) => norm(`${f.name} ${ALIASES[f.name] || ""}`).includes(w))) : [];
    setFoodId(hits.length === 1 ? hits[0].id : "");
  }

  const food = ALL_FOODS.find((f) => f.id === foodId);
  const preview = food && portionItem(food, qty);
  function add() {
    if (!food || !(Number(qty) > 0)) return;
    onAdd(portionItem(food, qty));
    setFoodId(""); setQ(""); setQty(1);
  }

  return (
    <div className="field">
      <label>🥣 No weighing scale? Pick a portion</label>
      <input type="search" value={q} onChange={(e) => search(e.target.value)}
        placeholder="🔍 Search… e.g. chapathi, sambar, mutta, chaya" style={{ marginBottom: 8 }} />
      <div className="row">
        <select value={foodId} onChange={(e) => setFoodId(e.target.value)} style={{ flex: "2 1 220px" }}>
          <option value="">{q ? (count ? `Choose from ${count} match${count > 1 ? "es" : ""}…` : "No match — try ✍️ Describe below") : "Choose food…"}</option>
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.foods.map((f) => <option key={f.id} value={f.id}>{f.name} — per {f.unit}</option>)}
            </optgroup>
          ))}
        </select>
        <div className="row" style={{ gap: 4, flex: "0 0 auto" }}>
          <button type="button" className="btn secondary sm" onClick={() => setQty(Math.max(0.5, Number(qty) - 0.5))} aria-label="Less">−</button>
          <input type="number" inputMode="decimal" min="0.5" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)}
            style={{ width: 64, textAlign: "center" }} aria-label="How many" />
          <button type="button" className="btn secondary sm" onClick={() => setQty(Number(qty) + 0.5)} aria-label="More">+</button>
        </div>
        <button type="button" className="btn sm" onClick={add} disabled={!food}>Add</button>
      </div>
      {preview && <p className="muted small" style={{ margin: "6px 0 0" }}>{preview.name}: ~{preview.calories} kcal · {preview.protein_g} g protein · {preview.grams} g</p>}
    </div>
  );
}
