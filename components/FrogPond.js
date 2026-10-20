"use client";
// The animated pond scene. health: 0 → 1 (today's water ÷ goal).
// The more you drink, the cleaner the lake and the happier the frog.

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export default function FrogPond({ health = 0, dead = false, night = false, grave = false }) {
  const h = Math.max(0, Math.min(1, health));
  const dirt = dead ? 1 : 1 - h;
  const skyTop = night ? "#0b1026" : mix("#3d3523", "#38bdf8", h);
  const skyBot = night ? mix("#2a2340", "#3b2f6b", h) : mix("#7d6d45", "#c7f0ff", h);
  const lakeTop = mix("#59592a", "#22c3ee", h);
  const lakeBot = mix("#2f2f14", "#0369a1", h);
  const grass = mix("#55502c", "#22c55e", h);
  const grassDark = mix("#3b381e", "#15803d", h);
  const skin = dead ? "#8d9187" : mix("#9a9a62", "#4ade80", h);
  const skinDark = dead ? "#6b6f66" : mix("#6f7045", "#16a34a", h);
  const belly = dead ? "#c9cbc4" : mix("#cfcf9a", "#d9f99d", h);
  const mood = dead ? "dead" : h >= 1 ? "party" : h >= 0.6 ? "happy" : h >= 0.3 ? "meh" : "sad";
  const bob = dead ? 0 : 1.6 + (1 - h) * 2.4;

  return (
    <div className="fp-wrap">
      <style>{CSS}</style>
      <svg viewBox="0 0 400 270" className="fp" role="img" aria-label={`Frog pond, ${Math.round(h * 100)}% of today's water goal`}>
        <defs>
          <linearGradient id="fpSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} /><stop offset="1" stopColor={skyBot} />
          </linearGradient>
          <linearGradient id="fpLake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lakeTop} /><stop offset="1" stopColor={lakeBot} />
          </linearGradient>
          <radialGradient id="fpSun"><stop offset="0" stopColor="#fff7c2" /><stop offset=".55" stopColor="#fde047" /><stop offset="1" stopColor="#fde047" stopOpacity="0" /></radialGradient>
          <radialGradient id="fpGlow"><stop offset="0" stopColor="#c6ff3d" stopOpacity=".55" /><stop offset="1" stopColor="#c6ff3d" stopOpacity="0" /></radialGradient>
        </defs>

        {/* sky */}
        <rect width="400" height="270" fill="url(#fpSky)" />
        {night ? (
          <g>
            {[[40, 30], [90, 60], [150, 25], [250, 45], [300, 20], [360, 70], [200, 70], [120, 95]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.8} fill="#fff" className="fp-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
            ))}
            <circle cx="335" cy="48" r="20" fill="#f5f3c7" />
            <circle cx="345" cy="42" r="18" fill={skyTop} />
          </g>
        ) : (
          <g opacity={0.35 + 0.65 * h}>
            <circle cx="335" cy="50" r="46" fill="url(#fpSun)" className="fp-pulse" />
            <circle cx="335" cy="50" r="18" fill="#fde047" />
          </g>
        )}
        {/* smog clouds when dirty */}
        <g opacity={dirt * 0.8} className="fp-drift">
          <ellipse cx="90" cy="55" rx="60" ry="14" fill="#6b6142" />
          <ellipse cx="230" cy="40" rx="70" ry="12" fill="#5d5538" />
        </g>
        {/* nice clouds when clean */}
        {!night && (
          <g opacity={h * 0.9} className="fp-drift">
            <ellipse cx="80" cy="50" rx="34" ry="11" fill="#fff" /><ellipse cx="100" cy="43" rx="22" ry="12" fill="#fff" />
            <ellipse cx="220" cy="35" rx="30" ry="9" fill="#fff" /><ellipse cx="238" cy="29" rx="18" ry="10" fill="#fff" />
          </g>
        )}

        {/* hills */}
        <path d="M0 150 Q 70 105 150 140 T 300 128 T 400 140 V 175 H 0 Z" fill={grassDark} />
        <path d="M0 165 Q 90 135 200 160 T 400 155 V 185 H 0 Z" fill={grass} />

        {/* lake */}
        <ellipse cx="200" cy="208" rx="198" ry="58" fill="url(#fpLake)" />
        <ellipse cx="140" cy="190" rx="70" ry="6" fill="#fff" opacity={h * 0.25} className="fp-shine" />
        <ellipse cx="280" cy="222" rx="50" ry="4" fill="#fff" opacity={h * 0.18} className="fp-shine" style={{ animationDelay: "1.5s" }} />
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="200" cy="212" rx="40" ry="9" fill="none" stroke="#fff" strokeOpacity={0.15 + h * 0.3}
            strokeWidth="1.5" className="fp-ripple" style={{ animationDelay: `${i * 1.3}s` }} />
        ))}

        {/* pollution */}
        <g opacity={Math.min(1, dirt * 1.3)}>
          <ellipse cx="95" cy="225" rx="40" ry="8" fill="#1f1d10" opacity=".55" />
          <ellipse cx="320" cy="200" rx="28" ry="6" fill="#26240f" opacity=".6" />
          <g className="fp-float"><rect x="70" y="212" width="16" height="9" rx="2" fill="#b91c1c" transform="rotate(-20 78 216)" /><rect x="72" y="214" width="4" height="5" fill="#e5e7eb" transform="rotate(-20 78 216)" /></g>
          <g className="fp-float" style={{ animationDelay: "1s" }}><rect x="300" y="226" width="26" height="8" rx="4" fill="#93c5fd" opacity=".8" /><rect x="324" y="228" width="6" height="4" fill="#1d4ed8" /></g>
          <ellipse cx="350" cy="214" rx="14" ry="5" fill="none" stroke="#111" strokeWidth="5" className="fp-float" />
          {[[60, 200], [140, 236], [260, 240], [330, 190]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill="#4d5a1a" opacity=".8" />
          ))}
          {dirt > 0.5 && [[78, 196], [92, 190], [340, 200], [352, 194]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.8" fill="#111" className="fp-fly" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </g>

        {/* reeds */}
        {[[18, 175], [30, 170], [372, 172], [385, 168]].map(([x, y], i) => (
          <g key={i} className="fp-sway" style={{ animationDelay: `${i * 0.5}s`, transformOrigin: `${x}px 200px` }}>
            <path d={`M${x} 200 Q ${x - 3} ${y + 10} ${x + 2} ${y - 30}`} stroke={grassDark} strokeWidth="3" fill="none" />
            <ellipse cx={x + 2} cy={y - 26} rx="3" ry="9" fill={mix("#4a3a1c", "#92400e", h)} />
          </g>
        ))}

        {/* lily pads + flowers */}
        <path d="M95 240 a26 9 0 1 0 1 -1 l -12 6 z" fill={grassDark} />
        <path d="M305 245 a22 8 0 1 0 1 -1 l -10 5 z" fill={grassDark} />
        <path d="M70 200 a16 6 0 1 0 1 -1 l -8 4 z" fill={grassDark} />
        <g opacity={Math.max(0, (h - 0.5) * 2)} className="fp-bloom">
          <Lotus x={110} y={236} /><Lotus x={315} y={241} /><Lotus x={78} y={198} s={0.7} />
        </g>

        {/* jumping fish when goal hit */}
        {h >= 1 && !dead && (
          <g className="fp-fish"><path d="M0 0 q 10 -8 20 0 q -10 8 -20 0 z M20 0 l 7 -5 v 10 z" fill="#fb923c" /></g>
        )}

        {/* gravestone for yesterday's frog */}
        {grave && (
          <g transform="translate(345 150)">
            <path d="M-11 22 V 2 a11 11 0 0 1 22 0 V 22 z" fill="#9ca3af" stroke="#4b5563" strokeWidth="1.5" />
            <text x="0" y="12" textAnchor="middle" fontSize="7" fontWeight="800" fill="#374151">RIP</text>
          </g>
        )}

        {/* the frog on its lily pad */}
        <ellipse cx="200" cy="214" rx="54" ry="13" fill={grassDark} />
        <ellipse cx="200" cy="212" rx="50" ry="11" fill={grass} />
        {h >= 1 && !dead && <circle cx="200" cy="185" r="70" fill="url(#fpGlow)" className="fp-pulse" />}
        <g className={dead ? "fp-deadfloat" : "fp-bob"} style={{ "--bob": `${bob}s` }}>
          <g transform={dead ? "rotate(180 200 192)" : undefined}>
            <Frog skin={skin} dark={skinDark} belly={belly} mood={mood} />
          </g>
        </g>
        {dead && (
          <g className="fp-ghost"><path d="M200 120 q -12 0 -12 14 v 14 l 4 -4 4 4 4 -4 4 4 4 -4 4 4 v -14 q 0 -14 -12 -14 z" fill="#fff" opacity=".85" />
            <circle cx="195" cy="133" r="2" fill="#111" /><circle cx="205" cy="133" r="2" fill="#111" /></g>
        )}
        {h >= 1 && !dead && [[150, 150], [255, 140], [180, 120], [230, 168]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 6} L${x + 1.5} ${y - 1.5} L${x + 6} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 6} L${x - 1.5} ${y + 1.5} L${x - 6} ${y} L${x - 1.5} ${y - 1.5} Z`}
            fill="#fef08a" className="fp-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </svg>
    </div>
  );
}

function Lotus({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-30, 0, 30].map((r) => <ellipse key={r} cx="0" cy="-7" rx="4" ry="9" fill="#f9a8d4" transform={`rotate(${r} 0 0)`} />)}
      <circle cx="0" cy="-3" r="2.5" fill="#fde047" />
    </g>
  );
}

function Frog({ skin, dark, belly, mood }) {
  const eyeLid = mood === "sad" ? 8 : mood === "meh" ? 4 : 0;
  return (
    <g>
      {/* back legs */}
      <ellipse cx="172" cy="204" rx="16" ry="8" fill={dark} />
      <ellipse cx="228" cy="204" rx="16" ry="8" fill={dark} />
      {/* body */}
      <ellipse cx="200" cy="190" rx="34" ry="24" fill={skin} />
      <ellipse cx="200" cy="198" rx="22" ry="14" fill={belly} className={mood === "dead" ? "" : "fp-breathe"} />
      {/* spots */}
      <circle cx="182" cy="182" r="3" fill={dark} opacity=".6" /><circle cx="218" cy="180" r="2.5" fill={dark} opacity=".6" />
      {/* front feet */}
      <ellipse cx="180" cy="210" rx="7" ry="4" fill={dark} /><ellipse cx="220" cy="210" rx="7" ry="4" fill={dark} />
      {/* eyes */}
      {[184, 216].map((ex) => (
        <g key={ex}>
          <circle cx={ex} cy="168" r="11" fill={skin} />
          <circle cx={ex} cy="167" r="8" fill="#fff" />
          {mood === "dead" ? (
            <path d={`M${ex - 4} 163 l8 8 M${ex + 4} 163 l-8 8`} stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          ) : (
            <>
              <circle cx={ex + 1} cy={mood === "sad" ? 170 : 167} r="4" fill="#111" className="fp-blink" />
              <circle cx={ex + 2.5} cy={mood === "sad" ? 168.5 : 165.5} r="1.3" fill="#fff" />
              {eyeLid > 0 && (
                <g>
                  <clipPath id={`fpEye${ex}`}><circle cx={ex} cy="167" r="8.2" /></clipPath>
                  <rect x={ex - 9} y="158" width="18" height={eyeLid} fill={skin} clipPath={`url(#fpEye${ex})`} />
                  <path d={`M${ex - 7} ${158 + eyeLid} h14`} stroke={dark} strokeWidth="1.5" strokeLinecap="round" />
                </g>
              )}
            </>
          )}
        </g>
      ))}
      {/* cheeks */}
      {(mood === "happy" || mood === "party") && <><ellipse cx="174" cy="190" rx="5" ry="3" fill="#f472b6" opacity=".55" /><ellipse cx="226" cy="190" rx="5" ry="3" fill="#f472b6" opacity=".55" /></>}
      {/* mouth */}
      {mood === "party" && <path d="M184 186 q16 16 32 0 q-16 6 -32 0 z" fill="#7f1d1d" stroke="#14532d" strokeWidth="1.5" />}
      {mood === "happy" && <path d="M186 186 q14 10 28 0" stroke="#14532d" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {mood === "meh" && <path d="M190 189 h20" stroke="#3f3f1f" strokeWidth="2.2" strokeLinecap="round" />}
      {mood === "sad" && <><path d="M188 192 q12 -8 24 0" stroke="#3f3f1f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M229 160 q4 6 0 9 q-4 -3 0 -9 z" fill="#7dd3fc" className="fp-drip" /></>}
      {mood === "dead" && <><path d="M190 188 h20" stroke="#333" strokeWidth="2" strokeLinecap="round" /><ellipse cx="204" cy="193" rx="4" ry="5" fill="#f472b6" /></>}
      {/* party crown */}
      {mood === "party" && <path d="M188 156 l4 -12 l8 8 l8 -8 l4 12 z" fill="#facc15" stroke="#a16207" strokeWidth="1" />}
    </g>
  );
}

