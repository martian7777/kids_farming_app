// =============================================================
//  three_scene.js — 3D world, player, vehicles, tiles, day/night
// =============================================================
import * as THREE from 'three';
import { store, CROPS, VEHICLES } from './state.js';

const FIELD = 6;          // tiles per side
const TILE = 2.2;         // world units per tile
const HALF = (FIELD * TILE) / 2;

export const scene = {
  three: null, camera: null, renderer: null,
  player: null, vehicleMesh: null,
  tiles: [], highlight: null,
  sun: null, hemi: null, ambient: null, sky: null, fog: null,
  facing: new THREE.Vector3(0, 0, 1),
  hooks: {},
  _matPos: new THREE.Vector3(0, 0, 0),
  _wellPos: new THREE.Vector3(0, 0, 0),
  _walkPhase: 0,
  _riding: 'foot',
};

let canvas, world, legL, legR, armR, toolGroup;

// ---------------------------------------------------------------
//  Setup
// ---------------------------------------------------------------
export function initScene(canvasEl) {
  canvas = canvasEl;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.renderer = renderer;

  const three = new THREE.Scene();
  three.background = new THREE.Color(0xbfe6ff);
  three.fog = new THREE.Fog(0xbfe6ff, 30, 70);
  scene.three = three;
  scene.fog = three.fog;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 12, 16);
  scene.camera = camera;

  // Lights
  scene.ambient = new THREE.AmbientLight(0xffffff, 0.55);
  three.add(scene.ambient);
  scene.hemi = new THREE.HemisphereLight(0xbfe6ff, 0x86d36b, 0.8);
  three.add(scene.hemi);
  scene.sun = new THREE.DirectionalLight(0xfff4d6, 1.1);
  scene.sun.position.set(12, 20, 8);
  scene.sun.castShadow = true;
  scene.sun.shadow.mapSize.set(2048, 2048);
  const s = scene.sun.shadow.camera;
  s.left = -30; s.right = 30; s.top = 30; s.bottom = -30; s.near = 1; s.far = 80;
  three.add(scene.sun);
  three.add(scene.sun.target);

  buildGround(three);
  buildField(three);
  buildFarmhouse(three);
  buildWell(three);
  buildFences(three);
  buildDecor(three);
  buildPlayer(three);
  buildHighlight(three);

  resize();
  window.addEventListener('resize', resize);
  return scene;
}

function resize() {
  if (!scene.renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  scene.renderer.setSize(w, h);
  scene.camera.aspect = w / h;
  scene.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------
//  World building helpers
// ---------------------------------------------------------------
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.r ?? 0.9, metalness: opts.m ?? 0.0, ...opts });
}

function buildGround(three) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(60, 48), mat(0x86d36b));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  three.add(g);

  // a darker patch under the field
  const patch = new THREE.Mesh(new THREE.BoxGeometry(FIELD * TILE + 1, 0.2, FIELD * TILE + 1), mat(0x6fae57));
  patch.position.y = 0.02;
  patch.receiveShadow = true;
  three.add(patch);
}

function buildField(three) {
  world = new THREE.Group();
  three.add(world);
  const tileGeo = new THREE.BoxGeometry(TILE * 0.92, 0.25, TILE * 0.92);
  for (let r = 0; r < FIELD; r++) {
    for (let c = 0; c < FIELD; c++) {
      const m = new THREE.Mesh(tileGeo, mat(0x7bbd61));
      const x = -HALF + TILE / 2 + c * TILE;
      const z = -HALF + TILE / 2 + r * TILE;
      m.position.set(x, 0.13, z);
      m.receiveShadow = true;
      three.add(m);
      const tile = {
        mesh: m, x, z, r, c,
        state: 'grass',     // grass | tilled | planted
        crop: null, progress: 0, stage: 0, watered: 0, ripe: false,
        plant: null,
      };
      m.userData.tile = tile;
      scene.tiles.push(tile);
    }
  }
}

