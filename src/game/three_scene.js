// =============================================================
//  three_scene.js — 3D world, player, vehicles, tiles, day/night
// =============================================================
import * as THREE from 'three';
import { store, CROPS, VEHICLES, ANIMAL_TYPES } from './state.js';

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
  _windmillPos: new THREE.Vector3(-12.6, 0, -14.6),
  _greenhousePos: new THREE.Vector3(-13.6, 0, 0),
  _beehivePos: new THREE.Vector3(12.6, 0, -10.6),
  _walkPhase: 0,
  _riding: 'foot',
  animals: [],
  gameStarted: false,
  windmillSails: null,
  bees: [],
  _honeyTimer: 0,
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
  buildAnimalPen(three);
  buildWindmill(three);
  buildGreenhouse(three);
  buildBeehive(three);
  buildFences(three);
  buildDecor(three);
  buildPlayer(three);
  buildHighlight(three);

  // Sync initial animals if already owned
  setTimeout(() => syncAnimals(), 100);

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

function buildAnimalPen(three) {
  // Pen area is x from 7.5 to 14.5, z from 1 to 8.
  // Center of pen: x = 11, z = 4.5. Size: 7 x 7.
  const m = mat(0xffffff, { r: 0.9 }); // White painted wood
  const postGeo = new THREE.BoxGeometry(0.16, 0.8, 0.16);
  const railGeo = new THREE.BoxGeometry(7, 0.08, 0.08);

  // Spawn posts at corners and middle
  const corners = [
    [7.5, 1], [14.5, 1], [14.5, 8], [7.5, 8],
    [11.0, 1], [14.5, 4.5], [11.0, 8], [7.5, 4.5]
  ];
  corners.forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeo, m);
    post.position.set(x, 0.4, z);
    post.castShadow = true;
    three.add(post);
  });

  // North rail
  const railN1 = new THREE.Mesh(railGeo, m); railN1.position.set(11.0, 0.6, 1); three.add(railN1);
  const railN2 = railN1.clone(); railN2.position.y = 0.3; three.add(railN2);

  // South rail
  const railS1 = new THREE.Mesh(railGeo, m); railS1.position.set(11.0, 0.6, 8); three.add(railS1);
  const railS2 = railS1.clone(); railS2.position.y = 0.3; three.add(railS2);

  // East rail
  const railE1 = new THREE.Mesh(railGeo, m); railE1.rotation.y = Math.PI / 2; railE1.position.set(14.5, 0.6, 4.5); three.add(railE1);
  const railE2 = railE1.clone(); railE2.position.y = 0.3; three.add(railE2);

  // West rail with gate opening
  const shortRailGeo = new THREE.BoxGeometry(2, 0.08, 0.08);
  const railW1_top = new THREE.Mesh(shortRailGeo, m); railW1_top.rotation.y = Math.PI / 2; railW1_top.position.set(7.5, 0.6, 2.0); three.add(railW1_top);
  const railW1_bot = railW1_top.clone(); railW1_bot.position.y = 0.3; three.add(railW1_bot);
  const railW2_top = new THREE.Mesh(shortRailGeo, m); railW2_top.rotation.y = Math.PI / 2; railW2_top.position.set(7.5, 0.6, 7.0); three.add(railW2_top);
  const railW2_bot = railW2_top.clone(); railW2_bot.position.y = 0.3; three.add(railW2_bot);

  // Red Barn
  const barn = new THREE.Group();
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.0), mat(0xc44536));
  barnBody.position.y = 0.9; barnBody.castShadow = true;
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.0, 4), mat(0xffffff));
  barnRoof.position.y = 2.3; barnRoof.rotation.y = Math.PI / 4; barnRoof.castShadow = true;
  const barnDoor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), mat(0x222222));
  barnDoor.position.set(-0.4, 0.6, 1.01);
  barn.add(barnBody, barnRoof, barnDoor);
  barn.position.set(12.5, 0, 2.5);
  three.add(barn);

  // Trough
  const trough = new THREE.Group();
  const troughBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.7), mat(0x8a5a3b));
  troughBody.position.y = 0.175; troughBody.castShadow = true;
  const hay = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.5), mat(0xe9c46a));
  hay.position.set(0, 0.28, 0);
  trough.add(troughBody, hay);
  trough.position.set(9.5, 0, 6.0);
  three.add(trough);
}

