// =============================================================
//  ui.js — HUD, joystick, toolbar, dialogs (academy/garage/shop)
// =============================================================
import { store, CROPS, VEHICLES, UPGRADES, xpForLevel } from './state.js';
import { audio } from './audio.js';
import { LESSONS } from './lessons.js';
import {
  setVehicle, getActiveTile, tillTile, plantTile, waterTile, harvestTile,
  isOnMat, isNearWell, setMorning, phaseLabel, scene,
} from './three_scene.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------------------------------------------------------
//  Input (keyboard + virtual joystick)
// ---------------------------------------------------------------
const keys = {};
const joy = { active: false, x: 0, y: 0, id: null };

export function getInput() {
  let x = 0, y = 0;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (joy.active) { x += joy.x; y += joy.y; }
  return { x, y };
}

function initInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') { e.preventDefault(); doAct(); }
    if (e.key.toLowerCase() === 'e') doWater();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  const stick = $('joystick'), knob = $('joystick-knob');
  const R = 52;
  const center = () => {
    const r = stick.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  const move = (px, py) => {
    const { cx, cy } = center();
    let dx = px - cx, dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.x = dx / R; joy.y = dy / R;
  };
  const end = () => {
    joy.active = false; joy.x = joy.y = 0; joy.id = null;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  stick.addEventListener('pointerdown', (e) => { joy.active = true; joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); move(e.clientX, e.clientY); });
  stick.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.id) move(e.clientX, e.clientY); });
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------
//  HUD
// ---------------------------------------------------------------
function syncHud() {
  const st = store.state;
  $('hud-coins').textContent = st.coins;
  $('hud-level').textContent = st.level;
  const need = xpForLevel(st.level);
  $('hud-xp-text').textContent = `${Math.floor(st.xp)}/${need}`;
  $('hud-xp-bar').style.width = `${Math.min(100, (st.xp / need) * 100)}%`;
  const cap = store.vehicleWaterCap();
  const wpct = Math.round((st.water / cap) * 100);
  $('hud-water-text').textContent = `${wpct}%`;
  $('hud-water-bar').style.width = `${wpct}%`;
  $('btn-mute').textContent = st.muted ? '🔇' : '🔊';
}

export function syncTime() {
  const ph = phaseLabel();
  $('hud-time-icon').textContent = ph.icon;
  $('hud-time').textContent = `${ph.name} · Day ${store.state.day}`;
}