function buildFarmhouse(three) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 4), mat(0xfbe3b3));
  body.position.y = 1.7; body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2.2, 4), mat(0xc44536));
  roof.position.y = 4.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), mat(0x8a5a3b));
  door.position.set(0, 1, 2.05);
  g.add(body, roof, door);
  g.position.set(-HALF - 6, 0, -HALF - 2);
  g.rotation.y = 0.5;
  three.add(g);

  // Welcome mat (rest spot) in front of the door, in world coords
  const matMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.6), mat(0x6c8ea4));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.25), mat(0xf1faff));
  stripe.position.y = 0.02;
  matMesh.add(stripe);
  const local = new THREE.Vector3(0, 0.06, 3.2);
  local.applyEuler(g.rotation).add(g.position);
  matMesh.position.copy(local);
  matMesh.rotation.y = g.rotation.y;
  matMesh.receiveShadow = true;
  three.add(matMesh);
  scene._matPos.copy(matMesh.position);

  // little Zzz sprite shown while resting (hidden by default)
  const matEmoji = makeEmojiSprite('🛏️', 1.4);
  matEmoji.position.copy(matMesh.position).add(new THREE.Vector3(0, 1.0, 0));
  three.add(matEmoji);
}

function buildWell(three) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1.2, 16), mat(0x9aa6b2));
  base.position.y = 0.6; base.castShadow = true;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16), mat(0x4aa3e0, { r: 0.3 }));
  water.position.y = 1.15;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1, 4), mat(0x8a5a3b));
  roof.position.y = 2.6; roof.rotation.y = Math.PI / 4;
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2), mat(0x8a5a3b));
  p1.position.set(-0.9, 1.6, 0);
  const p2 = p1.clone(); p2.position.x = 0.9;
  g.add(base, water, roof, p1, p2);
  g.position.set(HALF + 4, 0, -HALF);
  three.add(g);
  scene._wellPos.copy(g.position);

  const drop = makeEmojiSprite('💧', 1.2);
  drop.position.copy(g.position).add(new THREE.Vector3(0, 3.4, 0));
  three.add(drop);
}

function buildFences(three) {
  const postGeo = new THREE.BoxGeometry(0.2, 1, 0.2);
  const railGeo = new THREE.BoxGeometry(TILE, 0.12, 0.12);
  const m = mat(0xb98b5e);
  const edge = HALF + 0.6;
  for (let i = 0; i <= FIELD; i++) {
    const p = -HALF + i * TILE;
    [[p, edge], [p, -edge], [edge, p], [-edge, p]].forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeo, m);
      post.position.set(x, 0.5, z); post.castShadow = true; three.add(post);
    });
  }
  for (let i = 0; i < FIELD; i++) {
    const p = -HALF + TILE / 2 + i * TILE;
    const top = new THREE.Mesh(railGeo, m); top.position.set(p, 0.8, edge); three.add(top);
    const bot = top.clone(); bot.position.z = -edge; three.add(bot);
    const left = new THREE.Mesh(railGeo, m); left.rotation.y = Math.PI / 2; left.position.set(-edge, 0.8, p); three.add(left);
    const right = left.clone(); right.position.x = edge; three.add(right);
  }
}

function buildDecor(three) {
  const treeSpots = [[HALF + 8, HALF + 6], [-HALF - 9, HALF + 4], [HALF + 6, -HALF - 8], [-HALF - 4, -HALF - 9]];
  treeSpots.forEach(([x, z]) => three.add(makeTree(x, z)));
  // a few clouds
  for (let i = 0; i < 5; i++) {
    const cloud = makeCloud();
    cloud.position.set((Math.random() - 0.5) * 60, 14 + Math.random() * 5, (Math.random() - 0.5) * 60);
    cloud.userData.drift = 0.4 + Math.random() * 0.4;
    three.add(cloud);
    clouds.push(cloud);
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  sun.position.set(-20, 22, -30);
  three.add(sun);
  scene.sky = sun;
}
const clouds = [];

function makeTree(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.4), mat(0x8a5a3b));
  trunk.position.y = 1.2; trunk.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), mat(0x3fa34d));
  leaves.position.y = 3.2; leaves.castShadow = true;
  const leaves2 = leaves.clone(); leaves2.scale.set(0.7, 0.7, 0.7); leaves2.position.set(0.8, 2.6, 0.4);
  g.add(trunk, leaves, leaves2);
  g.position.set(x, 0, z);
  return g;
}