function buildWindmill(three) {
  const g = new THREE.Group();
  // Stone tower (tapered cylinder)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 4.2, 16), mat(0xc9c2b4));
  tower.position.y = 2.1; tower.castShadow = true;
  // Conical wooden cap
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 16), mat(0x8a5a3b));
  cap.position.y = 4.7; cap.castShadow = true;
  // A little door + window for charm
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.2), mat(0x6b4326));
  door.position.set(0, 0.6, 1.32);
  const window1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2), mat(0x4aa3e0, { r: 0.3 }));
  window1.position.set(0, 2.6, 1.28);
  g.add(tower, cap, door, window1);

  // Rotating sail assembly mounted on the front of the cap
  const sails = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 12), mat(0x5b3b22));
  hub.rotation.x = Math.PI / 2;
  sails.add(hub);
  const bladeArm = mat(0x6b4326);
  const bladeCloth = mat(0xfaf3e0, { r: 0.8 });
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), bladeArm);
    spar.position.y = 1.2;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.9, 0.05), bladeCloth);
    cloth.position.set(0.4, 1.2, 0.04);
    arm.add(spar, cloth);
    arm.rotation.z = (i / 4) * Math.PI * 2;
    sails.add(arm);
  }
  sails.position.set(0, 4.4, 1.5);
  sails.castShadow = true;
  g.add(sails);
  scene.windmillSails = sails;

  g.position.copy(scene._windmillPos);
  three.add(g);

  const spr = makeEmojiSprite('🌬️', 1.2);
  spr.position.copy(scene._windmillPos).add(new THREE.Vector3(0, 6.2, 0));
  three.add(spr);
}

function buildGreenhouse(three) {
  const g = new THREE.Group();
  const frame = mat(0xb7c0c9, { m: 0.5, r: 0.4 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8fd0ff, roughness: 0.1, metalness: 0.1,
    transparent: true, opacity: 0.35,
  });
  // Base slab
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 5.0), mat(0x9aa6b2));
  base.position.y = 0.15; base.receiveShadow = true;
  // Glass walls (a single translucent box) + gabled glass roof
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.6, 4.6), glass);
  walls.position.y = 1.6;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 4.6, 3), glass);
  roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2;
  roof.position.y = 3.0; roof.scale.y = 0.9;
  // Steel frame edges (corner posts + ridge)
  const postGeo = new THREE.BoxGeometry(0.14, 2.8, 0.14);
  [[-2, 2.3], [2, 2.3], [2, -2.3], [-2, -2.3]].forEach(([x, z]) => {
    const p = new THREE.Mesh(postGeo, frame); p.position.set(x, 1.6, z); g.add(p);
  });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.8), frame);
  ridge.position.y = 4.0;
  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.12), frame);
  door.position.set(0, 0.9, 2.32);
  g.add(base, walls, roof, ridge, door);
  g.traverse((o) => { if (o.isMesh && o.material === frame) o.castShadow = true; });

  g.position.copy(scene._greenhousePos);
  three.add(g);

  const spr = makeEmojiSprite('🧪', 1.2);
  spr.position.copy(scene._greenhousePos).add(new THREE.Vector3(0, 4.8, 0));
  three.add(spr);
}

function buildBeehive(three) {
  const g = new THREE.Group();
  // Stand
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), mat(0x8a5a3b));
  stand.position.y = 0.25; stand.castShadow = true;
  g.add(stand);
  // Stacked hive boxes (Langstroth supers)
  const boxMat = mat(0xf0d59a);
  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), boxMat);
    box.position.y = 0.75 + i * 0.52; box.castShadow = true;
    g.add(box);
    // little landing-board lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.18), mat(0xd9b870));
    lip.position.set(0, 0.55 + i * 0.52, 0.55);
    g.add(lip);
  }
  // Flat lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 1.15), mat(0xcaa86a));
  lid.position.y = 0.75 + 2 * 0.52 + 0.34; lid.castShadow = true;
  g.add(lid);

  g.position.copy(scene._beehivePos);
  three.add(g);

  // Orbiting bees (yellow/black striped spheres)
  const beeBody = mat(0xf6c026);
  for (let i = 0; i < 6; i++) {
    const bee = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), beeBody);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.21), mat(0x222222));
    bee.add(ball, stripe);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), wingMat);
    wing.scale.set(1, 0.4, 1.6); wing.position.y = 0.08;
    bee.add(wing);
    three.add(bee);
    scene.bees.push({
      mesh: bee,
      angle: (i / 6) * Math.PI * 2,
      radius: 1.4 + Math.random() * 0.7,
      speed: 1.2 + Math.random() * 0.8,
      height: 1.6 + Math.random() * 1.2,
      bob: Math.random() * Math.PI * 2,
    });
  }

  const spr = makeEmojiSprite('🐝', 1.1);
  spr.position.copy(scene._beehivePos).add(new THREE.Vector3(0, 3.4, 0));
  three.add(spr);
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
  // record the harvested crop in the player's inventory
  store.addItem(cropId, 1);
  return cropId;
}