// ---------------------------------------------------------------
//  Toasts
// ---------------------------------------------------------------
let toastSeen = {};
export function toast(msg, emoji = '✨', timeout = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="text-2xl">${emoji}</span><span>${msg}</span>`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, timeout);
}

function hint(msg) {
  const el = $('action-hint');
  if (!msg) { el.classList.add('hidden'); return; }
  el.textContent = msg; el.classList.remove('hidden');
}

// ---------------------------------------------------------------
//  Economy feedback wrappers
// ---------------------------------------------------------------
function gainCoins(n) { store.addCoins(n); audio.coin(); }
function gainXp(n) {
  const res = store.addXp(n);
  if (res.leveledUp) showLevelUp(res.newLevel);
}

function showLevelUp(level) {
  audio.levelUp();
  $('levelup-num').textContent = level;
  // unlock messaging
  const unlocked = Object.values(CROPS).filter((c) => c.unlockLevel === level).map((c) => `${c.emoji} ${c.name}`);
  $('levelup-reward').textContent = unlocked.length ? `Unlocked: ${unlocked.join(', ')}!` : 'Keep up the great farming! 🌟';
  openDialog('levelup');
  store.addCoins(20);
}

// ---------------------------------------------------------------
//  Core actions
// ---------------------------------------------------------------
function doAct() {
  if (anyDialogOpen()) return;
  const st = store.state;

  // Rest on the farmhouse mat (only on foot)
  if (st.activeVehicle === 'foot' && isOnMat()) return doRest();
  // Refill water at the well
  if (isNearWell()) { store.refillWater(); audio.water(); toast('Water tank refilled!', '💧'); return; }

  if (st.activeVehicle !== 'foot') { toast('Hop off to farm by hand!', '👟'); return; }

  const t = getActiveTile();
  if (!t) { toast('Stand next to a soil tile!', '🟫'); return; }

  if (t.state === 'grass') {
    tillTile(t); audio.till(); gainXp(1);
  } else if (t.state === 'tilled') {
    plantSeed(t);
  } else if (t.state === 'planted') {
    if (t.ripe) {
      const cropId = harvestTile(t);
      const c = CROPS[cropId];
      const bonus = t.watered > 1 ? Math.round(c.reward * 0.2) : 0;
      gainCoins(c.reward + bonus);
      gainXp(c.xp);
      audio.harvest();
      store.state.stats.harvested++;
      toast(`+${c.reward + bonus} 🪙  ${c.name}!`, c.emoji);
    } else {
      toast(`${CROPS[t.crop].emoji} still growing… water it!`, '⏳');
    }
  }
}

function plantSeed(t) {
  const c = CROPS[store.state.activeSeed];
  if (!store.isCropUnlocked(c.id)) { toast(`Reach Level ${c.unlockLevel} to plant ${c.name}`, '🔒'); return; }
  if (!store.spend(c.seedCost)) { toast('Not enough coins for seeds!', '🪙'); return; }
  plantTile(t, c.id); audio.plant(); gainXp(2);
  store.state.stats.planted++;
  toast(`Planted ${c.name} (-${c.seedCost} 🪙)`, c.emoji, 1400);
}

function doWater() {
  if (anyDialogOpen()) return;
  const st = store.state;
  if (st.water <= 0) { toast('Out of water! Visit the well 💧', '🪣'); return; }
  const t = getActiveTile();
  if (!t || t.state !== 'planted' || t.ripe) { toast('Aim at a growing plant to water it.', '💧'); return; }
  if (waterTile(t)) {
    store.useWater(10);
    audio.water();
    store.state.stats.watered++;
    // sprinkler upgrade waters neighbours
    if (st.upgrades.sprinkler) {
      scene.tiles.forEach((n) => {
        if (n !== t && Math.abs(n.r - t.r) <= 1 && Math.abs(n.c - t.c) <= 1) waterTile(n);
      });
    }
    syncHud();
  }
}

function doRest() {
  audio.sleep();
  store.set({ day: store.state.day + 1 });
  store.refillWater();
  setMorning();
  syncTime(); syncHud();
  toast(`Good morning! Day ${store.state.day} 🌅`, '😴');
}

// ---------------------------------------------------------------
//  Vehicle ride cycling
// ---------------------------------------------------------------
function cycleVehicle() {
  const order = ['foot', 'quad', 'tractor', 'truck'];
  const owned = order.filter((id) => store.state.vehicles[id]);
  const cur = owned.indexOf(store.state.activeVehicle);
  const next = owned[(cur + 1) % owned.length];
  mountVehicle(next);
}

export function mountVehicle(id) {
  store.set({ activeVehicle: id });
  setVehicle(id);
  store.refillWater();
  audio.click();
  audio.engine(id !== 'foot');
  const v = VEHICLES[id];
  toast(id === 'foot' ? 'Back on foot 👟' : `Riding the ${v.name}! ${v.emoji}`, v.emoji, 1400);
  syncHud();
}

// ---------------------------------------------------------------
//  Dialog plumbing
// ---------------------------------------------------------------
const DIALOGS = ['academy', 'garage', 'shop', 'howto', 'levelup'];
function anyDialogOpen() { return DIALOGS.some((d) => !$(d).classList.contains('hidden')); }
export function openDialog(id) { $(id).classList.remove('hidden'); audio.click(); }
export function closeDialog(id) { $(id).classList.add('hidden'); }
function closeAll() { DIALOGS.forEach(closeDialog); }

// ---------------------------------------------------------------
//  SHOP — seed selection & crop encyclopedia
// ---------------------------------------------------------------
function renderShop() {
  const st = store.state;
  const body = $('shop-body');
  body.innerHTML = `
    <p class="mb-3 text-slate-600">Pick a seed to plant. Higher levels unlock fancier crops!</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${Object.values(CROPS).map((c) => {
        const unlocked = store.isCropUnlocked(c.id);
        const active = st.activeSeed === c.id;
        return `
        <button data-seed="${c.id}" ${unlocked ? '' : 'disabled'}
          class="info-card text-left flex gap-3 items-center ${active ? 'ring-4 ring-farm-leaf' : ''} ${unlocked ? '' : 'opacity-50'}">
          <span class="text-4xl">${c.emoji}</span>
          <div class="flex-1">
            <div class="font-display text-lg">${c.name} ${active ? '✅' : ''}</div>
            <div class="text-sm text-slate-600">${unlocked ? c.fact : `🔒 Unlocks at Level ${c.unlockLevel}`}</div>
            <div class="text-xs mt-1 text-slate-500">Seed ${c.seedCost}🪙 → Sell ${c.reward}🪙 · +${c.xp}⭐</div>
          </div>
        </button>`;
      }).join('')}
    </div>`;
  body.querySelectorAll('[data-seed]').forEach((b) => b.addEventListener('click', () => {
    store.set({ activeSeed: b.dataset.seed });
    audio.click();
    toast(`Selected ${CROPS[b.dataset.seed].name} seeds`, CROPS[b.dataset.seed].emoji, 1200);
    renderShop(); renderSeedPicker();
  }));
}

// quick seed picker shown above toolbar
export function renderSeedPicker() {
  const picker = $('seed-picker');
  picker.innerHTML = Object.values(CROPS).filter((c) => store.isCropUnlocked(c.id)).map((c) => {
    const active = store.state.activeSeed === c.id;
    return `<button data-seed="${c.id}" class="w-12 h-12 rounded-chunky text-2xl ${active ? 'bg-farm-leaf/30 ring-2 ring-farm-leaf' : 'bg-white/70'}">${c.emoji}</button>`;
  }).join('');
  picker.querySelectorAll('[data-seed]').forEach((b) => b.addEventListener('click', () => {
    store.set({ activeSeed: b.dataset.seed }); audio.click(); renderSeedPicker(); renderShop();
  }));
}

// ---------------------------------------------------------------
//  GARAGE — vehicles + upgrades (buy / select / learn)
// ---------------------------------------------------------------
function renderGarage() {
  const st = store.state;
  const body = $('garage-body');
  body.innerHTML = `
    <h3 class="font-display text-lg mb-2">🚜 Vehicles</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      ${Object.values(VEHICLES).map((v) => {
        const owned = st.vehicles[v.id];
        const active = st.activeVehicle === v.id;
        const action = active
          ? `<span class="text-farm-leaf font-bold">In use ✅</span>`
          : owned
            ? `<button data-ride="${v.id}" class="btn-chunky bg-farm-leaf text-white px-4 py-2 text-sm">Ride</button>`
            : `<button data-buy="${v.id}" class="btn-chunky bg-farm-sun text-slate-800 px-4 py-2 text-sm">Buy ${v.cost}🪙</button>`;
        return `
        <div class="info-card flex gap-3">
          <span class="text-4xl">${v.emoji}</span>
          <div class="flex-1">
            <div class="font-display text-lg">${v.name}</div>
            <div class="text-sm text-slate-600">${v.job}</div>
            <div class="text-xs text-slate-500 mt-1">⚡ Speed ${v.speed} · 💧 Tank ${v.waterTank}</div>
            <div class="text-xs text-farm-leaf mt-1">💡 ${v.teaches}</div>
            <div class="mt-2">${action}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <h3 class="font-display text-lg mb-2">🔧 Attachments & Upgrades</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${Object.values(UPGRADES).map((u) => {
        const owned = st.upgrades[u.id];
        return `
        <div class="info-card text-center">
          <div class="text-3xl">${u.emoji}</div>
          <div class="font-display">${u.name}</div>
          <div class="text-xs text-slate-600 mb-2">${u.desc}</div>
          ${owned ? `<span class="text-farm-leaf font-bold text-sm">Owned ✅</span>`
                  : `<button data-up="${u.id}" class="btn-chunky bg-farm-sun text-slate-800 px-3 py-1.5 text-sm">Buy ${u.cost}🪙</button>`}
        </div>`;
      }).join('')}
    </div>`;

  body.querySelectorAll('[data-ride]').forEach((b) => b.addEventListener('click', () => { mountVehicle(b.dataset.ride); renderGarage(); }));
  body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const v = VEHICLES[b.dataset.buy];
    if (store.spend(v.cost)) {
      store.state.vehicles[v.id] = true; store.save(); audio.coin();
      toast(`Bought ${v.name}! ${v.emoji}`, '🎉'); renderGarage();
    } else toast('Not enough coins!', '🪙');
  }));
  body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
    const u = UPGRADES[b.dataset.up];
    if (store.spend(u.cost)) {
      store.state.upgrades[u.id] = true; store.save(); audio.coin();
      toast(`Bought ${u.name}! ${u.emoji}`, '🎉'); renderGarage(); syncHud();
    } else toast('Not enough coins!', '🪙');
  }));
}

