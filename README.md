# Smash

A personal fitness tracker anyone can sign up for. Each person's data is private to their account.

**Features**
- Email + password accounts (Supabase Auth)
- 104 built-in gym exercises grouped by muscle, plus your own custom ones
- Log workouts: pick exercise → sets, reps, weight (or minutes/km for cardio); shows what you did last time
- Calculations: volume, estimated 1-rep max (Epley), personal records, calories burned (MET), BMI, BMR (Mifflin–St Jeor), maintenance calories (TDEE), daily calorie & protein targets
- Progress charts per exercise and body-weight trend
- Food log with **photo → AI calorie estimate** (Google Gemini, free tier) that you can edit before saving

**Stack:** Next.js (GitHub → Vercel) + Supabase (database + login) + Gemini (food photos)

---

## Setup — about 20 minutes, no coding

### 1. Supabase (database + logins)
1. Go to supabase.com → **New project**. Pick region **Mumbai (ap-south-1)**. Save the database password somewhere.
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, press **Run**. You should see "Success".
3. Open **Project Settings → API** (or **Connect**) and copy:
   - Project URL → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Never use the `service_role` / secret key here.)

### 2. Gemini key (for food photos — free)
1. Go to https://aistudio.google.com/apikey → **Create API key**.
2. Copy it → this is `GEMINI_API_KEY`.

### 3. GitHub (stores the code)
1. github.com → **New repository** → name it `smash` → Private → Create.
2. On the empty repo page click **uploading an existing file**.
3. Unzip `smash.zip` on your computer, open the `smash` folder, select **everything inside it** and drag it into the browser. Click **Commit changes**.

### 4. Vercel (puts it online)
1. vercel.com → **Add New → Project** → import the `smash` repo.
2. Before clicking Deploy, open **Environment Variables** and add the three values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`
3. Click **Deploy**. After ~2 minutes you get a link like `smash-xxxx.vercel.app`.

### 5. Tell Supabase your website address
Supabase → **Authentication → URL Configuration**:
- **Site URL:** your Vercel link (e.g. `https://smash-xxxx.vercel.app`)
- **Redirect URLs:** add `https://smash-xxxx.vercel.app/auth/callback`

Now open your link, create an account, confirm the email, and fill in your Profile first.

> Tip: while testing, you can turn off email confirmation at Authentication → Sign In / Providers → Email → "Confirm email". Turn it back on before sharing.

---

## Making changes later
Edit a file on GitHub (pencil icon) → Commit. Vercel redeploys automatically in a minute or two.

## Running on your own computer (optional)
Requires Node.js 20+.
```
cp .env.example .env.local   # then fill in the 3 values
npm install
npm run dev                  # open http://localhost:3000
```

## Where things are
| What | File |
|---|---|
| Database tables, security rules, exercise list | `supabase/schema.sql` |
| All formulas (1RM, BMR, TDEE, BMI, calories) | `lib/calc.js` |
| Food photo AI | `app/api/food/analyze/route.js` |
| Pages | `app/…/page.js` (workouts, progress, food, exercises, profile) |

## Notes
- BMI categories use the Asian cut-offs (23 / 25).
- Calorie burn and AI food numbers are estimates.
- Gemini's free tier has daily limits; if many people use it, add billing in Google AI Studio or swap the model with `GEMINI_MODEL`.
