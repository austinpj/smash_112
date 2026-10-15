-- Smash database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then press "Run".
-- Safe to run once on a new project.

create extension if not exists pgcrypto;

-- ───────────── Profiles (one per user) ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  sex text check (sex in ('male','female')),
  birth_year int check (birth_year between 1900 and 2100),
  height_cm numeric check (height_cm > 0 and height_cm < 300),
  activity_level text default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text default 'maintain' check (goal in ('lose','maintain','gain')),
  created_at timestamptz default now()
);

-- Create a profile row automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ───────────── Body weight log ─────────────
create table public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  body_fat_pct numeric check (body_fat_pct >= 0 and body_fat_pct <= 100),
  waist_cm numeric,
  notes text,
  created_at timestamptz default now()
);
create index on public.body_logs (user_id, logged_on desc);

-- ───────────── Exercise library ─────────────
-- user_id NULL = built-in exercise everyone sees; otherwise a user's own custom exercise.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text,
  category text not null default 'strength' check (category in ('strength','bodyweight','cardio')),
  met numeric default 5,
  created_at timestamptz default now()
);
create index on public.exercises (muscle_group);

-- ───────────── Workouts and sets ─────────────
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_on date not null default current_date,
  title text,
  notes text,
  duration_min int,
  created_at timestamptz default now()
);
create index on public.workouts (user_id, performed_on desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null default 1,
  reps int check (reps >= 0),
  weight_kg numeric check (weight_kg >= 0),
  duration_sec int check (duration_sec >= 0),
  distance_km numeric check (distance_km >= 0),
  created_at timestamptz default now()
);
create index on public.workout_sets (user_id, exercise_id);
create index on public.workout_sets (workout_id);

-- ───────────── Food log ─────────────
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_on date not null default current_date,
  meal_type text default 'other' check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  description text not null,
  calories numeric not null default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  items jsonb,
  source text default 'manual' check (source in ('manual','ai')),
  created_at timestamptz default now()
);
create index on public.food_logs (user_id, eaten_on desc);

-- ───────────── Row Level Security: each user only sees their own data ─────────────
alter table public.profiles     enable row level security;
alter table public.body_logs    enable row level security;
alter table public.exercises    enable row level security;
alter table public.workouts     enable row level security;
alter table public.workout_sets enable row level security;
alter table public.food_logs    enable row level security;

create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own body logs" on public.body_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see built-in and own exercises" on public.exercises for select
  using (user_id is null or user_id = auth.uid());
create policy "add own exercises" on public.exercises for insert with check (user_id = auth.uid());
create policy "edit own exercises" on public.exercises for update using (user_id = auth.uid());
create policy "delete own exercises" on public.exercises for delete using (user_id = auth.uid());