// ---------------------------------------------------------------
//  ACADEMY — lesson list -> slides -> quiz
// ---------------------------------------------------------------
function renderAcademyList() {
  const st = store.state;
  const body = $('academy-body');
  body.innerHTML = `
    <p class="mb-3 text-slate-600">Finish a lesson and pass its quiz to earn coins and a medal! 🏅</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${LESSONS.map((l) => {
        const done = st.lessons[l.id];
        const medal = done ? (done.medal === 'gold' ? '🥇' : '🥈') : '';
        return `
        <button data-lesson="${l.id}" class="info-card text-left flex gap-3 items-center" style="border-color:${l.color}33">
          <span class="text-4xl">${l.emoji}</span>
          <div class="flex-1">
            <div class="font-display text-lg">${l.title} ${medal}</div>
            <div class="text-sm text-slate-600">${l.slides.length} slides · ${l.quiz.length} questions</div>
            <div class="text-xs text-farm-leaf mt-1">${done ? 'Completed — replay anytime!' : `Reward: ${l.reward}🪙 · +${l.xp}⭐`}</div>
          </div>
          <span class="text-2xl">${done ? '✅' : '▶️'}</span>
        </button>`;
      }).join('')}
    </div>`;
  body.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => startLesson(b.dataset.lesson)));
}

