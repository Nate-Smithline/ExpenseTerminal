/* eslint-disable */
/* Onboarding — shared primitives, icons, confetti */

const ICON = {
  check:   '<path d="M20 6L9 17l-5-5"/>',
  arrow:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back:    '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  spark:   '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  bank:    '<path d="M3 10l9-6 9 6M4 10v9h16v-9M9 19v-5h6v5"/>',
  shield:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  receipt: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  wallet:  '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
  chart:   '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
  bolt:    '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:    '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  x:       '<path d="M18 6L6 18M6 6l12 12"/>',
  sliders: '<path d="M3 12h18M3 6h18M3 18h18"/><circle cx="15" cy="6" r="2.4" fill="#fff"/><circle cx="9" cy="12" r="2.4" fill="#fff"/><circle cx="16" cy="18" r="2.4" fill="#fff"/>',
  star:    '<path d="M12 2l2.9 6.3L22 9.3l-5 4.8 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.8 7.1-1z"/>',
  gift:    '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13M12 8s-1-5-4-5-2 5 4 5zM12 8s1-5 4-5 2 5-4 5z"/>',
  plug:    '<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0zM12 16v6"/>',
  user:    '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0114 0"/>',
};

const Icon = ({ name, size = 20, sw = 1.7, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}
       dangerouslySetInnerHTML={{ __html: ICON[name] || '' }} />
);

const Mark = ({ lg }) => (
  <span className={"mark" + (lg ? " mark--lg" : "")}>XT</span>
);

/* Progress ring -------------------------------------------------- */
const Ring = ({ value, total, size = 46, sw = 5, label }) => {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring__track" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw} />
        <circle className="ring__fill" cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw}
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="ring__label" style={{ fontSize: size * 0.27 }}>
        {label != null ? label : `${value}/${total}`}
      </span>
    </div>
  );
};

/* Marker picker -------------------------------------------------- */
const MARKERS = [
  { id: "personal", lbl: "Personal", cls: "is-per" },
  { id: "partial",  lbl: "Partial",  cls: "is-par" },
  { id: "business", lbl: "Business", cls: "is-biz" },
];
const MarkerPicker = ({ value, onPick }) => (
  <div className="mpick">
    {MARKERS.map(m => (
      <button key={m.id} className={"mopt " + m.cls} data-on={value === m.id}
              onClick={() => onPick(m.id)}>
        <span className="mo-dot"></span>
        <span className="mo-lbl">{m.lbl}</span>
      </button>
    ))}
  </div>
);

/* Confetti ------------------------------------------------------- */
const CONFETTI_COLORS = ["#047857", "#10B981", "#0EA5E9", "#1E40AF", "#A7F3D0", "#BAE6FD"];
const Confetti = ({ count = 64, play = true }) => {
  if (!play) return null;
  const pieces = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.5,
    dur: 2.2 + Math.random() * 1.8,
    rot: Math.random() * 360,
    w: 6 + Math.random() * 6,
  })), [count]);
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{
          left: p.left + "%", background: p.bg,
          width: p.w, height: p.w * 1.5,
          transform: `rotate(${p.rot}deg)`,
          animationDuration: p.dur + "s", animationDelay: p.delay + "s",
        }} />
      ))}
    </div>
  );
};

/* USD format ----------------------------------------------------- */
const USD = (n) => "$" + Math.round(n).toLocaleString("en-US");

Object.assign(window, { Icon, ICON, Mark, Ring, MarkerPicker, MARKERS, Confetti, USD });