function makeCloud() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 8, 8), m);
    puff.position.set(i * 1.2 - 1.8, Math.random() * 0.4, Math.random() * 0.6);
    g.add(puff);
  }
  return g;
}

function makeEmojiSprite(emoji, size = 1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = '96px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(size, size, size);
  return spr;
}

// ---------------------------------------------------------------
//  Player (farmer) + tool
// ---------------------------------------------------------------
function buildPlayer(three) {
  const g = new THREE.Group();
  const skin = mat(0xffd9a0), shirt = mat(0x4f9dde), pants = mat(0x3c5a8a), hat = mat(0xe9c46a);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.45), shirt);
  torso.position.y = 1.15; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skin);
  head.position.y = 1.85; head.castShadow = true;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), hat);
  brim.position.y = 2.05;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 16), hat);
  top.position.y = 2.2;

  legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.24), pants);
  legL.position.set(-0.18, 0.4, 0); legL.castShadow = true;
  legR = legL.clone(); legR.position.x = 0.18;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), shirt);
  armL.position.set(-0.48, 1.2, 0);
  armR = armL.clone(); armR.position.x = 0.48;

  // tool in the right hand (hidden unless acting)
  toolGroup = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), mat(0x8a5a3b));
  handle.position.y = -0.1;
  const headTool = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.15), mat(0xb0b0b0, { m: 0.4, r: 0.4 }));
  headTool.position.y = 0.35;
  toolGroup.add(handle, headTool);
  toolGroup.position.set(0.5, 1.0, 0.1);
  toolGroup.visible = false;

  g.add(torso, head, brim, top, legL, legR, armL, armR, toolGroup);
  g.position.set(0, 0, HALF + 3);
  three.add(g);
  scene.player = g;
}

function buildHighlight(three) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TILE * 0.42, TILE * 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.28;
  ring.visible = false;
  three.add(ring);
  scene.highlight = ring;
}

// ---------------------------------------------------------------
//  Vehicles
// ---------------------------------------------------------------
function makeVehicle(id) {
  const g = new THREE.Group();
  const wheelMat = mat(0x222222, { r: 0.7 });
  const wheel = (r) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 16), wheelMat);

  if (id === 'tractor') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 2.2), mat(0x2e9e4f));
    body.position.y = 0.9;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1), mat(0x1f7a3a));
    cab.position.set(0, 1.6, -0.4);
    const fr = wheel(0.5); fr.rotation.z = Math.PI / 2; fr.position.set(0.8, 0.5, 0.7);
    const fl = fr.clone(); fl.position.x = -0.8;
    const br = wheel(0.8); br.rotation.z = Math.PI / 2; br.position.set(0.85, 0.8, -0.7);
    const bl = br.clone(); bl.position.x = -0.85;
    g.add(body, cab, fr, fl, br, bl);
  } else if (id === 'quad') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.8), mat(0xe63946));
    body.position.y = 0.7;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.8), mat(0x222222));
    seat.position.set(0, 1.0, 0);
    [[0.65, 0.7], [-0.65, 0.7], [0.65, -0.7], [-0.65, -0.7]].forEach(([x, z]) => {
      const w = wheel(0.45); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w);
    });
    g.add(body, seat);
  } else { // truck
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.6), mat(0x2a6fdb));
    body.position.set(0, 0.9, 0.4);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.4), mat(0x9aa6b2));
    bed.position.set(0, 0.8, -0.9);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), mat(0x1f5bbf));
    cab.position.set(0, 1.5, 0.5);
    [[0.8, 0.7], [-0.8, 0.7], [0.8, -0.9], [-0.8, -0.9]].forEach(([x, z]) => {
      const w = wheel(0.5); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w);
    });
    g.add(body, bed, cab);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function setVehicle(id) {
  scene._riding = id;
  if (scene.vehicleMesh) { scene.three.remove(scene.vehicleMesh); scene.vehicleMesh = null; }
  if (id !== 'foot') {
    scene.vehicleMesh = makeVehicle(id);
    scene.three.add(scene.vehicleMesh);
    // farmer "sits" higher and stops leg-swinging when riding
    scene.player.visible = id === 'foot';
  } else {
    scene.player.visible = true;
  }
}

