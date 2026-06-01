/* eslint-disable */
/* Direction B — In-app getting-started checklist (embedded) */

const NAV = [
  { id: "budget", nm: "Budget", icon: "chart" },
  { id: "cashflow", nm: "Cash Flow", icon: "bolt" },
  { id: "tax", nm: "Tax", icon: "receipt" },
  { id: "review", nm: "Review", icon: "check", badge: "3" },
  { id: "accounts", nm: "Accounts", icon: "wallet" },
];

function InApp({ tweaks }) {
  const playful = tweaks.gamify !== "subtle";
  const trial = tweaks.billing !== "direct";

  const TASKS = [
    { id: "connect", t: "Connect your first account", d: "Link a bank or card — transactions flow in automatically.", ic: "ic-clay", icon: "bank", xp: "+10", reward: "Unlocks live transactions" },
    { id: "tag",     t: "Tag your first transaction", d: "Learn the one-tap Personal / Business / Partial split.", ic: "ic-forest", icon: "receipt", xp: "+15", reward: "Starts your Schedule C" },
    { id: "tax",     t: "Set up your tax profile", d: "Filing status + automatic quarterly set-aside.", ic: "ic-wheat", icon: "shield", xp: "+10", reward: "Tax autopilot on" },
    { id: "budget",  t: "Build your first budget", d: "Give every dollar a job for the month.", ic: "ic-ink", icon: "chart", xp: "+10", reward: "Zero-based budget ready" },
    { id: "sub",     t: trial ? "Activate your membership" : "Subscribe to keep going", d: trial ? "Your free trial is live — lock in your plan anytime." : "Unlock everything for $18/mo.", ic: "ic-forest", icon: "star", xp: "+25", reward: "Full access, forever" },
  ];

  // 'connect' pre-completed to show momentum
  const [done, setDone] = React.useState({ connect: true });
  const [openTask, setOpenTask] = React.useState(null);
  const [burst, setBurst] = React.useState(false);

  const doneCount = TASKS.filter(t => done[t.id]).length;
  const pct = Math.round((doneCount / TASKS.length) * 100);
  const allDone = doneCount === TASKS.length;
  const subscribed = done.sub;

  const complete = (id) => {
    setDone(d => {
      const nd = { ...d, [id]: true };
      if (Object.keys(nd).filter(k => nd[k]).length === TASKS.length && playful) {
        setBurst(true); setTimeout(() => setBurst(false), 4000);
      }
      return nd;
    });
    setOpenTask(null);
  };

  return (
    <div className="app">
      {playful && burst && <Confetti play />}

      {/* sidebar */}
      <aside className="side">
        <div className="side__brand"><Mark /> ExpenseTerminal</div>
        <nav className="nav">
          {NAV.map((n, i) => (
            <div key={n.id} className="navi" data-on={i === 0}>
              <Icon name={n.icon} size={18} />
              <span>{n.nm}</span>
              {n.badge && <span className="badge">{n.badge}</span>}
            </div>
          ))}
        </nav>

        <div className="gswidget">
          <div className="gswidget__top">
            <Ring value={doneCount} total={TASKS.length} size={42} sw={5} />
            <div className="gswidget__txt">
              <div className="t">{allDone ? "All set!" : "Getting started"}</div>
              <div className="d">{allDone ? "You finished setup" : `${doneCount} of ${TASKS.length} complete`}</div>
            </div>
          </div>
          <div className="gswidget__bar"><i style={{ width: pct + "%" }}></i></div>
        </div>

        <div className="side__profile">
          <span className="avatar">NS</span>
          <div><div className="nm">Nathan Smith</div><div className="sub">Profile &amp; settings</div></div>
        </div>
      </aside>

      {/* main */}
      <div className="main">
        <div className="maind">
          {/* trial / subscribe banner */}
          <div className={"trialbar" + (subscribed ? " is-sub" : "")}>
            <span className="trialbar__ic"><Icon name={subscribed ? "check" : "clock"} size={20} sw={2} /></span>
            <div>
              <div className="trialbar__t">{subscribed ? (trial ? "Membership active — welcome aboard" : "You're subscribed") : (trial ? "You're on a free trial — 30 days left" : "Free preview — subscribe to unlock everything")}</div>
              <div className="trialbar__d">{subscribed ? "Full access to budgeting, tax, and exports." : "Connect, tag, and explore. Subscribe anytime to keep it all."}</div>
            </div>
            {!subscribed &&
              <button className="btn btn--primary" onClick={() => setOpenTask("sub")}>
                {trial ? "Choose your plan" : "Subscribe — $18/mo"}
              </button>}
          </div>

          <div className="pagehead">
            <h1>Welcome, Nathan. <em>Let's get you set up.</em></h1>
            <p>Finish these {TASKS.length} steps to unlock the full picture — it takes about three minutes.</p>
          </div>

          {/* checklist */}
          <div className="cl">
            <div className="cl__hd">
              <Ring value={doneCount} total={TASKS.length} size={56} sw={6} label={pct + "%"} />
              <div>
                <h2>{allDone ? "Setup complete" : "Your setup checklist"}</h2>
                <p>{allDone ? "Everything's ready — your books are clean." : `${TASKS.length - doneCount} step${TASKS.length - doneCount !== 1 ? "s" : ""} left to a clean, tax-ready ledger`}</p>
              </div>
              {playful && (
                <div className="cl__reward">
                  {allDone
                    ? <><b>70 XP earned</b>Setup master unlocked</>
                    : <>Next reward<b>{TASKS.find(t => !done[t.id])?.reward}</b></>}
                </div>
              )}
            </div>

            {TASKS.map(task => {
              const isDone = done[task.id];
              return (
                <div className="cli" key={task.id} data-done={isDone}>
                  <span className="cli__check">{isDone && <Icon name="check" size={16} sw={2.6} />}</span>
                  <span className={"cli__ic " + task.ic}><Icon name={task.icon} size={19} /></span>
                  <div className="cli__txt">
                    <div className="cli__t">
                      <span className="main-t">{task.t}</span>
                      {!isDone && playful && <span className="xp">{task.xp} XP</span>}
                    </div>
                    <div className="cli__d">{task.d}</div>
                  </div>
                  <div className="cli__act">
                    {isDone
                      ? <span className="cli__done-lbl"><Icon name="check" size={15} sw={2.6} /> Done</span>
                      : <button className="btn btn--primary" onClick={() => setOpenTask(task.id)}>
                          {task.id === "sub" ? (trial ? "Choose plan" : "Subscribe") : "Start"} <Icon name="arrow" size={15} />
                        </button>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ghost of the real dashboard underneath */}
          <div className="ghost">
            {[0,1,2].map(i => (
              <div className="ghostcard" key={i}>
                <div className="gl"></div><div className="gl s"></div><div className="gbig"></div>
              </div>
            ))}
            <div className="ghost-lbl">Your dashboard fills in as you complete setup</div>
          </div>
        </div>

        {/* task sheet */}
        {openTask && (
          <TaskSheet taskId={openTask} tasks={TASKS} trial={trial}
                     onClose={() => setOpenTask(null)} onComplete={complete} />
        )}
      </div>
    </div>
  );
}

/* ── Task sheets (lightweight simulated steps) ────────────────── */
function TaskSheet({ taskId, tasks, trial, onClose, onComplete }) {
  const task = tasks.find(t => t.id === taskId);
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__hd">
          <span className={"sheet__ic " + task.ic}><Icon name={task.icon} /></span>
          <div>
            <h3>{task.t}</h3>
            <p>{task.d}</p>
          </div>
          <button className="sheet__x" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet__bd">
          {taskId === "connect" && <ConnectBody />}
          {taskId === "tag" && <TagBody />}
          {taskId === "tax" && <TaxBody />}
          {taskId === "budget" && <BudgetBody />}
          {taskId === "sub" && <SubBody trial={trial} />}
        </div>
        <div className="sheet__ft">
          <button className="btn btn--soft" onClick={onClose}>Maybe later</button>
          <button className="btn btn--primary" onClick={() => onComplete(taskId)}>
            <Icon name="check" size={16} sw={2.4} /> Mark complete
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectBody() {
  const [picked, setPicked] = React.useState(null);
  const opts = [{ id: "chase", nm: "Chase", c: "#117ACA" }, { id: "ally", nm: "Ally", c: "#7A1FA2" }, { id: "amex", nm: "Amex", c: "#016FD0" }, { id: "cap1", nm: "Capital One", c: "#D03027" }];
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>Choose an institution to link securely via Plaid.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opts.map(o => (
          <button key={o.id} className="bank" data-state={picked === o.id ? "connected" : "idle"} onClick={() => setPicked(o.id)}>
            <span className="bank__logo" style={{ background: o.c }}>{o.nm[0]}</span>
            <span className="bank__nm">{o.nm}</span>
            {picked === o.id && <span className="bank__chk"><Icon name="check" size={16} sw={2.4} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagBody() {
  const [m, setM] = React.useState(null);
  return (
    <div>
      <div className="tagcard" data-tagged={!!m} style={{ boxShadow: "none" }}>
        <div className="tagcard__top">
          <div><div className="tagcard__v">Verizon Wireless</div><div className="tagcard__d">Phone bill · recurring</div></div>
          <div className="tagcard__amt neg">$88.00</div>
        </div>
        <div className="taghint"><span className="spark"><Icon name="spark" size={14} /></span><span>Often a partial split for freelancers</span></div>
        <MarkerPicker value={m} onPick={setM} />
      </div>
    </div>
  );
}

function TaxBody() {
  const [f, setF] = React.useState("single");
  const [a, setA] = React.useState(true);
  return (
    <div>
      <p className="fieldlbl" style={{ marginTop: 0 }}>Filing status</p>
      <div className="optrow">
        {[{ id: "single", t: "Single" }, { id: "married", t: "Married" }, { id: "hoh", t: "HoH" }].map(o => (
          <button key={o.id} className="opt" data-on={f === o.id} onClick={() => setF(o.id)}><div className="opt-t">{o.t}</div></button>
        ))}
      </div>
      <div className="setaside" style={{ marginTop: 16 }}>
        <div><div className="setaside__big">{USD(a ? 1070 : 0)}</div><div className="setaside__l">Auto set-aside each quarter</div></div>
        <button className="toggle" data-on={a} onClick={() => setA(v => !v)}><i></i></button>
      </div>
    </div>
  );
}

function BudgetBody() {
  const rows = [{ nm: "Needs", v: 2400, c: "var(--ink-3)" }, { nm: "Wants", v: 900, c: "#7C3AED" }, { nm: "Business", v: 1200, c: "var(--forest)" }, { nm: "Tax set-aside", v: 1070, c: "var(--wheat)" }];
  const tot = rows.reduce((s, r) => s + r.v, 0);
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>We drafted a starter budget from your activity. Tweak anytime.</p>
      {rows.map(r => (
        <div key={r.nm} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: r.c, flex: "0 0 auto" }}></span>
          <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{r.nm}</span>
          <div style={{ flex: 2, height: 7, background: "var(--bone-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: (r.v / tot * 100) + "%", height: "100%", background: r.c }}></div>
          </div>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 56, textAlign: "right" }}>{USD(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

function SubBody({ trial }) {
  const [plan, setPlan] = React.useState("monthly");
  return (
    <div>
      <div className="planrow" style={{ marginTop: 0 }}>
        <button className="planopt" data-on={plan === "monthly"} onClick={() => setPlan("monthly")}>
          <span className="planopt__radio"></span>
          <span><span className="planopt__nm">Monthly</span><span className="planopt__d">Billed monthly</span></span>
          <span className="planopt__price"><b>$18</b><span>/mo</span></span>
        </button>
        <button className="planopt" data-on={plan === "annual"} onClick={() => setPlan("annual")}>
          <span className="planopt__radio"></span>
          <span><span className="planopt__nm">Annual <span className="planopt__save">SAVE 17%</span></span><span className="planopt__d">$180/yr</span></span>
          <span className="planopt__price"><b>$15</b><span>/mo</span></span>
        </button>
      </div>
      <div className="trustline" style={{ marginTop: 14 }}><Icon name="lock" /> {trial ? "Free for 30 days, then " : ""}{plan === "annual" ? "$180/year" : "$18/month"} · cancel anytime</div>
    </div>
  );
}

Object.assign(window, { InApp });
