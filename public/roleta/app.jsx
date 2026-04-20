/* global React, ReactDOM */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ===================== PRIZES =====================
// Loaded from prizes-store.js (shared with admin.html)
const PRIZES = (window.loadPrizes ? window.loadPrizes() : []).filter(p => p.enabled !== false);

// Weighted random pick (house-favoring distribution)
function pickPrizeIndex() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

// ===================== STORAGE =====================
const STORAGE_KEY = "lepoa-roleta-v1";
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveState(patch) {
  const cur = loadState();
  const next = { ...cur, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function msUntilMidnight() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end - now;
}
function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

// ===================== WHATSAPP =====================
function formatWhats(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}
function isValidWhats(raw) {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 11;
}

// ===================== ORNAMENT SVGs =====================
const SprigOrnament = () => (
  <svg width="54" height="18" viewBox="0 0 54 18" fill="none" aria-hidden="true">
    <path d="M3 9 H22" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <path d="M32 9 H51" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <circle cx="27" cy="9" r="2.5" stroke="currentColor" strokeWidth="1" fill="none"/>
    <circle cx="27" cy="9" r="0.8" fill="currentColor"/>
  </svg>
);

const Pointer = () => (
  <svg className="wheel-pointer" width="36" height="50" viewBox="0 0 36 50" aria-hidden="true">
    <defs>
      <linearGradient id="ptrGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#f3e5c6"/>
        <stop offset="45%" stopColor="#c9a05a"/>
        <stop offset="100%" stopColor="#95753a"/>
      </linearGradient>
    </defs>
    <path d="M18 48 L2 8 A16 16 0 0 1 34 8 Z" fill="url(#ptrGrad)" stroke="#2b3220" strokeWidth="1.2"/>
    <circle cx="18" cy="14" r="4" fill="#2b3220"/>
    <circle cx="18" cy="14" r="1.6" fill="#e6ca9a"/>
  </svg>
);

// ===================== WHEEL =====================
function Wheel({ rotation, segments, size = 380 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 2;
  const rLabel = r * 0.62;
  const n = segments.length;
  const segAngle = 360 / n;

  // Segment path generator
  const arc = (i) => {
    const startA = -90 - segAngle / 2 + i * segAngle; // segment 0 centered at top
    const endA   = startA + segAngle;
    const sx = cx + r * Math.cos((startA * Math.PI) / 180);
    const sy = cy + r * Math.sin((startA * Math.PI) / 180);
    const ex = cx + r * Math.cos((endA * Math.PI) / 180);
    const ey = cy + r * Math.sin((endA * Math.PI) / 180);
    const large = segAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
  };

  return (
    <svg
      className="wheel-svg"
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <defs>
        {segments.map((s, i) => (
          <radialGradient id={`grad-${i}`} key={i} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.95"/>
            <stop offset="100%" stopColor={s.color} stopOpacity="1"/>
          </radialGradient>
        ))}
      </defs>

      {segments.map((s, i) => {
        const midA = -90 + i * segAngle; // center angle of this segment (degrees)
        // Radial label: place text along the radius, reading from center outward.
        // Anchor at outer end, rotate so baseline runs along the radius.
        const rOuter = r * 0.92;
        const lx = cx + rOuter * Math.cos((midA * Math.PI) / 180);
        const ly = cy + rOuter * Math.sin((midA * Math.PI) / 180);
        // Rotate so text reads from outer edge toward center.
        // On the right half (cos(midA) >= 0 in standard math, but our SVG y is flipped)
        // we rotate text so it reads inward; on the left half, flip it 180° so it isn't upside-down.
        const baseRot = midA; // aligns text x-axis with radius pointing outward
        // Flip text on the bottom half so it's not upside down when read.
        const flip = (midA > 0 && midA < 180);
        const textRot = flip ? baseRot + 180 : baseRot;
        const anchor = flip ? "start" : "end";
        return (
          <g key={s.id}>
            <path d={arc(i)} fill={`url(#grad-${i})`} stroke="rgba(43,50,32,0.35)" strokeWidth="0.8"/>
            <g transform={`translate(${lx} ${ly}) rotate(${textRot})`}>
              <text
                textAnchor={anchor}
                dominantBaseline="middle"
                x={flip ? 12 : -12}
                y="-6"
                fill={s.text}
                style={{
                  fontFamily: "Fraunces, Didot, serif",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.02em"
                }}
              >{s.label}</text>
              <text
                textAnchor={anchor}
                dominantBaseline="middle"
                x={flip ? 12 : -12}
                y="8"
                fill={s.text}
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 7.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  opacity: 0.85
                }}
              >{s.sub}</text>
            </g>
            {/* gold divider dot at each boundary */}
            <circle
              cx={cx + (r - 6) * Math.cos(((-90 - segAngle/2 + i*segAngle) * Math.PI) / 180)}
              cy={cy + (r - 6) * Math.sin(((-90 - segAngle/2 + i*segAngle) * Math.PI) / 180)}
              r="2.2"
              fill="#e6ca9a"
              stroke="#95753a"
              strokeWidth="0.5"
            />
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(149,117,58,0.5)" strokeWidth="1.2"/>
    </svg>
  );
}

// ===================== CONFETTI =====================
function Confetti({ count = 90 }) {
  const pieces = useMemo(() => {
    const colors = ["#c9a05a", "#b08a44", "#d9b1aa", "#b68680", "#6f7a4f", "#8a9468", "#f3e5c6"];
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 300,
      delay: Math.random() * 0.6,
      dur: 2.4 + Math.random() * 2.2,
      color: colors[i % colors.length],
      w: 5 + Math.random() * 7,
      h: 9 + Math.random() * 12,
      rot: Math.random() * 360,
      rounded: Math.random() > 0.7,
    }));
  }, [count]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.w, height: p.h,
            background: p.color,
            borderRadius: p.rounded ? "50%" : "1px",
            transform: `rotate(${p.rot}deg)`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            "--dx": `${p.dx}px`,
          }}
        />
      ))}
    </div>
  );
}

