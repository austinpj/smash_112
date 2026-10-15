import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const PROMPT = `You are a nutrition assistant. Look at this photo of food and estimate its nutrition.
The user is in Kerala, India, so consider South Indian / Kerala dishes (rice, appam, puttu, dosa, idli,
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

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error", res.status, detail);
    return NextResponse.json({ error: `AI service error (${res.status}). Try again in a moment.` }, { status: 502 });
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
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