function startLesson(id) {
  const lesson = LESSONS.find((l) => l.id === id);
  let slide = 0;
  let qIndex = 0;
  let mistakes = 0;
  const body = $('academy-body');

  function showSlide() {
    const s = lesson.slides[slide];
    body.innerHTML = `
      <div class="text-center animate-pop">
        <div class="text-7xl mb-3">${s.emoji}</div>
        <h3 class="font-display text-2xl mb-2" style="color:${lesson.color}">${s.title}</h3>
        <p class="text-lg text-slate-700 max-w-md mx-auto">${s.text}</p>
      </div>
      <div class="flex justify-center gap-2 my-5">
        ${lesson.slides.map((_, i) => `<span class="slide-dot ${i === slide ? 'active' : ''}"></span>`).join('')}
      </div>
      <div class="flex justify-between">
        <button id="ac-back" class="btn-chunky bg-white text-slate-600 px-5 py-2 ${slide === 0 ? 'invisible' : ''}">← Back</button>
        <button id="ac-next" class="btn-chunky bg-farm-leaf text-white px-6 py-2">${slide === lesson.slides.length - 1 ? 'Start Quiz! ✏️' : 'Next →'}</button>
      </div>`;
    $('ac-back').onclick = () => { if (slide > 0) { slide--; audio.click(); showSlide(); } };
    $('ac-next').onclick = () => {
      audio.click();
      if (slide < lesson.slides.length - 1) { slide++; showSlide(); }
      else showQuestion();
    };
  }

  function showQuestion() {
    const q = lesson.quiz[qIndex];
    body.innerHTML = `
      <div class="text-center mb-4">
        <div class="text-sm text-slate-500 mb-1">Question ${qIndex + 1} of ${lesson.quiz.length}</div>
        <h3 class="font-display text-xl">${q.q}</h3>
        ${q.hint ? `<p class="text-xs text-slate-400 mt-1">💡 ${q.hint}</p>` : ''}
      </div>
      <div class="space-y-2" id="ac-opts">
        ${q.options.map((o, i) => `<button class="quiz-opt" data-opt="${i}">${o}</button>`).join('')}
      </div>`;
    body.querySelectorAll('[data-opt]').forEach((btn) => btn.addEventListener('click', () => {
      const chosen = +btn.dataset.opt;
      const correct = chosen === q.answer;
      body.querySelectorAll('[data-opt]').forEach((b) => { b.disabled = true; });
      if (correct) {
        btn.classList.add('correct'); audio.correct();
      } else {
        btn.classList.add('wrong'); mistakes++; audio.wrong();
        body.querySelector(`[data-opt="${q.answer}"]`).classList.add('correct');
      }
      setTimeout(() => {
        qIndex++;
        if (qIndex < lesson.quiz.length) showQuestion();
        else finish();
      }, 1100);
    }));
  }

  function finish() {
    const st = store.state;
    const firstTime = !st.lessons[lesson.id];
    const medal = mistakes === 0 ? 'gold' : 'silver';
    st.lessons[lesson.id] = { completed: true, medal };
    if (firstTime) st.stats.lessonsDone++;
    const reward = firstTime ? lesson.reward : 5;
    store.addCoins(reward);
    const xpRes = store.addXp(firstTime ? lesson.xp : 5);
    audio.levelUp();
    body.innerHTML = `
      <div class="text-center animate-pop py-4">
        <div class="text-7xl mb-2">${medal === 'gold' ? '🥇' : '🥈'}</div>
        <h3 class="font-display text-2xl">${mistakes === 0 ? 'Perfect Score!' : 'Well Done!'}</h3>
        <p class="text-lg mt-1">You earned <b>${reward} 🪙</b> and <b>${firstTime ? lesson.xp : 5} ⭐</b></p>
        <p class="text-slate-500 text-sm mt-1">${mistakes === 0 ? 'No mistakes — amazing!' : `${mistakes} little mistake${mistakes > 1 ? 's' : ''}, keep practising!`}</p>
        <div class="flex gap-2 justify-center mt-5">
          <button id="ac-again" class="btn-chunky bg-white text-slate-600 px-5 py-2">🔁 Replay</button>
          <button id="ac-done" class="btn-chunky bg-farm-leaf text-white px-6 py-2">📚 More Lessons</button>
        </div>
      </div>`;
    $('ac-again').onclick = () => startLesson(lesson.id);
    $('ac-done').onclick = () => renderAcademyList();
    if (xpRes.leveledUp) setTimeout(() => showLevelUp(xpRes.newLevel), 600);
  }

  showSlide();
}