create policy "own workouts" on public.workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own sets" on public.workout_sets for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "own food" on public.food_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── Built-in exercise library ─────────────
-- MET values are approximate (Compendium of Physical Activities) and are used for calorie-burn estimates.
insert into public.exercises (name, muscle_group, equipment, category, met) values
-- Chest
('Barbell Bench Press','Chest','Barbell','strength',6),
('Incline Barbell Bench Press','Chest','Barbell','strength',6),
('Decline Barbell Bench Press','Chest','Barbell','strength',6),
('Dumbbell Bench Press','Chest','Dumbbell','strength',6),
('Incline Dumbbell Press','Chest','Dumbbell','strength',6),
('Dumbbell Fly','Chest','Dumbbell','strength',5),
('Cable Crossover','Chest','Cable','strength',5),
('Pec Deck / Machine Fly','Chest','Machine','strength',5),
('Machine Chest Press','Chest','Machine','strength',5),
('Push-up','Chest','Bodyweight','bodyweight',8),
('Chest Dip','Chest','Bodyweight','bodyweight',8),
-- Back
('Deadlift','Back','Barbell','strength',6),
('Barbell Row','Back','Barbell','strength',6),
('Pendlay Row','Back','Barbell','strength',6),
('T-Bar Row','Back','Barbell','strength',6),
('One-Arm Dumbbell Row','Back','Dumbbell','strength',5),
('Lat Pulldown','Back','Cable','strength',5),
('Close-Grip Lat Pulldown','Back','Cable','strength',5),
('Seated Cable Row','Back','Cable','strength',5),
('Straight-Arm Pulldown','Back','Cable','strength',5),
('Pull-up','Back','Bodyweight','bodyweight',8),
('Chin-up','Back','Bodyweight','bodyweight',8),
('Assisted Pull-up Machine','Back','Machine','strength',5),
('Back Extension / Hyperextension','Back','Bodyweight','bodyweight',4),
('Rack Pull','Back','Barbell','strength',6),
-- Shoulders
('Overhead Press (Barbell)','Shoulders','Barbell','strength',6),
('Seated Dumbbell Shoulder Press','Shoulders','Dumbbell','strength',5),
('Arnold Press','Shoulders','Dumbbell','strength',5),
('Machine Shoulder Press','Shoulders','Machine','strength',5),
('Lateral Raise','Shoulders','Dumbbell','strength',4),
('Cable Lateral Raise','Shoulders','Cable','strength',4),
('Front Raise','Shoulders','Dumbbell','strength',4),
('Rear Delt Fly','Shoulders','Dumbbell','strength',4),
('Face Pull','Shoulders','Cable','strength',4),
('Upright Row','Shoulders','Barbell','strength',5),
('Barbell Shrug','Shoulders','Barbell','strength',4),
('Dumbbell Shrug','Shoulders','Dumbbell','strength',4),
-- Arms
('Barbell Curl','Biceps','Barbell','strength',4),
('EZ-Bar Curl','Biceps','Barbell','strength',4),
('Dumbbell Curl','Biceps','Dumbbell','strength',4),
('Hammer Curl','Biceps','Dumbbell','strength',4),
('Incline Dumbbell Curl','Biceps','Dumbbell','strength',4),
('Preacher Curl','Biceps','Machine','strength',4),
('Cable Curl','Biceps','Cable','strength',4),
('Concentration Curl','Biceps','Dumbbell','strength',4),
('Triceps Pushdown','Triceps','Cable','strength',4),
('Rope Pushdown','Triceps','Cable','strength',4),
('Overhead Triceps Extension','Triceps','Dumbbell','strength',4),
('Skull Crusher','Triceps','Barbell','strength',4),
('Close-Grip Bench Press','Triceps','Barbell','strength',6),
('Triceps Dip','Triceps','Bodyweight','bodyweight',8),
('Bench Dip','Triceps','Bodyweight','bodyweight',5),
('Triceps Kickback','Triceps','Dumbbell','strength',4),
('Wrist Curl','Forearms','Dumbbell','strength',3),
('Farmer''s Walk','Forearms','Dumbbell','strength',6),
-- Legs
('Back Squat','Legs','Barbell','strength',6),
('Front Squat','Legs','Barbell','strength',6),
('Goblet Squat','Legs','Dumbbell','strength',5),
('Hack Squat','Legs','Machine','strength',6),
('Leg Press','Legs','Machine','strength',6),
('Bulgarian Split Squat','Legs','Dumbbell','strength',6),
('Walking Lunge','Legs','Dumbbell','strength',6),
('Reverse Lunge','Legs','Dumbbell','strength',6),
('Step-up','Legs','Dumbbell','strength',6),
('Romanian Deadlift','Hamstrings','Barbell','strength',6),
('Dumbbell Romanian Deadlift','Hamstrings','Dumbbell','strength',5),
('Lying Leg Curl','Hamstrings','Machine','strength',4),
('Seated Leg Curl','Hamstrings','Machine','strength',4),
('Leg Extension','Quads','Machine','strength',4),
('Hip Thrust','Glutes','Barbell','strength',5),
('Glute Bridge','Glutes','Bodyweight','bodyweight',4),
('Cable Kickback','Glutes','Cable','strength',4),
('Hip Abduction Machine','Glutes','Machine','strength',4),
('Hip Adduction Machine','Legs','Machine','strength',4),
('Standing Calf Raise','Calves','Machine','strength',4),
('Seated Calf Raise','Calves','Machine','strength',4),
('Bodyweight Squat','Legs','Bodyweight','bodyweight',5),
-- Core
('Plank','Core','Bodyweight','bodyweight',4),
('Side Plank','Core','Bodyweight','bodyweight',4),
('Crunch','Core','Bodyweight','bodyweight',4),
('Hanging Leg Raise','Core','Bodyweight','bodyweight',4),
('Lying Leg Raise','Core','Bodyweight','bodyweight',4),
('Cable Crunch','Core','Cable','strength',4),
('Russian Twist','Core','Bodyweight','bodyweight',4),
('Ab Wheel Rollout','Core','Other','bodyweight',5),
('Mountain Climber','Core','Bodyweight','bodyweight',8),
('Dead Bug','Core','Bodyweight','bodyweight',3),
-- Full body
('Kettlebell Swing','Full body','Kettlebell','strength',9),
('Clean and Press','Full body','Barbell','strength',8),
('Burpee','Full body','Bodyweight','bodyweight',8),
('Battle Ropes','Full body','Other','cardio',10),
-- Cardio
('Treadmill Walk','Cardio','Machine','cardio',4),
('Treadmill Run','Cardio','Machine','cardio',9),
('Outdoor Walk','Cardio','None','cardio',3.5),
('Outdoor Run','Cardio','None','cardio',9),
('Stationary Bike','Cardio','Machine','cardio',7),
('Cycling (outdoor)','Cardio','None','cardio',7.5),
('Elliptical','Cardio','Machine','cardio',5),
('Rowing Machine','Cardio','Machine','cardio',7),
('Stair Climber','Cardio','Machine','cardio',9),
('Jump Rope','Cardio','Other','cardio',11),
('Swimming','Cardio','None','cardio',7),
('Yoga','Flexibility','None','cardio',2.5),
('Stretching','Flexibility','None','cardio',2.3);