// ---------------------------------------------------------------
//  Gameplay queries & tile actions
// ---------------------------------------------------------------
export function getActiveTile() {
  // a point slightly in front of the player
  const p = scene.player.position;
  const ahead = scene._tmpAhead || (scene._tmpAhead = new THREE.Vector3());
  ahead.copy(p).addScaledVector(scene.facing, 1.0);
  let best = null, bestD = 1.6 * 1.6;
  for (const t of scene.tiles) {
    const dx = t.x - ahead.x, dz = t.z - ahead.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

export function tillTile(t) {
  if (!t || t.state !== 'grass') return false;
  t.state = 'tilled';
  t.mesh.material = mat(0x8a5a3b);
  swingTool();
  return true;
}

export function plantTile(t, cropId) {
  if (!t || t.state !== 'tilled') return false;
  const crop = CROPS[cropId];
  t.state = 'planted'; t.crop = cropId; t.progress = 0; t.stage = 0; t.watered = 0; t.ripe = false;
  const plant = makePlant(crop);
  plant.position.set(t.x, 0.26, t.z);
  plant.scale.setScalar(0.25);
  scene.three.add(plant);
  t.plant = plant;
  swingTool();
  return true;
}

export function waterTile(t) {
  if (!t || t.state !== 'planted' || t.ripe) return false;
  t.watered += 1;
  // wet soil look
  t.mesh.material = mat(0x5e3d28);
  splash(t.x, t.z);
  return true;
}

export function harvestTile(t) {
  if (!t || t.state !== 'planted' || !t.ripe) return false;
  const cropId = t.crop;
  if (t.plant) { scene.three.remove(t.plant); t.plant = null; }
  t.state = 'grass'; t.crop = null; t.progress = 0; t.ripe = false; t.watered = 0;
  t.mesh.material = mat(0x7bbd61);
  popEffect(t.x, t.z, CROPS[cropId].emoji);
  return cropId;
}

export function isOnMat() {
  return scene.player.position.distanceTo(scene._matPos) < 2.0;
}
export function isNearWell() {
  return scene.player.position.distanceTo(scene._wellPos) < 4.0;
}

function makePlant(crop) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8), mat(0x4f9d3a));
  stem.position.y = 0.4;
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat(0x6cc24a));
  leaf.position.y = 0.85;
  g.add(stem, leaf);
  g.userData.fruitMat = mat(crop.color, { r: 0.5 });
  g.userData.crop = crop;
  return g;
}

function makeFruit(plant) {
  const crop = plant.userData.crop;
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), plant.userData.fruitMat);
    const a = (i / 3) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.3, 0.95 + Math.sin(i) * 0.1, Math.sin(a) * 0.3);
    f.castShadow = true;
    plant.add(f);
  }
  const spr = makeEmojiSprite(crop.emoji, 0.7);
  spr.position.y = 1.7;
  spr.userData.bob = true;
  plant.add(spr);
}

// ---------------------------------------------------------------
//  Transient effects
// ---------------------------------------------------------------
const effects = [];
function splash(x, z) {
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x6ec6ff }));
    d.position.set(x, 0.4, z);
    const v = new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2);
    scene.three.add(d);
    effects.push({ m: d, v, life: 0.7 });
  }
}
function popEffect(x, z, emoji) {
  const spr = makeEmojiSprite(emoji, 1);
  spr.position.set(x, 1, z);
  scene.three.add(spr);
  effects.push({ m: spr, v: new THREE.Vector3(0, 2.5, 0), life: 1.0, fade: true });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    e.m.position.addScaledVector(e.v, dt);
    e.v.y -= 6 * dt;
    if (e.fade && e.m.material) e.m.material.opacity = Math.max(0, e.life);
    if (e.life <= 0) { scene.three.remove(e.m); effects.splice(i, 1); }
  }
}

