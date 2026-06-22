/* ──────────────────────────────────────────────────────────────
   ExpenseTerminal landing — interactions
   ────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ---------- reveal on scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  var fmt = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

  /* ---------- community goal bar (animate when visible) ---------- */
  var goalBar = document.getElementById('goalBar');
  var goalSaved = document.getElementById('goalSaved');
  var GOAL_TARGET = 68400, GOAL_MAX = 100000;
  if (goalBar) {
    var gObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        gObs.disconnect();
        requestAnimationFrame(function () { goalBar.style.width = (GOAL_TARGET / GOAL_MAX * 100) + '%'; });
        countUp(goalSaved, 0, GOAL_TARGET, 1400, fmt);
      });
    }, { threshold: 0.4 });
    gObs.observe(goalBar);
  }

  function countUp(el, from, to, dur, format) {
    if (!el) return;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ──────────────────────────────────────────────────────────────
     SWIPE DECK — Tax Triage demo
     ────────────────────────────────────────────────────────────── */
  var DECK = [
    { vendor: 'Figma Inc.',        meta: 'Jun 02 · Software subscription', amount: 45.00,   ded: 45.00,   pct: 94, biz: true },
    { vendor: 'Blue Bottle Coffee',meta: 'Jun 02 · Coffee',                amount: 5.75,    ded: 0,       pct: 88, biz: false },
    { vendor: 'B&H Photo Video',   meta: 'Jun 01 · Camera lens',           amount: 1240.00, ded: 1240.00, pct: 97, biz: true },
    { vendor: "Trader Joe's",      meta: 'May 31 · Groceries',             amount: 96.40,   ded: 0,       pct: 91, biz: false },
    { vendor: 'Squarespace',       meta: 'May 30 · Website hosting',       amount: 23.00,   ded: 23.00,   pct: 92, biz: true },
    { vendor: 'Delta Air Lines',   meta: 'May 29 · Client trip · Austin',  amount: 384.00,  ded: 384.00,  pct: 86, biz: true },
    { vendor: 'Verizon Wireless',  meta: 'May 28 · Phone · 60% business',  amount: 88.00,   ded: 52.80,   pct: 90, biz: true, partial: true },
    { vendor: 'Canva Pro',         meta: 'May 27 · Design tool',           amount: 12.99,   ded: 12.99,   pct: 89, biz: true }
  ];
  var TAX_RATE = 0.25;
  var TOTAL = DECK.length;

  var deckEl = document.getElementById('deck');
  if (!deckEl) return;

  var doneEl = document.getElementById('swipeDone');
  var tallyDedNum = document.getElementById('tallyDedNum');
  var tallyTax = document.getElementById('tallyTax');
  var progBar = document.getElementById('progBar');
  var progCount = document.getElementById('progCount');
  var doneSaved = document.getElementById('doneSaved');
  var doneTax = document.getElementById('doneTax');

  var idx = 0, deductions = 0, animating = false;

  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function cardMarkup(t, posClass) {
    var hint = t.biz
      ? '<span class="scard__hint biz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Looks like Business · ' + t.pct + '%</span>'
      : '<span class="scard__hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Looks like Personal · ' + t.pct + '%</span>';
    var ded = t.biz
      ? '<div class="scard__ded"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> ' + (t.partial ? '60% deductible · ' + money(t.ded) : 'Deductible · ' + money(t.ded)) + '</div>'
      : '<div class="scard__ded" style="color:var(--ink-4)">Not a write-off</div>';
    return '' +
      '<div class="scard ' + posClass + '">' +
        '<div class="scard__stamp per">Personal</div>' +
        '<div class="scard__stamp biz">Business</div>' +
        hint +
        '<div class="scard__vendor">' + t.vendor + '</div>' +
        '<div class="scard__meta">' + t.meta + '</div>' +
        '<div class="scard__amt">' + money(t.amount) + '</div>' +
        ded +
      '</div>';
  }

  function render() {
    deckEl.innerHTML = '';
    // build back-to-front so DOM order doesn't matter (z handled by class)
    for (var d = 2; d >= 0; d--) {
      var t = DECK[idx + d];
      if (!t) continue;
      var posClass = d === 0 ? 'top' : (d === 1 ? 's-2' : 's-3');
      deckEl.insertAdjacentHTML('afterbegin', cardMarkup(t, posClass));
    }
    var top = deckEl.querySelector('.scard.top');
    if (top) attachDrag(top);
    updateStats();
  }

  function updateStats() {
    var sorted = idx;
    if (tallyDedNum) tallyDedNum.textContent = Math.round(deductions).toLocaleString('en-US');
    if (tallyTax) tallyTax.textContent = fmt(deductions * TAX_RATE);
    if (progBar) progBar.style.width = (sorted / TOTAL * 100) + '%';
    if (progCount) progCount.textContent = sorted + ' of ' + TOTAL + ' sorted';
  }

  function commit(asBiz) {
    if (animating || idx >= TOTAL) return;
    var t = DECK[idx];
    var top = deckEl.querySelector('.scard.top');
    if (!top) return;
    animating = true;

    if (asBiz && t.biz !== false) deductions += t.ded;
    // (a "Personal" swipe on a business-looking card simply adds no deduction)

    var dir = asBiz ? 1 : -1;
    top.style.transition = 'transform .42s cubic-bezier(.4,0,.2,1), opacity .42s';
    top.style.transform = 'translateX(' + (dir * 520) + 'px) rotate(' + (dir * 18) + 'deg)';
    top.style.opacity = '0';
    var stamp = top.querySelector(asBiz ? '.scard__stamp.biz' : '.scard__stamp.per');
    if (stamp) stamp.style.opacity = '1';

    idx++;
    // tick the deduction counter smoothly
    if (asBiz && t.biz !== false && t.ded > 0) {
      var fromD = deductions - t.ded;
      countUp(tallyDedNum, fromD, deductions, 420, function (n) { return Math.round(n).toLocaleString('en-US'); });
      countUp(tallyTax, fromD * TAX_RATE, deductions * TAX_RATE, 420, fmt);
    }

    setTimeout(function () {
      animating = false;
      if (idx >= TOTAL) finish();
      else render();
      updateProgressOnly();
    }, 360);
  }

  function updateProgressOnly() {
    if (progBar) progBar.style.width = (idx / TOTAL * 100) + '%';
    if (progCount) progCount.textContent = idx + ' of ' + TOTAL + ' sorted';
  }

  function skip() {
    if (animating || idx >= TOTAL) return;
    var top = deckEl.querySelector('.scard.top');
    if (!top) return;
    animating = true;
    top.style.transition = 'transform .38s cubic-bezier(.4,0,.2,1), opacity .38s';
    top.style.transform = 'translateY(-460px) scale(.9)';
    top.style.opacity = '0';
    idx++;
    setTimeout(function () {
      animating = false;
      if (idx >= TOTAL) finish();
      else render();
      updateProgressOnly();
    }, 320);
  }

  function finish() {
    deckEl.innerHTML = '';
    if (doneEl) doneEl.classList.add('show');
    countUp(doneSaved, 0, deductions, 900, fmt);
    countUp(doneTax, 0, deductions * TAX_RATE, 900, fmt);
    updateProgressOnly();
  }

  function restart() {
    idx = 0; deductions = 0; animating = false;
    if (doneEl) doneEl.classList.remove('show');
    render();
  }

  /* ---------- pointer drag on top card ---------- */
  function attachDrag(card) {
    var startX = 0, startY = 0, dragging = false, dx = 0;
    var stampBiz = card.querySelector('.scard__stamp.biz');
    var stampPer = card.querySelector('.scard__stamp.per');

    function down(e) {
      if (animating) return;
      dragging = true; dx = 0;
      startX = e.clientX; startY = e.clientY;
      card.style.transition = 'none';
      card.setPointerCapture && card.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var rot = dx / 18;
      card.style.transform = 'translate(' + dx + 'px,' + dy * 0.25 + 'px) rotate(' + rot + 'deg)';
      var k = Math.min(Math.abs(dx) / 90, 1);
      if (dx > 0) { if (stampBiz) stampBiz.style.opacity = k; if (stampPer) stampPer.style.opacity = 0; }
      else { if (stampPer) stampPer.style.opacity = k; if (stampBiz) stampBiz.style.opacity = 0; }
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      if (dx > 90) { commit(true); }
      else if (dx < -90) { commit(false); }
      else {
        card.style.transition = 'transform .3s var(--ease)';
        card.style.transform = '';
        if (stampBiz) stampBiz.style.opacity = 0;
        if (stampPer) stampPer.style.opacity = 0;
      }
    }
    card.addEventListener('pointerdown', down);
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  /* ---------- buttons + keyboard ---------- */
  var btnPer = document.getElementById('btnPer');
  var btnBiz = document.getElementById('btnBiz');
  var btnSkip = document.getElementById('btnSkip');
  var restartBtn = document.getElementById('restartBtn');
  if (btnPer) btnPer.addEventListener('click', function () { commit(false); });
  if (btnBiz) btnBiz.addEventListener('click', function () { commit(true); });
  if (btnSkip) btnSkip.addEventListener('click', skip);
  if (restartBtn) restartBtn.addEventListener('click', restart);

  // keyboard only when the demo is in view
  var demoInView = false;
  var kObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { demoInView = e.isIntersecting; });
  }, { threshold: 0.3 });
  kObs.observe(document.getElementById('triage'));
  document.addEventListener('keydown', function (e) {
    if (!demoInView || idx >= TOTAL) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); commit(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); commit(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); skip(); }
  });

  render();

  /* ──────────────────────────────────────────────────────────────
     DEMO FORM — styled, client-side confirmation only
     ────────────────────────────────────────────────────────────── */
  var form = document.getElementById('demoForm');
  var ok = document.getElementById('demoOk');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#df-name');
      var email = form.querySelector('#df-email');
      // light validation so the button never feels dead
      if (!name.value.trim() || !email.value.trim() || !/.+@.+\..+/.test(email.value)) {
        (name.value.trim() ? email : name).focus();
        return;
      }
      form.style.display = 'none';
      if (ok) ok.classList.add('show');
    });
  }
})();
