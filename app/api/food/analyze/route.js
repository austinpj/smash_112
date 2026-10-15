import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Tried in order. If Google retires one (404), the next is used automatically.
const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3-flash-preview"];

const PROMPT = `You are a nutrition assistant. Look at this photo of food and estimate its nutrition.
The user is in Kerala, India, so consider South Indian / Kerala dishes (rice, chapati, appam, puttu, dosa, idli,
sambar, avial, thoran, fish curry, beef fry, parotta, etc.) as well as any other cuisine.
Identify each distinct food item, estimate the portion in grams as served, and estimate calories,
protein, carbohydrates and fat for that portion. If something is unclear, make your best reasonable guess
and say so in "notes". If the image does not contain food, return an empty "items" array.
Reply with JSON only, in exactly this shape:
{"items":[{"name":string,"grams":number,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}],
 "notes":string}`;

export async function POST(request) {
  // Only signed-in users may use the AI (protects your API key from strangers)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Photo analysis isn't set up yet (GEMINI_API_KEY is missing)." }, { status: 500 });
  }

  const { image } = await request.json().catch(() => ({}));
  const match = typeof image === "string" && image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "No image received." }, { status: 400 });
  const [, mimeType, data] = match;
  if (data.length > 4_000_000) return NextResponse.json({ error: "Image is too large." }, { status: 413 });

  const models = [process.env.GEMINI_MODEL, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  const call = (model, fast) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data } }] }],
        generationConfig: {
          responseMimeType: "application/json",
          ...(fast ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      }),
    });

  let res, lastStatus = 0, lastDetail = "";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Two rounds: if every model is busy, wait a moment and try once more.
  outer: for (let round = 0; round < 2; round++) {
    if (round === 1) await sleep(1500);
    for (const model of models) {
      res = await call(model, true);
      if (res.status === 400) res = await call(model, false); // model may not support the speed setting
      if (res.ok) break outer;
      lastStatus = res.status;
      lastDetail = await res.text();
      console.error("Gemini error", model, res.status, lastDetail.slice(0, 300));
      if (res.status === 401 || res.status === 403) break outer; // bad key — no point retrying
      // 404 = model retired, 429 = that model's free limit used, 500/503 = busy → try the next model
    }
  }

  if (!res.ok) {
    let msg = `AI service error (${lastStatus}).`;
    if (lastStatus === 400 || lastStatus === 403) msg += " Check that GEMINI_API_KEY in Vercel is correct.";
    else if (lastStatus === 429) msg += " Daily free limit reached — try again later.";
    else if (lastStatus === 503 || lastStatus === 500) msg = "Google's AI is very busy right now. Please try again in a minute.";
    else msg += " Try again in a moment.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || "").join("") || "";
  try {
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
    const items = (parsed.items || []).map((i) => ({
      name: String(i.name || "Food"),
      grams: Math.round(Number(i.grams) || 0),
      calories: Math.round(Number(i.calories) || 0),
      protein_g: Math.round((Number(i.protein_g) || 0) * 10) / 10,
      carbs_g: Math.round((Number(i.carbs_g) || 0) * 10) / 10,
      fat_g: Math.round((Number(i.fat_g) || 0) * 10) / 10,
    }));
    return NextResponse.json({ items, notes: parsed.notes || "" });
  } catch {
    return NextResponse.json({ error: "Couldn't read the AI's answer. Please try another photo." }, { status: 502 });
  }
}
