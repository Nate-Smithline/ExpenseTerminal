"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startProCheckout } from "@/lib/billing/start-checkout";
import type { TrialStatusResult } from "@/lib/billing/trial";

// ── SVG Icons ─────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  check:   "M20 6L9 17l-5-5",
  arrow:   "M5 12h14M13 6l6 6-6 6",
  bank:    "M3 10l9-6 9 6M4 10v9h16v-9M9 19v-5h6v5",
  receipt: "M5 3h14a1.5 1.5 0 011.5 1.5v15L17 18l-2.5 1.5L12 18l-2.5 1.5L7 18l-3.5 1.5V4.5A1.5 1.5 0 015 3zM9 8h6M9 12h6M9 16h3",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  chart:   "M3 3v18h18M7 14l4-4 3 3 5-6",
  star:    "M12 2l2.9 6.3L22 9.3l-5 4.8 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.8 7.1-1z",
  clock:   "M12 3a9 9 0 100 18A9 9 0 0012 3zM12 7v5l3 2",
  lock:    "M8 11V8a4 4 0 018 0v3M4 11h16v9a2 2 0 01-2 2H6a2 2 0 01-2-2z",
  x:       "M18 6L6 18M6 6l12 12",
  spark:   "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
};

function Icon({ name, size = 20, sw = 1.7 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {name === "receipt" ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      ) : name === "lock" ? (
        <>
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </>
      ) : (
        <path d={ICONS[name] ?? ""} />
      )}
    </svg>
  );
}

// ── Progress Ring ──────────────────────────────────────────────
function Ring({ value, total, size = 56, sw = 6 }: { value: number; total: number; size?: number; sw?: number }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  const label = Math.round(pct * 100) + "%";
  return (
    <div className="onb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="onb-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} />
        <circle className="onb-ring__fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="onb-ring__label" style={{ fontSize: size * 0.27 }}>{label}</span>
    </div>
  );
}

// ── Confetti ───────────────────────────────────────────────────
const CONFETTI_COLORS = ["#047857", "#10B981", "#0EA5E9", "#1E40AF", "#A7F3D0", "#BAE6FD"];

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 64 }, (_, i) => ({
      left: Math.random() * 100,
      bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.5,
      dur: 2.2 + Math.random() * 1.8,
      rot: Math.random() * 360,
      w: 6 + Math.random() * 6,
    })), []);
  return (
    <div className="onb-confetti">
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
}

// ── Task definitions ───────────────────────────────────────────
type TaskId = "connect" | "tag" | "tax" | "budget" | "sub";

const TASKS: Array<{
  id: TaskId; t: string; d: string; ic: string; icon: string; xp: string; reward: string;
}> = [
  { id: "connect", t: "Connect your first account", d: "Link a bank or card — transactions flow in automatically.", ic: "onb-ic-clay", icon: "bank", xp: "+10", reward: "Unlocks live transactions" },
  { id: "tag",     t: "Tag your first transaction", d: "Learn the one-tap Personal / Business / Partial split.", ic: "onb-ic-forest", icon: "receipt", xp: "+15", reward: "Starts your Schedule C" },
  { id: "tax",     t: "Set up your tax profile", d: "Filing status + automatic quarterly set-aside.", ic: "onb-ic-wheat", icon: "shield", xp: "+10", reward: "Tax autopilot on" },
  { id: "budget",  t: "Build your first budget", d: "Give every dollar a job for the month.", ic: "onb-ic-ink", icon: "chart", xp: "+10", reward: "Zero-based budget ready" },
  { id: "sub",     t: "Activate your membership", d: "Add a card to start your 15-day free trial — no charge until it ends.", ic: "onb-ic-forest", icon: "star", xp: "+25", reward: "Full access, forever" },
];

