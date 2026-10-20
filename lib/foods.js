// Common Kerala / Indian foods with typical household portions.
// Values are approximate averages per ONE portion (home-style cooking) — good for everyday tracking.
// [name, portion label, grams per portion, kcal, protein g, carbs g, fat g]
const RAW = {
  "Rice & breads": [
    ["White rice (cooked)", "bowl", 150, 195, 4, 43, 0.5],
    ["Kerala matta / red rice (cooked)", "bowl", 150, 185, 4, 40, 1],
    ["Chapati", "piece", 40, 110, 3, 18, 3],
    ["Kerala parotta", "piece", 80, 260, 5, 36, 11],
    ["Poori", "piece", 30, 100, 2, 12, 5],
    ["Bread (white)", "slice", 25, 67, 2, 13, 1],
    ["Brown bread", "slice", 28, 70, 3, 12, 1],
  ],
  "Breakfast": [
    ["Appam", "piece", 50, 90, 1.5, 18, 1],
    ["Puttu (rice, with coconut)", "piece", 100, 190, 3.5, 35, 4],
    ["Idli", "piece", 40, 58, 2, 12, 0.2],
    ["Dosa (plain)", "piece", 70, 135, 3, 21, 4],
    ["Masala dosa", "piece", 180, 300, 6, 40, 12],
    ["Idiyappam", "piece", 30, 50, 1, 11, 0.1],
    ["Upma", "bowl", 150, 250, 6, 35, 9],
    ["Oats (cooked in water)", "bowl", 200, 140, 5, 24, 3],
    ["Oats (cooked in milk)", "bowl", 200, 230, 9, 33, 6],
    ["Coconut chutney", "tbsp ×2", 30, 75, 1, 3, 7],
  ],
  "Veg curries": [
    ["Sambar", "bowl", 150, 130, 6, 18, 4],
    ["Dal / parippu curry", "bowl", 150, 160, 8, 20, 5],
    ["Kadala curry", "bowl", 150, 230, 10, 28, 9],
    ["Avial", "bowl", 150, 170, 3, 12, 12],
    ["Thoran", "bowl", 100, 120, 3, 10, 8],
    ["Rasam", "bowl", 150, 60, 2, 8, 2],
    ["Moru curry / pulissery", "bowl", 150, 110, 4, 8, 7],
    ["Paneer curry", "bowl", 150, 300, 14, 10, 22],
    ["Soya chunks curry", "bowl", 150, 200, 18, 14, 8],
  ],
  "Egg, fish & meat": [
    ["Egg (boiled)", "egg", 50, 78, 6.3, 0.6, 5.3],
    ["Omelette", "1-egg", 60, 95, 6.5, 1, 7],
    ["Egg curry", "bowl (2 eggs)", 200, 260, 13, 8, 19],
    ["Chicken curry (Kerala)", "bowl", 150, 250, 22, 6, 15],
    ["Chicken breast (grilled)", "100 g", 100, 165, 31, 0, 3.6],
    ["Chicken fry", "piece", 80, 220, 18, 6, 14],
    ["Fish curry", "bowl", 150, 200, 20, 6, 11],
    ["Fish fry", "piece", 80, 180, 18, 3, 10],
    ["Beef fry / ularthiyathu", "bowl", 100, 280, 24, 5, 18],
    ["Chicken biryani", "plate", 300, 600, 25, 70, 22],
    ["Veg biryani", "plate", 300, 450, 10, 70, 14],
  ],
  "Snacks": [
    ["Pazham pori", "piece", 70, 200, 2, 30, 8],
    ["Parippu vada", "piece", 40, 120, 4, 10, 7],
    ["Uzhunnu vada", "piece", 45, 140, 4, 14, 8],
    ["Samosa", "piece", 70, 260, 4, 30, 14],
    ["Banana chips", "handful", 30, 155, 0.7, 17, 10],
    ["Peanuts", "handful", 30, 170, 7.5, 5, 14],
    ["Marie biscuit", "biscuit", 6, 25, 0.5, 4.5, 0.6],
  ],
  "Fruits": [
    ["Banana (small, poovan)", "piece", 80, 85, 1, 22, 0.3],
    ["Nendran banana", "piece", 150, 180, 2, 45, 0.4],
    ["Apple", "piece", 180, 95, 0.5, 25, 0.3],
    ["Orange", "piece", 130, 60, 1.2, 15, 0.2],
    ["Papaya", "bowl", 150, 65, 0.7, 16, 0.4],
  ],
  "Drinks & dairy": [
    ["Tea with milk & sugar", "cup", 150, 80, 2, 11, 2.5],
    ["Coffee with milk & sugar", "cup", 150, 80, 2, 11, 2.5],
    ["Milk (toned)", "glass", 250, 145, 8, 12, 7.5],
    ["Curd / thairu", "bowl", 100, 65, 3.5, 5, 3.5],
    ["Buttermilk / sambharam", "glass", 250, 40, 2, 3, 2],
    ["Whey protein", "scoop", 30, 120, 24, 3, 1.5],
  ],
};

export const FOOD_GROUPS = Object.entries(RAW).map(([group, rows]) => ({
  group,
  foods: rows.map(([name, unit, grams, kcal, p, c, f]) => ({
    id: `${group}:${name}`, name, unit, grams, kcal, p, c, f,
  })),
}));

export const ALL_FOODS = FOOD_GROUPS.flatMap((g) => g.foods);

// Build a meal item (same shape as the AI's items) for `qty` portions of a food
export function portionItem(food, qty) {
  const q = Number(qty) || 1;
  const r1 = (v) => Math.round(v * 10) / 10;
  const label = q === 1 ? `1 ${food.unit}` : `${q} ${food.unit}${/^\d/.test(food.unit) || food.unit.endsWith("s") ? "" : "s"}`;
  return {
    name: `${food.name} (${label})`,
    grams: Math.round(food.grams * q),
    calories: Math.round(food.kcal * q),
    protein_g: r1(food.p * q),
    carbs_g: r1(food.c * q),
    fat_g: r1(food.f * q),
  };
}