const CSS = `
.fp-wrap { border-radius: 20px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 20px 50px -25px rgba(46,242,196,.45); }
.fp { display: block; width: 100%; height: auto; }
.fp * { transition: fill 1.2s ease, opacity 1.2s ease; }
.fp-bob { animation: fpBob var(--bob) ease-in-out infinite; }
@keyframes fpBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
.fp-breathe { transform-box: fill-box; transform-origin: center; animation: fpBreathe 2.2s ease-in-out infinite; }
@keyframes fpBreathe { 50% { transform: scale(1.08, 1.12) } }
.fp-blink { transform-box: fill-box; transform-origin: center; animation: fpBlink 4.5s infinite; }
@keyframes fpBlink { 0%,94%,100% { transform: scaleY(1) } 97% { transform: scaleY(.1) } }
.fp-ripple { transform-box: fill-box; transform-origin: center; animation: fpRipple 4s ease-out infinite; }
@keyframes fpRipple { from { transform: scale(.9); opacity: .9 } to { transform: scale(3.2); opacity: 0 } }
.fp-float { animation: fpFloat 5s ease-in-out infinite; }
@keyframes fpFloat { 50% { transform: translate(4px, 2px) } }
.fp-drift { animation: fpDrift 18s ease-in-out infinite; }
@keyframes fpDrift { 50% { transform: translateX(18px) } }
.fp-sway { animation: fpSway 3.5s ease-in-out infinite; }
@keyframes fpSway { 50% { transform: rotate(4deg) } }
.fp-shine { animation: fpShine 3s ease-in-out infinite; }
@keyframes fpShine { 50% { opacity: .05 } }
.fp-twinkle { transform-box: fill-box; transform-origin: center; animation: fpTwinkle 2s ease-in-out infinite; }
@keyframes fpTwinkle { 50% { opacity: .2; transform: scale(.6) } }
.fp-pulse { transform-box: fill-box; transform-origin: center; animation: fpPulse 3s ease-in-out infinite; }
@keyframes fpPulse { 50% { transform: scale(1.12); opacity: .8 } }
.fp-bloom { transform-box: fill-box; transform-origin: bottom; animation: fpSway 4s ease-in-out infinite; }
.fp-fly { animation: fpFly .9s linear infinite; }
@keyframes fpFly { 25% { transform: translate(5px, -4px) } 50% { transform: translate(9px, 1px) } 75% { transform: translate(3px, 4px) } }
.fp-fish { animation: fpFish 3.2s ease-in-out infinite; }
@keyframes fpFish { 0%,55% { transform: translate(250px, 240px) rotate(0); opacity: 0 }
  60% { opacity: 1 } 75% { transform: translate(285px, 196px) rotate(40deg) } 90% { transform: translate(318px, 236px) rotate(110deg); opacity: 1 } 100% { opacity: 0; transform: translate(320px, 245px) rotate(120deg) } }
.fp-drip { animation: fpDrip 2s ease-in infinite; }
@keyframes fpDrip { from { transform: translateY(0); opacity: 1 } to { transform: translateY(14px); opacity: 0 } }
.fp-deadfloat { animation: fpDead 4s ease-in-out infinite; }
@keyframes fpDead { 50% { transform: translateY(3px) rotate(2deg) } }
.fp-ghost { animation: fpGhost 3.5s ease-in-out infinite; }
@keyframes fpGhost { 0% { transform: translateY(10px); opacity: 0 } 30% { opacity: .9 } 100% { transform: translateY(-30px); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .fp * { animation: none !important; } }
`;