// ── Task sheet bodies ──────────────────────────────────────────
function ConnectBody({ onComplete }: { onComplete: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const BANKS = [
    { id: "chase", nm: "Chase", c: "#117ACA" },
    { id: "ally", nm: "Ally", c: "#7A1FA2" },
    { id: "amex", nm: "Amex", c: "#016FD0" },
    { id: "cap1", nm: "Capital One", c: "#D03027" },
  ];
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>
        Choose an institution to link securely via Plaid.
      </p>
      <div className="onb-banks">
        {BANKS.map(b => (
          <button key={b.id} type="button"
            className={`onb-bank${picked === b.id ? " onb-bank--connected" : ""}`}
            onClick={() => { setPicked(b.id); setTimeout(onComplete, 600); }}>
            <span className="onb-bank__logo" style={{ background: b.c }}>{b.nm[0]}</span>
            <span className="onb-bank__name">{b.nm}</span>
            {picked === b.id && (
              <span className="onb-bank__chk"><Icon name="check" size={16} sw={2.4} /></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagBody() {
  const [marker, setMarker] = useState<string | null>(null);
  const MARKERS = [
    { id: "personal", lbl: "Personal", cls: "onb-mopt--per" },
    { id: "partial",  lbl: "Partial",  cls: "onb-mopt--par" },
    { id: "business", lbl: "Business", cls: "onb-mopt--biz" },
  ];
  return (
    <div>
      <div className={`onb-tagcard${marker ? " onb-tagcard--tagged" : ""}`}>
        <div className="onb-tagcard__top">
          <div>
            <div className="onb-tagcard__vendor">Verizon Wireless</div>
            <div className="onb-tagcard__sub">Phone bill · recurring</div>
          </div>
          <div className="onb-tagcard__amt">$88.00</div>
        </div>
        <div className="onb-taghint">
          <span className="onb-taghint-icon"><Icon name="spark" size={14} /></span>
          Often a partial split for freelancers
        </div>
        <div className="onb-mpick">
          {MARKERS.map(m => (
            <button key={m.id} type="button"
              className={`onb-mopt ${m.cls}${marker === m.id ? " onb-mopt--on" : ""}`}
              onClick={() => setMarker(m.id)}>
              <span className="onb-mopt__dot" />
              <span className="onb-mopt__lbl">{m.lbl}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaxBody() {
  const [filing, setFiling] = useState("single");
  const [setAside, setSetAside] = useState(true);
  const OPTS = [{ id: "single", t: "Single" }, { id: "married", t: "Married" }, { id: "hoh", t: "HoH" }];
  return (
    <div>
      <p className="onb-fieldlbl">Filing status</p>
      <div className="onb-optrow">
        {OPTS.map(o => (
          <button key={o.id} type="button"
            className={`onb-opt${filing === o.id ? " onb-opt--on" : ""}`}
            onClick={() => setFiling(o.id)}>
            {o.t}
          </button>
        ))}
      </div>
      <div className="onb-setaside">
        <div>
          <div className="onb-setaside__big">{setAside ? "$1,070" : "$0"}</div>
          <div className="onb-setaside__lbl">Auto set-aside each quarter</div>
        </div>
        <button type="button"
          className={`onb-toggle${setAside ? " onb-toggle--on" : ""}`}
          onClick={() => setSetAside(v => !v)}>
          <i />
        </button>
      </div>
    </div>
  );
}

function BudgetBody() {
  const rows = [
    { nm: "Needs", v: 2400, c: "var(--ink-3)" },
    { nm: "Wants", v: 900, c: "#7C3AED" },
    { nm: "Business", v: 1200, c: "var(--forest)" },
    { nm: "Tax set-aside", v: 1070, c: "var(--wheat)" },
  ];
  const tot = rows.reduce((s, r) => s + r.v, 0);
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
        We drafted a starter budget from your activity. Tweak anytime.
      </p>
      {rows.map(r => (
        <div key={r.nm} className="onb-budget-row">
          <span className="onb-budget-dot" style={{ background: r.c }} />
          <span className="onb-budget-label">{r.nm}</span>
          <div className="onb-budget-track">
            <div className="onb-budget-fill" style={{ width: (r.v / tot * 100) + "%", background: r.c }} />
          </div>
          <span className="onb-budget-amt">${r.v.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function SubBody({ onCheckout }: { onCheckout: (interval: "month" | "year") => void }) {
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  return (
    <div>
      <div className="onb-planrow">
        <button type="button"
          className={`onb-planopt${plan === "monthly" ? " onb-planopt--on" : ""}`}
          onClick={() => setPlan("monthly")}>
          <span className="onb-planopt__radio" />
          <span>
            <span className="onb-planopt__nm">Monthly</span>
            <span className="onb-planopt__desc">Billed monthly</span>
          </span>
          <span className="onb-planopt__price"><b>$18</b><span>/mo</span></span>
        </button>
        <button type="button"
          className={`onb-planopt${plan === "annual" ? " onb-planopt--on" : ""}`}
          onClick={() => setPlan("annual")}>
          <span className="onb-planopt__radio" />
          <span>
            <span className="onb-planopt__nm">
              Annual <span className="onb-planopt__save">SAVE 17%</span>
            </span>
            <span className="onb-planopt__desc">$180/yr · best value</span>
          </span>
          <span className="onb-planopt__price"><b>$15</b><span>/mo</span></span>
        </button>
      </div>
      <div className="onb-trustline">
        <Icon name="lock" size={13} sw={2} />
        Free for 15 days, then {plan === "annual" ? "$180/year" : "$18/month"} · cancel anytime
      </div>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button type="button" className="onb-btn onb-btn--primary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => onCheckout(plan === "annual" ? "year" : "month")}>
          <Icon name="star" size={15} sw={2} />
          Choose this plan
        </button>
      </div>
    </div>
  );
}

// ── Task Sheet Modal ───────────────────────────────────────────
function TaskSheet({
  taskId, onClose, onComplete,
}: { taskId: TaskId; onClose: () => void; onComplete: (id: TaskId) => void }) {
  const task = TASKS.find(t => t.id === taskId)!;
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async (interval: "month" | "year") => {
    setCheckoutLoading(true);
    try {
      await startProCheckout(interval);
    } catch {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="onb-modal" onClick={onClose}>
      <div className="onb-sheet" onClick={e => e.stopPropagation()}>
        <div className="onb-sheet__hd">
          <span className={`onb-sheet__ic ${task.ic}`}>
            <Icon name={task.icon} size={20} sw={1.8} />
          </span>
          <div>
            <h3>{task.t}</h3>
            <p>{task.d}</p>
          </div>
          <button type="button" className="onb-sheet__x" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="onb-sheet__bd">
          {taskId === "connect" && <ConnectBody onComplete={() => onComplete(taskId)} />}
          {taskId === "tag"     && <TagBody />}
          {taskId === "tax"     && <TaxBody />}
          {taskId === "budget"  && <BudgetBody />}
          {taskId === "sub"     && <SubBody onCheckout={handleCheckout} />}
        </div>

        <div className="onb-sheet__ft">
          <button type="button" className="onb-btn onb-btn--soft" onClick={onClose}>
            Maybe later
          </button>
          {taskId !== "sub" && (
            <button type="button" className="onb-btn onb-btn--primary"
              onClick={() => onComplete(taskId)}>
              <Icon name="check" size={15} sw={2.4} /> Mark complete
            </button>
          )}
          {taskId === "sub" && checkoutLoading && (
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Redirecting…</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
type OnbData = {
  firstName: string | null;
  steps: Record<TaskId, boolean>;
  trial: TrialStatusResult;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnbData | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [openTask, setOpenTask] = useState<TaskId | null>(null);
  const [burst, setBurst] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then((d) => {
        if (d?.steps) {
          const completedCount = TASKS.filter(t => (d.steps as Record<string, boolean>)[t.id]).length;
          if (completedCount >= TASKS.length) {
            router.replace("/dashboard");
            return;
          }
          setData(d as OnbData);
          setDone(d.steps);
        }
      })
      .catch(() => {});
  }, [router]);

  const completeStep = useCallback(async (id: TaskId) => {
    setDone(prev => {
      const next = { ...prev, [id]: true };
      const count = Object.values(next).filter(Boolean).length;
      if (count === TASKS.length) {
        setBurst(true);
        setTimeout(() => setBurst(false), 4000);
      }
      return next;
    });
    setOpenTask(null);
    // Persist
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: id }),
    }).catch(() => {});
    // Notify the sidebar widget so it re-fetches without needing a route change
    window.dispatchEvent(new CustomEvent("onboarding:step-complete"));
  }, []);

  if (!data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const safeDone: Record<string, boolean> = done ?? {};
  const doneCount = TASKS.filter(t => safeDone[t.id]).length;
  const allDone = doneCount === TASKS.length;
  const isSubscribed = safeDone.sub || data.trial.status === "subscribed";
  const trial = data.trial;
  const firstName = data.firstName;
  const nextReward = TASKS.find(t => !safeDone[t.id])?.reward;

  return (
    <div className="onb-page">
      {burst && <Confetti />}

      {/* Trial / Subscribe Banner */}
      <div className={`onb-trialbar${isSubscribed ? " is-sub" : ""}`}>
        <span className="onb-trialbar__ic">
          <Icon name={isSubscribed ? "check" : "clock"} size={20} sw={2} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="onb-trialbar__t">
            {isSubscribed
              ? "Membership active — welcome aboard"
              : trial?.status === "trial"
              ? `You're on a free trial — ${trial.daysLeft} day${trial.daysLeft !== 1 ? "s" : ""} left`
              : "Add a card to start your 15-day free trial"}
          </div>
          <div className="onb-trialbar__d">
            {isSubscribed
              ? "Full access to budgeting, tax, and exports."
              : trial?.status === "trial"
              ? "Connect, tag, and explore. You won't be charged until your trial ends."
              : "No charge for 15 days, then your plan begins. Cancel anytime."}
          </div>
        </div>
        {!isSubscribed && (
          <button type="button" className="onb-btn onb-btn--primary"
            disabled={subLoading}
            onClick={() => setOpenTask("sub")}>
            Choose your plan
          </button>
        )}
      </div>

      {/* Page Header */}
      <div className="onb-pagehead">
        <h1>
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}{" "}
          <em>Let&rsquo;s get you set up.</em>
        </h1>
        <p>Finish these {TASKS.length} steps to unlock the full picture — it takes about three minutes.</p>
      </div>

      {/* Checklist Card */}
      <div className="onb-cl">
        <div className="onb-cl__hd">
          <Ring value={doneCount} total={TASKS.length} size={56} sw={6} />
          <div className="onb-cl__hd-txt">
            <h2>{allDone ? "Setup complete" : "Your setup checklist"}</h2>
            <p>
              {allDone
                ? "Everything's ready — your books are clean."
                : `${TASKS.length - doneCount} step${TASKS.length - doneCount !== 1 ? "s" : ""} left to a clean, tax-ready ledger`}
            </p>
          </div>
          <div className="onb-cl__reward">
            {allDone ? (
              <><b>70 XP earned</b>Setup master unlocked</>
            ) : (
              <>Next reward<b>{nextReward}</b></>
            )}
          </div>
        </div>

        {TASKS.map(task => {
          const isDone = safeDone[task.id];
          return (
            <div key={task.id} className={`onb-cli${isDone ? " onb-cli--done" : ""}`}>
              <span className="onb-cli__check">
                {isDone && <span className="onb-cli__check-icon"><Icon name="check" size={14} sw={2.6} /></span>}
              </span>
              <span className={`onb-cli__ic ${task.ic}`}>
                <Icon name={task.icon} size={19} sw={1.8} />
              </span>
              <div className="onb-cli__txt">
                <div className="onb-cli__title">
                  <span className="onb-cli__name">{task.t}</span>
                  {!isDone && <span className="onb-cli__xp">{task.xp} XP</span>}
                </div>
                <div className="onb-cli__desc">{task.d}</div>
              </div>
              <div className="onb-cli__act">
                {isDone ? (
                  <span className="onb-cli__done-label">
                    <Icon name="check" size={13} sw={2.6} /> Done
                  </span>
                ) : (
                  <button type="button" className="onb-btn onb-btn--primary"
                    onClick={() => setOpenTask(task.id)}>
                    {task.id === "sub" ? "Choose plan" : "Start"}
                    {" "}<Icon name="arrow" size={14} sw={2} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ghost Dashboard */}
      <div className="onb-ghost">
        {[0, 1, 2].map(i => (
          <div key={i} className="onb-ghost-card">
            <div className="onb-ghost-line" />
            <div className="onb-ghost-line onb-ghost-line--short" />
            <div className="onb-ghost-big" />
          </div>
        ))}
        <div className="onb-ghost-lbl">Your dashboard fills in as you complete setup</div>
      </div>

      {/* Task Sheet */}
      {openTask && (
        <TaskSheet
          taskId={openTask}
          onClose={() => setOpenTask(null)}
          onComplete={completeStep}
        />
      )}
    </div>
  );
}
