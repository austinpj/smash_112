import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3-flash-preview"];

const RULES = `You are a careful, encouraging fitness and nutrition coach inside the "Smash" app.
Analyse the user's last week and give practical advice for next week. Use simple English.
Safety rules (always follow):
- Healthy fat loss is about 0.5–1% of body weight per week; muscle gain about 0.25–0.5% per week.
- Never suggest fewer than 1200 kcal/day for women or 1500 kcal/day for men. No crash diets, no supplements or drugs.
- Protein between 1.2 and 2.2 g per kg of body weight.
- Only change targets if the data clearly supports it (e.g. weight not moving for the goal, or moving too fast). Change calories by at most 300 kcal at a time.
- If weight dropped more than 1.5% in a week, or anything looks worrying, gently suggest checking with a doctor.
- If there is too little data (no weight trend, few food days), say so and keep targets unchanged (null).
- This is general guidance, not medical advice.
Reply with JSON only in exactly this shape:
{"summary":string,"wins":[string],"issues":[string],"actions":[string],
 "calorie_target":number|null,"protein_target":number|null,"target_reason":string}
Keep wins/issues to at most 3 short items each and actions to 3–4 specific, doable items.`;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI coach isn't set up (GEMINI_API_KEY missing)." }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body?.week) return NextResponse.json({ error: "No data received." }, { status: 400 });
  const text = `${RULES}\n\nUSER DATA (JSON):\n${JSON.stringify(body).slice(0, 12000)}`;

  const models = [process.env.GEMINI_MODEL, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let res, lastStatus = 0;
  outer: for (let round = 0; round < 2; round++) {
    if (round === 1) await new Promise((r) => setTimeout(r, 1500));
    for (const model of models) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (res.ok) break outer;
      lastStatus = res.status;
      console.error("Coach Gemini error", model, res.status, (await res.text()).slice(0, 300));
      if (res.status === 401 || res.status === 403) break outer;
    }
  }
  if (!res.ok) {
    const msg = lastStatus === 429 ? "AI daily free limit reached — try again tomorrow." :
      lastStatus >= 500 ? "Google's AI is busy right now — try again in a minute." : `AI coach error (${lastStatus}).`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const json = await res.json();
  const out = json?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || "").join("") || "";
  let c;
  try { c = JSON.parse(out.replace(/^```(json)?|```$/g, "").trim()); }
  catch { return NextResponse.json({ error: "Couldn't read the AI's answer. Try again." }, { status: 502 }); }

  // Safety net: keep any suggested targets inside sensible limits
  const p = body.profile || {};
  const w = Number(p.weight_kg) || null;
  const current = Number(p.current_calorie_target) || null;
  let kcal = Number(c.calorie_target) || null;
  if (kcal) {
    const floor = p.sex === "male" ? 1500 : 1200;
    if (current) kcal = Math.min(current + 300, Math.max(current - 300, kcal));
    kcal = Math.max(floor, Math.round(kcal / 10) * 10);
    if (current && Math.abs(kcal - current) < 50) kcal = null;
  }
  let prot = Number(c.protein_target) || null;
  if (prot && w) prot = Math.round(Math.min(2.2 * w, Math.max(1.2 * w, prot)));
  if (prot && Number(p.current_protein_target) && Math.abs(prot - Number(p.current_protein_target)) < 5) prot = null;

  const list = (x) => (Array.isArray(x) ? x.map(String).slice(0, 4) : []);
  return NextResponse.json({
    summary: String(c.summary || ""),
    wins: list(c.wins), issues: list(c.issues), actions: list(c.actions),
    calorie_target: kcal, protein_target: prot,
    target_reason: String(c.target_reason || ""),
  });
}
