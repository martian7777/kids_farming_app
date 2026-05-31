// =============================================================
//  main.js — Bootstrap: scene, audio, UI, and the game loop
// =============================================================
import './style.css';
import { initScene, updateScene, scene, applyTime } from './game/three_scene.js';
import { initUI, getInput, showGameUI, syncTime, updateHints, toast } from './game/ui.js';
import { audio } from './game/audio.js';
import { store, CROPS } from './game/state.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------
//  Boot sequence
// ---------------------------------------------------------------
function boot() {
  const canvas = $('scene');
  initScene(canvas);
  applyTime();
  initUI();

  // Wire scene hooks for crop ripeness + vehicle auto-harvest
  scene.hooks.onRipe = (cropId) => toast(`${CROPS[cropId].emoji} ${CROPS[cropId].name} is ready!`, '🌟', 1800);
  scene.hooks.onAutoHarvest = (cropId) => {
    const c = CROPS[cropId];
    store.addCoins(c.reward); store.addXp(c.xp); audio.harvest();
    store.state.stats.harvested++;
    toast(`Auto-harvest +${c.reward}🪙`, c.emoji, 1200);
  };

  runLoader();
  startLoop();
}

// Fake-but-friendly loader progress, then reveal start menu.
function runLoader() {
  const bar = $('loader-bar');
  const text = $('loader-text');
  const msgs = ['Waking up the chickens…', 'Watering the seeds…', 'Painting the sky…', 'Polishing the tractor…', 'Ready!'];
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(100, p + 8 + Math.random() * 14);
    bar.style.width = p + '%';
    text.textContent = msgs[Math.min(msgs.length - 1, Math.floor(p / 22))];
    if (p >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        $('loader').classList.add('hidden');
        $('start-menu').classList.remove('hidden');
        $('start-menu').classList.add('flex');
      }, 400);
    }
  }, 220);
}

// ---------------------------------------------------------------
//  Start menu buttons
// ---------------------------------------------------------------
function initMenu() {
  const start = async () => {
    await audio.init();
    audio.click();
    scene.gameStarted = true;
    $('start-menu').classList.add('hidden');
    $('start-menu').classList.remove('flex');
    showGameUI();
    toast('Welcome to your farm! 🌻', '👋', 2600);
  };
  
  $('btn-play').addEventListener('click', start);
  if ($('btn-play-nav')) {
    $('btn-play-nav').addEventListener('click', start);
  }
  
  $('btn-howto').addEventListener('click', () => { $('howto').classList.remove('hidden'); });
  $('btn-mute-menu').addEventListener('click', () => {
    store.set({ muted: !store.state.muted });
    $('btn-mute-menu').textContent = store.state.muted ? '🔇 Sound' : '🔊 Sound';
  });
}

// ---------------------------------------------------------------
//  Game loop
// ---------------------------------------------------------------
let last = performance.now();
function startLoop() {
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateScene(dt, getInput());
    updateHints(dt);
    syncTime();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

initMenu();
boot();