export function isOnMat() {
  return scene.player.position.distanceTo(scene._matPos) < 2.0;
}
export function isNearWell() {
  return scene.player.position.distanceTo(scene._wellPos) < 4.0;
}
export function isNearWindmill() {
  return scene.player.position.distanceTo(scene._windmillPos) < 4.0;
}
export function isNearGreenhouse() {
  return scene.player.position.distanceTo(scene._greenhousePos) < 4.0;
}
export function isNearBeehive() {
  return scene.player.position.distanceTo(scene._beehivePos) < 4.0;
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

  // ---- Honey speed boost countdown ----
  const boosted = st.speedBoostTimer > 0;
  if (boosted) {
    st.speedBoostTimer = Math.max(0, st.speedBoostTimer - dt);
    if (st.speedBoostTimer === 0 && scene.hooks.onBoostEnd) scene.hooks.onBoostEnd();
  }
  const boostMult = boosted ? 1.6 : 1;

  // ---- Movement ----
  const len = Math.hypot(input.x, input.y);
  const moving = len > 0.05;
  if (moving) {
    const nx = input.x / Math.max(len, 1), nz = input.y / Math.max(len, 1);
    const speed = veh.speed * boostMult * (len > 1 ? 1 : len);
    scene.player.position.x = clamp(scene.player.position.x + nx * speed * dt, -HALF - 12, HALF + 12);
    scene.player.position.z = clamp(scene.player.position.z + nz * speed * dt, -HALF - 12, HALF + 12);
    scene.facing.set(nx, 0, nz).normalize();
    const targetRot = Math.atan2(nx, nz);
    scene.player.rotation.y = lerpAngle(scene.player.rotation.y, targetRot, 0.2);
  }

  // ---- Walk / engine animation ----
  if (st.activeVehicle === 'foot') {
    if (moving) {
      // legs swing faster (and a little wider) during the honey speed boost
      scene._walkPhase += dt * (boosted ? 18 : 10);
      const swing = boosted ? 0.85 : 0.6;
      legL.rotation.x = Math.sin(scene._walkPhase) * swing;
      legR.rotation.x = -Math.sin(scene._walkPhase) * swing;
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

  // ---- Update animals ----
  updateAnimals(dt);

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

  // ---- Buildings: windmill sails, bees, honey production ----
  if (scene.windmillSails) scene.windmillSails.rotation.z += dt * 1.1;
  const nowS = performance.now() / 1000;
  for (const bee of scene.bees) {
    bee.angle += bee.speed * dt;
    bee.mesh.position.set(
      scene._beehivePos.x + Math.cos(bee.angle) * bee.radius,
      bee.height + Math.sin(nowS * 6 + bee.bob) * 0.25,
      scene._beehivePos.z + Math.sin(bee.angle) * bee.radius
    );
    bee.mesh.rotation.y = -bee.angle;
  }
  // produce a honey jar every 30s, up to 3 ready at a time
  scene._honeyTimer += dt;
  if (scene._honeyTimer >= 30) {
    scene._honeyTimer = 0;
    if ((store.state.inventory.honey || 0) < 3) {
      store.addItem('honey', 1);
      if (scene.hooks.onHoney) scene.hooks.onHoney(store.state.inventory.honey);
    }
  }

  // ---- Effects & clouds ----
  updateEffects(dt);
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 40) cloud.position.x = -40;
  }
  // bob fruit sprites
  scene.three.traverse((o) => { if (o.isSprite && o.userData.bob) o.position.y = 1.6 + Math.sin(performance.now() / 300) * 0.08; });

  // ---- Camera follow / rotate on landing page ----
  if (!scene.gameStarted) {
    const time = performance.now() * 0.00015;
    scene.camera.position.set(Math.cos(time) * 16, 9, Math.sin(time) * 16);
    scene.camera.lookAt(0, 1.0, 0);
  } else {
    const p = scene.player.position;
    const camTarget = scene._camT || (scene._camT = new THREE.Vector3());
    camTarget.set(p.x, 11, p.z + 14);
    scene.camera.position.lerp(camTarget, 0.08);
    scene.camera.lookAt(p.x, 1, p.z);
  }

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

// =============================================================
//  Animal spawning, meshes, and AI logic
// =============================================================
function createAnimalMesh(type) {
  const g = new THREE.Group();
  const black = mat(0x222222);
  const white = mat(0xffffff);
  const orange = mat(0xf4833b);
  const pink = mat(0xffb5a7);

  if (type === 'chicken') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.45), white);
    body.position.y = 0.3;
    body.castShadow = true;
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), white);
    head.position.set(0, 0.52, 0.12);
    head.castShadow = true;
    
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), orange);
    beak.position.set(0, 0.52, 0.25);
    
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.12), mat(0xe63946));
    comb.position.set(0, 0.65, 0.1);
    
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), orange);
    legL.position.set(-0.08, 0.075, 0);
    const legR = legL.clone();
    legR.position.x = 0.08;

    g.add(body, head, beak, comb, legL, legR);
  } else if (type === 'sheep') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.8), white);
    body.position.y = 0.45;
    body.castShadow = true;
    
    const fluff = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.6), white);
    fluff.position.set(0, 0.75, 0.05);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), black);
    head.position.set(0, 0.55, 0.42);
    head.castShadow = true;

    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), black);
    earL.position.set(-0.16, 0.55, 0.38);
    earL.rotation.z = 0.4;
    const earR = earL.clone();
    earR.position.x = 0.16;
    earR.rotation.z = -0.4;
    
    const legGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
    const legFL = new THREE.Mesh(legGeo, black); legFL.position.set(-0.18, 0.125, 0.25);
    const legFR = legFL.clone(); legFR.position.x = 0.18;
    const legBL = legFL.clone(); legBL.position.z = -0.25;
    const legBR = legFR.clone(); legBR.position.z = -0.25;

    g.add(body, fluff, head, earL, earR, legFL, legFR, legBL, legBR);
  } else if (type === 'cow') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.2), white);
    body.position.y = 0.65;
    body.castShadow = true;

    const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.35), black);
    spot1.position.set(0.36, 0.65, 0.2);
    const spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.3), black);
    spot2.position.set(-0.36, 0.6, -0.2);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), white);
    head.position.set(0, 0.9, 0.6);
    head.castShadow = true;

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.15), pink);
    snout.position.set(0, 0.8, 0.78);

    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), mat(0xcccccc));
    hornL.position.set(-0.15, 1.1, 0.55);
    hornL.rotation.z = -0.3;
    const hornR = hornL.clone();
    hornR.position.x = 0.15;
    hornR.rotation.z = 0.3;

    const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    const legFL = new THREE.Mesh(legGeo, white); legFL.position.set(-0.24, 0.2, 0.4);
    const legFR = legFL.clone(); legFR.position.x = 0.24;
    const legBL = legFL.clone(); legBL.position.z = -0.4;
    const legBR = legFR.clone(); legBR.position.z = -0.4;

    g.add(body, spot1, spot2, head, snout, hornL, hornR, legFL, legFR, legBL, legBR);
  }
  g.scale.setScalar(0.95);
  return g;
}

