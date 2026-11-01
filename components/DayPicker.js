"use client";
// Pick which day you're logging for: Today / Yesterday / 2 days ago, or any older date.
// Lets you fill in steps or water you forgot to add.

export const isoDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
export const dayLabel = (iso) => {
  if (iso === daysAgo(0)) return "today";
  if (iso === daysAgo(1)) return "yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
};

export default function DayPicker({ value, onChange, maxBack = 30, label = "Logging for" }) {
  const quick = [[0, "Today"], [1, "Yesterday"], [2, "2 days ago"]];
  const isQuick = quick.some(([n]) => daysAgo(n) === value);
  return (
    <div className="day-picker">
      <style>{CSS}</style>
      <span className="muted small">{label}</span>
      <div className="dp-row">
        {quick.map(([n, t]) => (
          <button key={n} type="button" className={"dp-chip" + (daysAgo(n) === value ? " on" : "")} onClick={() => onChange(daysAgo(n))}>{t}</button>
        ))}
        <input type="date" className={"dp-date" + (!isQuick ? " on" : "")} value={value} max={daysAgo(0)} min={daysAgo(maxBack)}
          onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Pick another date" />
      </div>
      {value !== daysAgo(0) && <p className="dp-note">✏️ You're adding to <b>{dayLabel(value)}</b>, not today.</p>}
    </div>
  );
}

const CSS = `
.day-picker { margin: 10px 0 12px; }
.dp-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.dp-chip { padding: 7px 12px; border-radius: 99px; border: 1px solid var(--line); background: rgba(255,255,255,.04);
  color: var(--text); font: inherit; font-size: .82rem; font-weight: 650; cursor: pointer; transition: background .2s, border-color .2s; }
.dp-chip.on { background: var(--accent); border-color: var(--accent); color: #07080c; }
.dp-date { width: auto !important; padding: 6px 10px !important; font-size: .82rem; border-radius: 99px !important; }
.dp-date.on { border-color: var(--accent) !important; }
.dp-note { margin: 6px 0 0; font-size: .8rem; color: #facc15; }
`;
