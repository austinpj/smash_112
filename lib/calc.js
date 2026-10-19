// All fitness maths lives here so it is easy to check and change.

export const ACTIVITY_LEVELS = {
  sedentary: { label: "Sedentary (little exercise)", factor: 1.2 },
  light: { label: "Light (1–3 days/week)", factor: 1.375 },
  moderate: { label: "Moderate (3–5 days/week)", factor: 1.55 },
  active: { label: "Active (6–7 days/week)", factor: 1.725 },
  very_active: { label: "Very active (hard training / physical job)", factor: 1.9 },
};

export const GOALS = {
  lose: { label: "Lose fat", adjust: -500 },
  maintain: { label: "Maintain", adjust: 0 },
  gain: { label: "Build muscle", adjust: 300 },
};

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

// Estimated one-rep max (Epley formula)
export function e1rm(weight, reps) {
  const w = num(weight), r = num(reps);
  if (!w || !r) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export function setVolume(s) {
  return num(s.reps) * num(s.weight_kg);
}

export function totalVolume(sets) {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

// Calories burned for timed activity: MET × body weight (kg) × hours
export function metCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes) return 0;
  return met * weightKg * (minutes / 60);
}

// Rough calories for a set of strength work when no duration is entered:
// assume ~1 minute per set (including effort) at the exercise MET.
export function setCalories(set, exercise, weightKg) {
  const met = exercise?.met || 5;
  const minutes = set.duration_sec ? set.duration_sec / 60 : 1;
  return metCalories(met, weightKg, minutes);
}

export function ageFromBirthYear(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - Number(birthYear);
}

export function bmi(weightKg, heightCm) {
  const w = num(weightKg), h = num(heightCm) / 100;
  if (!w || !h) return null;
  return w / (h * h);
}

export function bmiCategory(v) {
  if (v === null) return "";
  if (v < 18.5) return "Underweight";
  if (v < 23) return "Normal (Asian cut-off)";
  if (v < 25) return "Overweight (Asian cut-off)";
  return "Obese (Asian cut-off)";
}

// Basal metabolic rate (Mifflin–St Jeor)
export function bmr({ weightKg, heightCm, age, sex }) {
  if (!weightKg || !heightCm || !age || !sex) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function tdee(bmrValue, activity) {
  if (!bmrValue) return null;
  return bmrValue * (ACTIVITY_LEVELS[activity]?.factor || 1.2);
}

export function calorieTarget(tdeeValue, goal) {
  if (!tdeeValue) return null;
  return tdeeValue + (GOALS[goal]?.adjust || 0);
}

export function proteinTarget(weightKg, goal) {
  if (!weightKg) return null;
  return weightKg * (goal === "maintain" ? 1.2 : 1.6);
}

export function bodyStats(profile, weightKg) {
  const age = ageFromBirthYear(profile?.birth_year);
  const b = bmr({ weightKg, heightCm: num(profile?.height_cm), age, sex: profile?.sex });
  const t = tdee(b, profile?.activity_level);
  const bmiV = bmi(weightKg, profile?.height_cm);
  const autoTarget = calorieTarget(t, profile?.goal);
  const autoProtein = proteinTarget(weightKg, profile?.goal);
  // Targets set by the AI coach (or by you) take priority over the automatic ones
  const customKcal = Number(profile?.calorie_target_override) || null;
  const customProtein = Number(profile?.protein_target_override) || null;
  return {
    age,
    bmi: bmiV,
    bmiCategory: bmiCategory(bmiV),
    bmr: b,
    tdee: t,
    target: customKcal || autoTarget,
    protein: customProtein || autoProtein,
    autoTarget,
    autoProtein,
    custom: !!(customKcal || customProtein),
  };
}

export const fmt = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function startOfWeekISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// ───────────── Steps ─────────────
export const STEP_GOAL = 10000;

// Stride length ≈ 41.4% of height; falls back to 0.75 m if height unknown.
export function stepStats(steps, weightKg, heightCm) {
  const s = Number(steps) || 0;
  const strideM = heightCm ? (Number(heightCm) * 0.414) / 100 : 0.75;
  const km = (s * strideM) / 1000;
  // Walking burns roughly 0.78 kcal per kg of body weight per km
  const kcal = weightKg ? 0.78 * Number(weightKg) * km : null;
  return { steps: s, km, kcal, pct: Math.min(100, (s / STEP_GOAL) * 100) };
}