export function syncAnimals() {
  if (!scene.three) return;
  const counts = store.state.animals || { chicken: 0, sheep: 0, cow: 0 };
  const curCounts = { chicken: 0, sheep: 0, cow: 0 };
  scene.animals.forEach(a => { curCounts[a.type]++; });

  Object.keys(counts).forEach(type => {
    const needed = counts[type] - curCounts[type];
    for (let i = 0; i < needed; i++) {
      spawnAnimal(type);
    }
  });
}

function spawnAnimal(type) {
  const mesh = createAnimalMesh(type);
  const x = 8.5 + Math.random() * 5.0;
  const z = 2.0 + Math.random() * 5.0;
  mesh.position.set(x, 0, z);
  scene.three.add(mesh);

  const animal = {
    type,
    mesh,
    state: 'hungry', // hungry | eating | ready
    timer: 0,
    targetPos: new THREE.Vector3(x, 0, z),
    roamTimer: 0.5 + Math.random() * 2,
    productSprite: null,
    waddlePhase: Math.random() * Math.PI * 2,
    foodBowl: null
  };
  scene.animals.push(animal);
}

function showAnimalProduct(animal) {
  const productEmoji = ANIMAL_TYPES[animal.type].productEmoji;
  const spr = makeEmojiSprite(productEmoji, 0.85);
  spr.position.set(0, animal.type === 'cow' ? 1.6 : (animal.type === 'sheep' ? 1.2 : 1.0), 0);
  spr.userData.bob = true;
  animal.mesh.add(spr);
  animal.productSprite = spr;
}