// ---------------------------------------------------------------
//  Toolbar wiring
// ---------------------------------------------------------------
function setActiveToolbar(action) {
  $$('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.action === action));
}

function initToolbar() {
  $$('.tool-btn').forEach((btn) => btn.addEventListener('click', () => {
    audio.resume();
    const a = btn.dataset.action;
    if (a === 'act') doAct();
    else if (a === 'water') doWater();
    else if (a === 'vehicle') cycleVehicle();
    else if (a === 'shop') { renderShop(); openDialog('shop'); }
    else if (a === 'garage') { renderGarage(); openDialog('garage'); }
    else if (a === 'academy') { renderAcademyList(); openDialog('academy'); }
  }));

  // close buttons
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => { closeDialog(b.dataset.close); audio.click(); }));
  // click backdrop to close
  DIALOGS.forEach((d) => $(d).addEventListener('click', (e) => { if (e.target.id === d) closeDialog(d); }));

  $('btn-mute').addEventListener('click', toggleMute);
}

function toggleMute() {
  store.set({ muted: !store.state.muted });
  audio.engine(store.state.activeVehicle !== 'foot');
  syncHud();
  toast(store.state.muted ? 'Sound off' : 'Sound on', store.state.muted ? '🔇' : '🔊', 1000);
}

// ---------------------------------------------------------------
//  Public init — wires everything & shows gameplay HUD
// ---------------------------------------------------------------
export function initUI() {
  initInput();
  initToolbar();
  store.subscribe(syncHud);
  syncHud();
  renderSeedPicker();

  // contextual hint loop driver is called from main via updateHints()
}

// Called every frame from main to keep contextual hint fresh.
let hintThrottle = 0;
export function updateHints(dt) {
  hintThrottle += dt;
  if (hintThrottle < 0.15) return;
  hintThrottle = 0;
  if (anyDialogOpen()) { hint(null); return; }
  const st = store.state;
  if (st.activeVehicle === 'foot' && isOnMat()) return hint('Press ✋ Act to Rest & start a new day');
  if (isNearWell()) return hint('Press ✋ Act to refill water');
  if (st.activeVehicle !== 'foot') { hint(null); return; }
  const t = getActiveTile();
  if (!t) { hint(null); return; }
  if (t.state === 'grass') hint('✋ Act to till the soil');
  else if (t.state === 'tilled') hint(`✋ Act to plant ${CROPS[st.activeSeed].emoji}`);
  else if (t.state === 'planted') hint(t.ripe ? '✋ Act to harvest! 🎉' : '💧 Water to grow faster');
}

export function showGameUI() {
  $('hud').classList.remove('hidden');
  $('toolbar').classList.remove('hidden');
  $('joystick').classList.remove('hidden');
  $('seed-picker').classList.remove('hidden');
  setActiveToolbar(null);
  syncTime();
}