// ===================== INTRO SCREEN =====================
function IntroScreen({ onReady }) {
  const [name, setName] = useState("");
  const [whats, setWhats] = useState("");
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (name.trim().length < 2) errs.name = "Como devemos te chamar?";
    if (!isValidWhats(whats)) errs.whats = "WhatsApp com DDD, por favor.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveState({
      profile: { name: name.trim(), whats: whats.replace(/\D/g, ""), signupAt: Date.now() }
    });
    onReady({ name: name.trim(), whats });
  };

  return (
    <div className="screen">
      <div className="card intro">
        <div className="intro-logo">
          <img src="/roleta/assets/lepoa-logo.png" alt="Le.Poá" />
        </div>
        <div className="eyebrow">Gire &amp; ganhe</div>
        <h1 className="display">
          Sua sorte <em>costurada</em><br/>em desconto.
        </h1>
        <p className="sublead">
          Um giro por dia, um cupom à sua espera.<br/>
          Deixe seus dados para liberar a roleta.
        </p>

        <form onSubmit={submit} noValidate>
          <div className={`field ${errors.name ? "error" : ""}`}>
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              type="text"
              autoComplete="given-name"
              placeholder="Seu primeiro nome"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <div className="hint">{errors.name || ""}</div>
          </div>
          <div className={`field ${errors.whats ? "error" : ""}`}>
            <label htmlFor="whats">WhatsApp</label>
            <input
              id="whats"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(11) 98765-4321"
              value={whats}
              onChange={e => setWhats(formatWhats(e.target.value))}
            />
            <div className="hint">{errors.whats || ""}</div>
          </div>
          <button type="submit" className="btn primary">
            Liberar minha roleta <span className="arrow">→</span>
          </button>
        </form>

        <p className="legal">
          Ao continuar você aceita receber novidades da Le.Poá no WhatsApp.<br/>
          Cupom válido conforme regras de cada prêmio.
        </p>
      </div>
    </div>
  );
}