export function feedAnimal(animal) {
  if (animal.state !== 'hungry') return false;
  const def = ANIMAL_TYPES[animal.type];
  // Use free organic feed (from the Windmill) first, then fall back to coins.
  let paidWith = 'coins';
  if (store.hasItems('organicFeed', 1)) {
    store.addItem('organicFeed', -1);
    paidWith = 'feed';
  } else if (!store.spend(def.feedCost)) {
    return false;
  }

  animal.lastPaidWith = paidWith;
  animal.state = 'eating';
  animal.timer = def.growTime;
  
  // Spawn a small yellow bowl next to the animal
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.08, 8), mat(0xd66853));
  bowl.position.copy(animal.mesh.position).add(new THREE.Vector3(0.2, 0.04, 0.2));
  scene.three.add(bowl);
  animal.foodBowl = bowl;
  return true;
}

export function collectProduct(animal) {
  if (animal.state !== 'ready') return false;
  const def = ANIMAL_TYPES[animal.type];
  
  // Reward player
  store.addCoins(def.reward);
  const xpRes = store.addXp(def.xp);
  if (xpRes.leveledUp) {
    if (scene.hooks.onLevelUp) scene.hooks.onLevelUp(xpRes.newLevel);
  }

  // Remove bubble
  if (animal.productSprite) {
    animal.mesh.remove(animal.productSprite);
    animal.productSprite = null;
  }
  
  // Pop effect
  popEffect(animal.mesh.position.x, animal.mesh.position.y + 1, def.productEmoji);
  
  animal.state = 'hungry';
  return def;
}

function updateAnimals(dt) {
  const minX = 8.0, maxX = 14.0, minZ = 1.5, maxZ = 7.5;
  scene.animals.forEach(a => {
    if (a.state === 'hungry' || a.state === 'ready') {
      a.roamTimer -= dt;
      if (a.roamTimer <= 0) {
        a.targetPos.set(
          minX + Math.random() * (maxX - minX),
          0,
          minZ + Math.random() * (maxZ - minZ)
        );
        a.roamTimer = 3 + Math.random() * 5;
      }

      const dist = a.mesh.position.distanceTo(a.targetPos);
      if (dist > 0.1) {
        const dir = new THREE.Vector3().subVectors(a.targetPos, a.mesh.position).normalize();
        const speed = a.type === 'chicken' ? 0.8 : (a.type === 'sheep' ? 0.6 : 0.4);
        a.mesh.position.addScaledVector(dir, speed * dt);
        
        const targetAngle = Math.atan2(dir.x, dir.z);
        a.mesh.rotation.y = lerpAngle(a.mesh.rotation.y, targetAngle, 0.1);

        a.waddlePhase += dt * 8;
        if (a.type === 'chicken') {
          a.mesh.position.y = Math.max(0, Math.sin(a.waddlePhase) * 0.15);
          a.mesh.rotation.z = Math.sin(a.waddlePhase) * 0.1;
        } else {
          a.mesh.position.y = 0;
          a.mesh.rotation.z = Math.sin(a.waddlePhase) * 0.04;
        }
      } else {
        a.mesh.position.y = 0;
        a.mesh.rotation.z *= 0.8;
      }
    } else if (a.state === 'eating') {
      a.timer -= dt;
      a.waddlePhase += dt * 12;
      a.mesh.rotation.x = Math.sin(a.waddlePhase) * 0.15;
      
      // Make food bowl stay near animal as it bobs
      if (a.foodBowl) {
        a.foodBowl.position.y = 0.04;
      }

      if (a.timer <= 0) {
        a.state = 'ready';
        a.mesh.rotation.x = 0;
        if (a.foodBowl) {
          scene.three.remove(a.foodBowl);
          a.foodBowl = null;
        }
        showAnimalProduct(a);
      }
    }
  });
}