let toolSwing = 0;
function swingTool() { toolSwing = 0.4; toolGroup.visible = true; }

// ---------------------------------------------------------------
//  Main update
// ---------------------------------------------------------------
export function updateScene(dt, input) {
  const st = store.state;
  const veh = VEHICLES[st.activeVehicle];

  // ---- Movement ----
  const len = Math.hypot(input.x, input.y);
  const moving = len > 0.05;
  if (moving) {
    const nx = input.x / Math.max(len, 1), nz = input.y / Math.max(len, 1);
    const speed = veh.speed * (len > 1 ? 1 : len);
    scene.player.position.x = clamp(scene.player.position.x + nx * speed * dt, -HALF - 12, HALF + 12);
    scene.player.position.z = clamp(scene.player.position.z + nz * speed * dt, -HALF - 12, HALF + 12);
    scene.facing.set(nx, 0, nz).normalize();
    const targetRot = Math.atan2(nx, nz);
    scene.player.rotation.y = lerpAngle(scene.player.rotation.y, targetRot, 0.2);
  }

  // ---- Walk / engine animation ----
  if (st.activeVehicle === 'foot') {
    if (moving) {
      scene._walkPhase += dt * 10;
      legL.rotation.x = Math.sin(scene._walkPhase) * 0.6;
      legR.rotation.x = -Math.sin(scene._walkPhase) * 0.6;
    } else {
      legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
    }
  } else if (scene.vehicleMesh) {
    scene.vehicleMesh.position.copy(scene.player.position);
    scene.vehicleMesh.rotation.y = scene.player.rotation.y;
    // wheels spin
    scene.vehicleMesh.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'CylinderGeometry') o.rotation.x += (moving ? 8 : 0) * dt;
    });
  }

  // tool swing decay
  if (toolSwing > 0) {
    toolSwing -= dt;
    toolGroup.rotation.x = -Math.sin((0.4 - toolSwing) / 0.4 * Math.PI) * 1.5;
    if (toolSwing <= 0) { toolGroup.visible = false; toolGroup.rotation.x = 0; }
  }

  // ---- Vehicle auto-actions (drive-by) ----
  if (moving && veh.autoPlant) autoTill();
  if (moving && veh.autoHarvest) autoHarvest();

  // ---- Crop growth ----
  growCrops(dt);

  // ---- Highlight nearest interactable tile (only on foot) ----
  const t = st.activeVehicle === 'foot' ? getActiveTile() : null;
  if (t) {
    scene.highlight.visible = true;
    scene.highlight.position.set(t.x, 0.28, t.z);
    const c = t.ripe ? 0xffd34e : (t.state === 'tilled' ? 0xfff1c2 : 0xffffff);
    scene.highlight.material.color.setHex(c);
  } else {
    scene.highlight.visible = false;
  }
  scene.activeTile = t;

  // ---- Day / night ----
  updateDayNight(dt);

  // ---- Effects & clouds ----
  updateEffects(dt);
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 40) cloud.position.x = -40;
  }
  // bob fruit sprites
  scene.three.traverse((o) => { if (o.isSprite && o.userData.bob) o.position.y = 1.6 + Math.sin(performance.now() / 300) * 0.08; });

  // ---- Camera follow ----
  const p = scene.player.position;
  const camTarget = scene._camT || (scene._camT = new THREE.Vector3());
  camTarget.set(p.x, 11, p.z + 14);
  scene.camera.position.lerp(camTarget, 0.08);
  scene.camera.lookAt(p.x, 1, p.z);

  scene.renderer.render(scene.three, scene.camera);
}