// ===================== WHEEL SCREEN =====================
function WheelScreen({ profile, onWin, lockedUntil, onReset }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [countdown, setCountdown] = useState(formatCountdown(lockedUntil ? msUntilMidnight() : 0));
  const tickTimeoutRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const ms = msUntilMidnight();
      setCountdown(formatCountdown(ms));
      if (ms <= 0) window.location.reload();
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const segAngle = 360 / PRIZES.length;

  const handleSpin = () => {
    if (spinning || lockedUntil) return;
    setSpinning(true);

    const targetIdx = pickPrizeIndex();
    // segment targetIdx is centered at -90 + targetIdx*segAngle (in SVG coords).
    // We want that center to land under the pointer (top = -90deg).
    // Rotating the wheel by R degrees, the new center angle = -90 + targetIdx*segAngle + R.
    // Set that = -90 (mod 360): R = -targetIdx*segAngle (mod 360).
    const turns = 6 + Math.floor(Math.random() * 3); // 6–8 full turns
    const jitter = (Math.random() - 0.5) * (segAngle * 0.55);
    const base = rotation; // current rotation
    // compute next rotation so that total rotation ≡ -targetIdx*segAngle + jitter (mod 360)
    const currentMod = ((base % 360) + 360) % 360;
    const desiredMod = ((-targetIdx * segAngle + jitter) % 360 + 360) % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;
    const nextRot = base + turns * 360 + delta;

    setRotation(nextRot);

    // Fake "ticks" as wheel spins past segments
    const totalDurationMs = 6000;
    const spinStart = performance.now();
    const tickOnce = () => {
      const elapsed = performance.now() - spinStart;
      if (elapsed > totalDurationMs - 150) return;
      // slow down tick rate over time
      const progress = elapsed / totalDurationMs;
      const next = 90 + progress * 620; // ms until next tick
      tickTimeoutRef.current = setTimeout(() => {
        setTicking(true);
        setTimeout(() => setTicking(false), 80);
        tickOnce();
      }, next);
    };
    tickOnce();

    setTimeout(() => {
      setSpinning(false);
      clearTimeout(tickTimeoutRef.current);
      onWin(PRIZES[targetIdx], targetIdx);
    }, totalDurationMs + 150);
  };

  useEffect(() => () => clearTimeout(tickTimeoutRef.current), []);

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="screen">
      <div className="wheel-screen">
        <div className="wheel-heading">
          <div className="name-greeting">Olá, {firstName}</div>
          <h2>Role a roleta &amp; <em>descubra</em></h2>
          <p>Você tem um giro por dia. Boa sorte.</p>
        </div>

        <div className="wheel-wrap">
          <div className="wheel-outer-ring"></div>
          <div className="wheel-inner-ring"></div>
          <Wheel rotation={rotation} segments={PRIZES} />
          <Pointer />
          <button
            className={`wheel-hub ${spinning ? "spinning" : ""}`}
            onClick={handleSpin}
            disabled={spinning || !!lockedUntil}
            aria-label="Girar roleta"
          >
            <span className="label">Girar</span>
          </button>
          {/* tick visual */}
          <svg
            className={`wheel-pointer ${ticking ? "ticking" : ""}`}
            width="36" height="50" viewBox="0 0 36 50"
            aria-hidden="true"
            style={{ display: "none" }}
          />
        </div>

        {!lockedUntil && (
          <button className="btn primary spin-cta" onClick={handleSpin} disabled={spinning}>
            {spinning ? "Girando…" : <>Girar a roleta <span className="arrow">✦</span></>}
          </button>
        )}

        {lockedUntil && (
          <div className="day-lock">
            <div className="ttl">Você já girou hoje ✦</div>
            <div>Volte amanhã para uma nova chance</div>
            <div className="countdown" style={{ marginTop: 8 }}>{countdown}</div>
            <button className="admin-reset" onClick={onReset}>
              Resetar (modo demo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== PRIZE MODAL =====================
function PrizeModal({ prize, onClose, onSpinAgain, allowReSpin }) {
  const [copied, setCopied] = useState(false);
  const isAgain = prize.code === "__AGAIN";

  const copy = () => {
    navigator.clipboard?.writeText(prize.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="prize-card" onClick={(e) => e.stopPropagation()}>
        <button className="close-x" onClick={onClose} aria-label="Fechar">×</button>
        <div className="ornament" style={{ marginBottom: 12 }}><SprigOrnament /></div>

        {isAgain ? (
          <>
            <div className="prize-eyebrow">Giro Duplo</div>
            <h3 className="prize-headline">Mais uma chance,<br/>por conta da casa.</h3>
            <p className="prize-sub">A sorte pediu passagem. Gire de novo.</p>
            <div className="prize-actions">
              <button className="btn primary" onClick={onSpinAgain}>
                Girar novamente <span className="arrow">→</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="prize-eyebrow">Parabéns</div>
            <h3 className="prize-headline">Você ganhou<br/>{prize.label.toLowerCase()}</h3>
            <p className="prize-sub">{prize.sub}. Use na próxima compra online ou na loja.</p>

            <div className="coupon">
              <div className="code">{prize.code}</div>
              <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copy}>
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
            <div className="valid">Válido por {prize.valid} · Não cumulativo</div>

            <div className="prize-actions">
              <a
                className="btn primary"
                href="https://lepoa.online/catalogo"
                target="_blank" rel="noopener noreferrer"
              >
                Aproveite agora seu cupom <span className="arrow">→</span>
              </a>
              <button className="btn ghost" onClick={onClose}>Continuar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===================== TWEAKS PANEL =====================
function TweaksPanel({ open, tweaks, setTweak, onClose }) {
  return (
    <div className={`tweaks ${open ? "open" : ""}`}>
      <h4>Tweaks <button onClick={onClose}>×</button></h4>

      <div className="tweak-row">
        <label>Paleta</label>
        <div className="seg">
          {[
            ["oliva-dourado", "Oliva"],
            ["rose-cream",    "Rosé"],
            ["noir",          "Noir"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={tweaks.theme === v ? "active" : ""}
              onClick={() => setTweak("theme", v)}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Estilo da roleta</label>
        <div className="seg">
          {[
            ["elegante",  "Elegante"],
            ["monograma", "Monograma"],
            ["colorida",  "Colorida"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={tweaks.wheelStyle === v ? "active" : ""}
              onClick={() => setTweak("wheelStyle", v)}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Confete ao ganhar</label>
        <div className="seg">
          <button className={tweaks.confetti ? "active" : ""}  onClick={() => setTweak("confetti", true)}>Ligado</button>
          <button className={!tweaks.confetti ? "active" : ""} onClick={() => setTweak("confetti", false)}>Desligado</button>
        </div>
      </div>
    </div>
  );
}

// ===================== APP =====================
function App() {
  const saved = loadState();
  const [profile, setProfile] = useState(saved.profile || null);
  const [result, setResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(saved.lastSpinDate === todayKey() ? todayKey() : null);

  // Tweaks
  const [tweaks, setTweaks] = useState(window.TWEAK_DEFAULTS || { theme: "oliva-dourado", wheelStyle: "elegante", confetti: true });
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Apply body classes
  useEffect(() => {
    document.body.className = `theme-${tweaks.theme} style-${tweaks.wheelStyle}`;
  }, [tweaks.theme, tweaks.wheelStyle]);

  // Edit-mode protocol (Tweaks toolbar toggle)
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const setTweak = useCallback((k, v) => {
    setTweaks(t => {
      const next = { ...t, [k]: v };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
      return next;
    });
  }, []);

  const handleReady = (p) => setProfile(p);

  const handleWin = (prize) => {
    setResult(prize);
    if (prize.code !== "__AGAIN") {
      saveState({ lastSpinDate: todayKey(), lastPrize: prize });
      setLockedUntil(todayKey());
      if (tweaks.confetti) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    }
  };

  const handleCloseModal = () => setResult(null);
  const handleSpinAgain = () => setResult(null); // "again" prize resets result, keeps lock off

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setResult(null);
    setLockedUntil(null);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wordmark">
          <img src="/roleta/assets/lepoa-logo.png" alt="Le.Poá" />
        </div>
        <div className="meta">Roleta da Sorte · 2026</div>
      </header>

      {!profile ? (
        <IntroScreen onReady={handleReady} />
      ) : (
        <WheelScreen
          profile={profile}
          onWin={handleWin}
          lockedUntil={lockedUntil}
          onReset={handleReset}
        />
      )}

      <footer className="footer">
        <span>Atelier Le.Poá</span>
        <span>1 giro / dia</span>
      </footer>

      {result && (
        <PrizeModal
          prize={result}
          onClose={handleCloseModal}
          onSpinAgain={handleSpinAgain}
          allowReSpin={result.code === "__AGAIN"}
        />
      )}
      {showConfetti && <Confetti />}

      <TweaksPanel
        open={tweaksOpen}
        tweaks={tweaks}
        setTweak={setTweak}
        onClose={() => setTweaksOpen(false)}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