function autoTill() {
  const t = getTileUnderPlayer();
  if (t && t.state === 'grass') { tillTile(t); plantTile(t, store.state.activeSeed); }
}
function autoHarvest() {
  const t = getTileUnderPlayer();
  if (t && t.ripe) {
    const cropId = harvestTile(t);
    if (cropId && scene.hooks.onAutoHarvest) scene.hooks.onAutoHarvest(cropId);
  }
}
function getTileUnderPlayer() {
  const p = scene.player.position;
  let best = null, bestD = (TILE * 0.6) ** 2;
  for (const t of scene.tiles) {
    const dx = t.x - p.x, dz = t.z - p.z, d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function growCrops(dt) {
  const mult = store.growthMultiplier();
  for (const t of scene.tiles) {
    if (t.state !== 'planted' || t.ripe) continue;
    const crop = CROPS[t.crop];
    // watered crops grow at full speed, dry crops grow slowly
    const waterBoost = t.watered > 0 ? 1 : 0.4;
    t.progress += (dt / (crop.growTime * mult)) * waterBoost;
    if (t.plant) {
      const s = 0.25 + Math.min(t.progress, 1) * 0.9;
      t.plant.scale.setScalar(s);
    }
    if (t.progress >= 1 && !t.ripe) {
      t.ripe = true;
      if (t.plant) makeFruit(t.plant);
      if (scene.hooks.onRipe) scene.hooks.onRipe(t.crop);
    }
  }
}

// ---------------------------------------------------------------
//  Day / night cycle
// ---------------------------------------------------------------
const SKY_DAY = new THREE.Color(0xbfe6ff);
const SKY_SUNSET = new THREE.Color(0xffb27a);
const SKY_NIGHT = new THREE.Color(0x1b2452);

export function updateDayNight(dt) {
  const st = store.state;
  // advance time slowly: a full game-day ~ 4 real minutes
  st.timeOfDay = (st.timeOfDay + dt / 240) % 1;
  applyTime();
}

export function applyTime() {
  const t = store.state.timeOfDay; // 0..1
  // brightness curve: dark at 0/1, bright at 0.5
  const day = Math.max(0, Math.sin(t * Math.PI));
  let sky;
  if (t < 0.25) sky = SKY_NIGHT.clone().lerp(SKY_DAY, t / 0.25);
  else if (t < 0.6) sky = SKY_DAY.clone();
  else if (t < 0.8) sky = SKY_DAY.clone().lerp(SKY_SUNSET, (t - 0.6) / 0.2);
  else sky = SKY_SUNSET.clone().lerp(SKY_NIGHT, (t - 0.8) / 0.2);

  scene.three.background.copy(sky);
  scene.fog.color.copy(sky);
  scene.sun.intensity = 0.25 + day * 1.0;
  scene.sun.color.setHSL(0.1, 0.6, 0.5 + day * 0.4);
  scene.ambient.intensity = 0.3 + day * 0.4;
  scene.hemi.intensity = 0.3 + day * 0.6;
  // move sun across the sky
  const ang = t * Math.PI * 2 - Math.PI / 2;
  scene.sun.position.set(Math.cos(ang) * 20, Math.max(2, Math.sin(ang) * 22), 8);
  if (scene.sky) {
    scene.sky.position.set(Math.cos(ang) * 28, Math.sin(ang) * 24, -30);
    scene.sky.visible = day > 0.05;
  }
}

export function phaseLabel() {
  const t = store.state.timeOfDay;
  if (t < 0.22) return { icon: '🌙', name: 'Night' };
  if (t < 0.33) return { icon: '🌅', name: 'Morning' };
  if (t < 0.6) return { icon: '☀️', name: 'Midday' };
  if (t < 0.8) return { icon: '🌇', name: 'Sunset' };
  return { icon: '🌙', name: 'Night' };
}

// reset to a fresh morning (used after resting)
export function setMorning() { store.state.timeOfDay = 0.28; applyTime(); }

// ---------------------------------------------------------------
//  Math helpers
// ---------------------------------------------------------------
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
