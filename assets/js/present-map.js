/* =============================================================================
   Sophie Barat — présentation, écran 9 : maquette 3D du lycée du futur (three.js local)
   Maquette d'architecte lumineuse construite en géométrie (aucun modèle téléchargé) :
   socle bleu nuit, bâtiments blanc mat, arêtes bleu électrique / violet, arbres, cour,
   couloirs vitrés, tapis roulants à bandes lumineuses. 5 zones cliquables.
   Pas de vraies ombres (fausses ombres en dégradé). Pas de boucle propre :
   present.js appelle render(now) depuis sa boucle unique, et seulement sur cet écran.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';
import { mergeGeometries } from '../vendor/three/addons/BufferGeometryUtils.js';

const BLUE = new THREE.Color('#2bb8ff');
const VIOLET = new THREE.Color('#8f5cff');
const WHITE = new THREE.Color('#f1f4ff');

// zones, dans l'ordre des écrans suivants : centre, point d'ancrage de l'étiquette, angle de vue préféré
export const ZONES = [
  { name: 'Boarding school', center: [-8.6, 1.6, -6.0], anchor: [-8.8, 5.4, -6.2], az: -0.62, ring: 4.4, col: BLUE },
  { name: 'Shopping centre', center: [8.4, 1.1, 4.7], anchor: [8.4, 4.4, 4.7], az: 0.62, ring: 5.4, col: VIOLET },
  { name: 'Restaurants', center: [-8.4, 0.7, 5.6], anchor: [-8.4, 2.9, 5.6], az: -0.5, ring: 4.0, col: BLUE },
  { name: 'Rooms', center: [9.4, 2.6, -5.6], anchor: [9.0, 7.2, -6.2], az: 0.7, ring: 4.0, col: VIOLET },
  { name: 'Moving walkways', center: [0, 0.5, -2.6], anchor: [-1.8, 2.3, -2.6], az: 0.18, ring: 0, col: BLUE },
];

/* ------------------------------------------------------------------ textures en dégradé (ombres, halos) */
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// tapis roulants : bandes lumineuses qui défilent (deux voies, sens opposés)
const BELT_VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BELT_FS = /* glsl */`
uniform float uTime; uniform float uLen; uniform float uHeat; uniform vec3 uA; uniform vec3 uB;
varying vec2 vUv;
void main() {
  float lane = step(0.5, vUv.y);
  float dir = lane * 2.0 - 1.0;
  float s = fract(vUv.x * uLen / 1.1 - uTime * 0.85 * dir);
  float band = smoothstep(0.0, 0.1, s) * (1.0 - smoothstep(0.22, 0.42, s));
  float rail = smoothstep(0.40, 0.48, abs(vUv.y - 0.5)) + (1.0 - smoothstep(0.0, 0.03, abs(vUv.y - 0.5))) * 0.6;
  vec3 col = mix(uA, uB, lane);
  float a = 0.16 + band * (0.85 + 0.35 * uHeat) + rail * (0.6 + 0.4 * uHeat);
  gl_FragColor = vec4(col * (1.0 + uHeat * 0.5) + band * 0.25, a);
}`;
const BEAM_FS = /* glsl */`
uniform float uOn; uniform vec3 uA; varying vec2 vUv;
void main() { gl_FragColor = vec4(uA + 0.2, pow(1.0 - vUv.y, 1.6) * 0.55 * uOn); }`;

/* ------------------------------------------------------------------ outils */
// 12 arêtes d'une boîte + lignes d'étages, ajoutées à un tableau de segments
function boxEdges(seg, x, y0, z, w, h, d, floors) {
  const xs = [x - w / 2, x + w / 2], zs = [z - d / 2, z + d / 2], ys = [y0, y0 + h];
  const ring = (y) => { seg.push(xs[0], y, zs[0], xs[1], y, zs[0], xs[1], y, zs[0], xs[1], y, zs[1], xs[1], y, zs[1], xs[0], y, zs[1], xs[0], y, zs[1], xs[0], y, zs[0]); };
  ring(ys[0]); ring(ys[1]);
  for (const a of xs) for (const b of zs) seg.push(a, ys[0], b, a, ys[1], b);
  if (floors) {
    const e = 0.012;
    for (let y = y0 + floors; y < y0 + h - floors * 0.5; y += floors) {
      seg.push(xs[0] - e, y, zs[1] + e, xs[1] + e, y, zs[1] + e, xs[1] + e, y, zs[0] - e, xs[1] + e, y, zs[1] + e,
        xs[0] - e, y, zs[0] - e, xs[1] + e, y, zs[0] - e, xs[0] - e, y, zs[0] - e, xs[0] - e, y, zs[1] + e);
    }
  }
}
// ruban plat le long d'une polyligne (lignes au sol lisibles de loin)
function ribbon(pts, w, y, closed) {
  const pos = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2, pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2);
    if (i < n - 1 || closed) { const j = (i + 1) % n; idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return g;
}
function segGeo(arr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
function shortAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

/* ------------------------------------------------------------------ création */
export function createMap(host, opts) {
  const isReduced = opts.reduced || (() => false);
  const onError = opts.onError || (() => {});
  const onArrive = opts.onArrive || (() => {});
  const onPick = opts.onPick || (() => {});
  const onHover = opts.onHover || (() => {});
  const tags = opts.tags || [];

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; onError(); });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x061638, 60, 110);
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 200);
  scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x0b1636, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-9, 20, 10); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7f6bff, 0.7); rim.position.set(12, 6, -14); scene.add(rim);

  const shadowTex = radialTex([[0, 'rgba(0,4,20,.75)'], [0.55, 'rgba(0,4,20,.35)'], [1, 'rgba(0,4,20,0)']]);
  const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
  const ADD = THREE.AdditiveBlending;
  const T = { value: 0 };

  /* -------------------------------------------------------------- socle */
  const BW = 31, BD = 22;
  const baseGeo = new THREE.ExtrudeGeometry(roundRect(BW, BD, 1.4), { depth: 1.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 8 });
  baseGeo.rotateX(-Math.PI / 2); baseGeo.translate(0, -1.18, 0);   // biseau compris : dessus à y = 0
  scene.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x0a1844, roughness: 0.75, metalness: 0.15 })));
  // grille fine sur le dessus
  const grid = new THREE.GridHelper(28, 28, 0x2a5fd0, 0x1a3c8c);
  grid.material.transparent = true; grid.material.opacity = 0.32; grid.material.depthWrite = false;
  grid.scale.set(1, 1, 19 / 28); grid.position.y = 0.015;
  scene.add(grid);
  // bords lumineux du socle (haut bleu, bas violet) + halo dessous
  const edgePts = roundRect(BW + 0.16, BD + 0.16, 1.48).getPoints(18);
  const edgeLine = (y, col, op) => {
    const g = new THREE.BufferGeometry().setFromPoints(edgePts.map((p) => new THREE.Vector3(p.x, y, -p.y)));
    const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, blending: ADD, depthWrite: false }));
    scene.add(l);
  };
  edgeLine(-0.55, BLUE, 0.35);
  const rimCurve = (y) => new THREE.CatmullRomCurve3(edgePts.map((p) => new THREE.Vector3(p.x, y, -p.y)), true, 'catmullrom', 0.1);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve(0.03), 160, 0.07, 6, true), new THREE.MeshBasicMaterial({ color: 0x46c4ff, toneMapped: false })));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve(-1.16), 160, 0.06, 6, true), new THREE.MeshBasicMaterial({ color: 0x9a6bff, toneMapped: false })));
  const under = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.9, BD * 1.9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex, color: 0x1d4fd8, transparent: true, opacity: 0.55, blending: ADD, depthWrite: false }));
  under.position.y = -1.3; scene.add(under);

  /* -------------------------------------------------------------- matériaux communs */
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false });
  const neutral = { body: new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.88, metalness: 0 }), seg: [], bodies: [] };

  function fakeShadow(x, z, w, d, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.4 + h * 0.25, d + 1.4 + h * 0.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.set(x + h * 0.12, 0.02, z - h * 0.06); m.renderOrder = -1;
    scene.add(m);
  }
  // liseré lumineux le long du toit (fines baguettes)
  function addTrim(ctx, x, y, z, w, d) {
    const t = 0.07;
    ctx.trims = ctx.trims || [];
    ctx.trims.push(new THREE.BoxGeometry(w + t, t, t).translate(x, y, z - d / 2), new THREE.BoxGeometry(w + t, t, t).translate(x, y, z + d / 2),
      new THREE.BoxGeometry(t, t, d + t).translate(x - w / 2, y, z), new THREE.BoxGeometry(t, t, d + t).translate(x + w / 2, y, z));
  }
  function addBox(ctx, x, z, w, h, d, floors = 0.8, y0 = 0) {
    ctx.bodies.push(new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z));
    if (h > 0.3) addTrim(ctx, x, y0 + h, z, w, d);
    boxEdges(ctx.seg, x, y0, z, w, h, d, floors);
    if (y0 === 0) fakeShadow(x, z, w, d, h);
  }

  /* -------------------------------------------------------------- zones */
  const zones = ZONES.map((Z) => ({
    Z, heat: 0, target: 0, seg: [], bodies: [], extras: [], winA: [], winB: [],
    body: new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.86, metalness: 0, emissive: new THREE.Color(0x000000) }),
    line: new THREE.LineBasicMaterial({ color: Z.col.clone(), transparent: true, opacity: 0.6, blending: ADD, depthWrite: false }),
  }));
  const [zBoard, zShop, zFood, zRoom, zWalk] = zones;

  // internat : trois bâtiments avec terrasses
  addBox(zBoard, -9.9, -6.4, 5.4, 4.4, 3.2);
  addBox(zBoard, -6.0, -7.7, 3.0, 3.6, 2.2);
  addBox(zBoard, -12.0, -3.4, 2.4, 2.4, 2.4);
  addBox(zBoard, -9.9, -6.4, 3.4, 0.5, 2.0, 0, 4.4);           // édicule sur le toit

  // centre commercial : grand volume bas + verrière en berceau + auvent
  addBox(zShop, 8.6, 4.8, 8.6, 2.2, 5.0, 1.1);
  const barrel = new THREE.CylinderGeometry(1.7, 1.7, 7.6, 28, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(8.6, 2.2, 4.8);
  zShop.extras.push(new THREE.Mesh(barrel, glassMat));
  const barrelEdges = [];
  for (let k = 0; k <= 10; k += 2) {            // arceaux
    const x = 8.6 - 3.8 + 7.6 * k / 10;
    for (let j = 0; j < 8; j++) {
      const a0 = j / 8 * Math.PI, a1 = (j + 1) / 8 * Math.PI;
      barrelEdges.push(x, 2.2 + 1.7 * Math.sin(a0), 4.8 + 1.7 * Math.cos(a0), x, 2.2 + 1.7 * Math.sin(a1), 4.8 + 1.7 * Math.cos(a1));
    }
  }
  for (let j = 1; j < 8; j++)                   // filants { const a0 = j / 8 * Math.PI; barrelEdges.push(4.8, 2.2 + 1.7 * Math.sin(a0), 4.8 + 1.7 * Math.cos(a0), 12.4, 2.2 + 1.7 * Math.sin(a0), 4.8 + 1.7 * Math.cos(a0)); }
  zShop.seg.push(...barrelEdges);
  addBox(zShop, 8.6, 7.9, 4.0, 0.12, 1.3, 0, 1.5);              // auvent d'entrée
  zShop.winB.push(new THREE.PlaneGeometry(6.4, 0.22).translate(8.6, 1.75, 7.31));   // bandeau lumineux en façade

  // restaurants : pavillons ronds + parasols
  [[-10.2, 4.2], [-6.9, 6.8], [-10.6, 7.9], [-6.6, 3.6]].forEach(([x, z], i) => {
    const h = i % 2 ? 1.0 : 1.25;
    zFood.bodies.push(new THREE.CylinderGeometry(1.0, 1.0, h, 24).translate(x, h / 2, z));
    zFood.bodies.push(new THREE.CylinderGeometry(1.3, 1.3, 0.14, 28).translate(x, h + 0.07, z));
    for (let k = 0; k < 24; k++) {
      const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2;
      zFood.seg.push(x + 1.31 * Math.cos(a0), h + 0.14, z + 1.31 * Math.sin(a0), x + 1.31 * Math.cos(a1), h + 0.14, z + 1.31 * Math.sin(a1));
      zFood.seg.push(x + 1.01 * Math.cos(a0), 0.02, z + 1.01 * Math.sin(a0), x + 1.01 * Math.cos(a1), 0.02, z + 1.01 * Math.sin(a1));
    }
    fakeShadow(x, z, 2, 2, h);
  });
  [[-8.6, 5.3], [-8.2, 4.1], [-9.0, 6.6], [-11.9, 5.9], [-5.3, 5.2], [-7.6, 8.9]].forEach(([x, z]) => {
    zFood.bodies.push(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6).translate(x, 0.35, z));
    zFood.bodies.push(new THREE.ConeGeometry(0.42, 0.22, 10).translate(x, 0.8, z));
  });

  // chambres : tour avec une grille de fenêtres allumées (bleu / violet)
  addBox(zRoom, 9.2, -6.3, 4.8, 5.6, 3.6, 0.8);
  addBox(zRoom, 12.4, -3.2, 2.4, 2.0, 2.4, 1.0);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
    const lit = (r * 7 + c * 3) % 5;
    if (lit === 0) continue;
    const g = new THREE.PlaneGeometry(0.62, 0.42).translate(9.2 - 1.92 + c * 0.96, 0.62 + r * 0.8, -6.3 + 1.81);
    (lit % 2 ? zRoom.winA : zRoom.winB).push(g);
    const g2 = new THREE.PlaneGeometry(0.5, 0.42).rotateY(Math.PI / 2).translate(9.2 - 2.41, 0.62 + r * 0.8, -6.3 - 1.2 + (c % 4) * 0.8);
    if (c < 4 && (r + c) % 3) (lit % 2 ? zRoom.winB : zRoom.winA).push(g2);
  }

  // tapis roulants : long couloir vitré + deux couloirs vers la cour, bandes lumineuses au sol
  const belts = [];
  function corridor(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), w = 1.5, h = 0.95;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ang = Math.atan2(z1 - z0, x1 - x0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), glassMat);
    glass.position.set(cx, h / 2 + 0.03, cz); glass.rotation.y = -ang;
    zWalk.extras.push(glass);
    const U = { uTime: T, uLen: { value: len }, uHeat: { value: 0 }, uA: { value: BLUE }, uB: { value: VIOLET } };
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(len, w - 0.2).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: U, vertexShader: BELT_VS, fragmentShader: BELT_FS, transparent: true, depthWrite: false, blending: ADD }));
    belt.position.set(cx, 0.05, cz); belt.rotation.y = -ang;
    zWalk.extras.push(belt); belts.push(U);
    // arêtes du couloir
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2;
    const P = (u, v, y) => [x0 + c * u - s * v, y, z0 + s * u + c * v];
    [[-hw, 0.03], [hw, 0.03], [-hw, h + 0.03], [hw, h + 0.03]].forEach(([v, y]) => zWalk.seg.push(...P(0, v, y), ...P(len, v, y)));
    for (let u = 0; u <= len + 0.01; u += len / Math.max(1, Math.round(len / 2.2))) {
      zWalk.seg.push(...P(u, -hw, 0.03), ...P(u, -hw, h + 0.03), ...P(u, hw, 0.03), ...P(u, hw, h + 0.03), ...P(u, -hw, h + 0.03), ...P(u, hw, h + 0.03));
    }
    fakeShadow(cx, cz, Math.abs(c) * len + Math.abs(s) * w, Math.abs(s) * len + Math.abs(c) * w, 0.6);
  }
  corridor(-11.2, -2.6, 11.4, -2.6);
  corridor(-4.6, -1.85, -4.6, 3.4);
  corridor(4.6, -1.85, 4.6, 2.4);

  // décor : bâtiment principal (classes), cour, terrain de sport, arbres
  addBox(neutral, 0, -7.4, 8.4, 3.2, 3.4, 0.8);
  addBox(neutral, 0, -7.4, 3.0, 1.0, 1.6, 0, 3.2);
  const yard = new THREE.Mesh(new THREE.CircleGeometry(3.5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x24479e, roughness: 0.9 }));
  yard.position.set(0, 0.025, 2.6); scene.add(yard);
  // cour : anneaux lumineux ; terrain de sport : piste
  const deco = [];
  for (const r of [3.5, 2.2]) {
    const pts = []; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; pts.push([r * Math.cos(a), 2.6 + r * Math.sin(a)]); }
    deco.push(ribbon(pts, r > 3 ? 0.14 : 0.08, 0.04, true));
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; deco.push(ribbon([[0.6 * Math.cos(a), 2.6 + 0.6 * Math.sin(a)], [2.2 * Math.cos(a), 2.6 + 2.2 * Math.sin(a)]], 0.06, 0.04, false)); }
  const track = (hw, r) => {
    const pts = [];
    for (let k = 0; k < 24; k++) { const a = -Math.PI / 2 + k / 23 * Math.PI; pts.push([hw + r * Math.cos(a), 8.1 + r * Math.sin(a)]); }
    for (let k = 0; k < 24; k++) { const a = Math.PI / 2 + k / 23 * Math.PI; pts.push([-hw + r * Math.cos(a), 8.1 + r * Math.sin(a)]); }
    deco.push(ribbon(pts, 0.09, 0.04, true));
  };
  track(2.6, 1.6); track(2.6, 1.15);
  scene.add(new THREE.Mesh(mergeGeometries(deco), new THREE.MeshBasicMaterial({ color: 0x9a6bff, toneMapped: false, side: THREE.DoubleSide })));
  const field = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x123f63, roughness: 0.95 }));
  field.position.set(0, 0.022, 8.1); scene.add(field);
  // fontaine lumineuse au centre de la cour
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 24).translate(0, 0.12, 2.6), neutral.body);
  scene.add(fountain);
  const fglow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x2bb8ff, transparent: true, opacity: 0.6, blending: ADD, depthWrite: false }));
  fglow.position.set(0, 0.05, 2.6); scene.add(fglow);
  // arbres (instanciés) : boules blanches façon maquette
  const treePos = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3; treePos.push([4.3 * Math.cos(a), 2.6 + 4.3 * Math.sin(a), 0.4]); }
  [[-13.6, 9.2], [-12.2, 9.4], [-3.6, 9.4], [3.6, 9.4], [12.6, 9.3], [13.7, 8.4], [13.8, 0.6], [12.8, 1.2], [-13.8, 0.4], [-13.6, -1.0], [-2.8, -4.4], [2.8, -4.4], [5.8, -4.6], [-1.2, -9.8], [3.5, -9.7], [13.6, -9.3], [-13.6, -9.4], [-3.4, 6.9], [3.4, 6.9], [-1.6, 5.9], [1.6, 5.9], [6.0, -0.4], [-6.3, 0.2], [13.4, 4.6]]
    .forEach(([x, z]) => treePos.push([x, z, 0.3 + ((x * 7 + z * 3) % 3 + 3) % 3 * 0.05]));
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xd2f1ec, roughness: 0.9, emissive: 0x0b3350 }), treePos.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 6), neutral.body, treePos.length);
  const mtx = new THREE.Matrix4();
  treePos.forEach(([x, z, r], i) => {
    mtx.compose(new THREE.Vector3(x, 0.3 + r, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 1.05, r)); crown.setMatrixAt(i, mtx);
    mtx.compose(new THREE.Vector3(x, 0.25, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.5, 1)); trunk.setMatrixAt(i, mtx);
  });
  scene.add(crown, trunk);
  const treeShadows = mergeGeometries(treePos.map(([x, z, r]) => new THREE.PlaneGeometry(r * 3.2, r * 3.2).rotateX(-Math.PI / 2).translate(x + 0.15, 0.018, z - 0.1)));
  const tsh = new THREE.Mesh(treeShadows, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7, depthWrite: false }));
  tsh.renderOrder = -1; scene.add(tsh);

  // bâtiment principal : corps + arêtes
  scene.add(new THREE.Mesh(mergeGeometries(neutral.bodies), neutral.body));
  scene.add(new THREE.Mesh(mergeGeometries(neutral.trims), new THREE.MeshBasicMaterial({ color: 0x3f8cff, toneMapped: false })));
  scene.add(new THREE.LineSegments(segGeo(neutral.seg), new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.45, blending: ADD, depthWrite: false })));

  // assemblage des zones : un seul maillage par zone, arêtes, halo, anneau, faisceau, boîte de sélection
  const hitboxes = [];
  const winMatA = [], winMatB = [];
  zones.forEach((z, i) => {
    const g = new THREE.Group(); scene.add(g); z.group = g;
    if (z.bodies.length) g.add(new THREE.Mesh(mergeGeometries(z.bodies), z.body));
    z.extras.forEach((m) => g.add(m));
    if (z.seg.length) g.add(new THREE.LineSegments(segGeo(z.seg), z.line));
    z.winMatA = new THREE.MeshBasicMaterial({ color: BLUE.clone(), transparent: true, opacity: 0.85, blending: ADD, depthWrite: false, side: THREE.DoubleSide });
    z.winMatB = new THREE.MeshBasicMaterial({ color: VIOLET.clone(), transparent: true, opacity: 0.85, blending: ADD, depthWrite: false, side: THREE.DoubleSide });
    if (z.winA.length) g.add(new THREE.Mesh(mergeGeometries(z.winA), z.winMatA));
    if (z.winB.length) g.add(new THREE.Mesh(mergeGeometries(z.winB), z.winMatB));
    z.trimMat = new THREE.MeshBasicMaterial({ color: z.Z.col.clone(), toneMapped: false });
    if (z.trims) g.add(new THREE.Mesh(mergeGeometries(z.trims), z.trimMat));
    winMatA.push(z.winMatA); winMatB.push(z.winMatB);
    const [cx, , cz] = z.Z.center;
    // halo au sol + anneau (s'allument au survol)
    const R = z.Z.ring || 3;
    const haloW = i === 4 ? 24 : R * 2.6, haloD = i === 4 ? 4.5 : R * 2.6;
    z.halo = new THREE.Mesh(new THREE.PlaneGeometry(haloW, haloD).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: z.Z.col, transparent: true, opacity: 0.2, blending: ADD, depthWrite: false }));
    z.halo.position.set(cx, 0.03, cz); g.add(z.halo);
    if (z.Z.ring) {
      z.ringMesh = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.14, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: z.Z.col, transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      z.ringMesh.position.set(cx, 0.045, cz); g.add(z.ringMesh);
    }
    // faisceau vertical qui « pointe » la zone jusqu'à son étiquette
    const [ax, ay, az] = z.Z.anchor;
    z.beamU = { uOn: { value: 0 }, uA: { value: z.Z.col } };
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, ay, 8, 1, true).translate(ax, ay / 2, az),
      new THREE.ShaderMaterial({ uniforms: z.beamU, vertexShader: BELT_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: ADD }));
    g.add(beam);
    // boîte(s) de sélection invisibles (une par couloir pour les tapis roulants)
    g.updateMatrixWorld(true);
    const parts = i === 4 ? z.extras.filter((m) => m.material === glassMat).map((m) => [m]) : [g.children.filter((c) => c !== z.halo && c !== beam && c !== z.ringMesh)];
    parts.forEach((list) => {
      const box = new THREE.Box3();
      list.forEach((c) => box.expandByObject(c));
      box.expandByScalar(0.35);
      const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const hb = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
      hb.position.copy(ctr); hb.userData.zone = i; scene.add(hb); hitboxes.push(hb);
    });
  });

  /* -------------------------------------------------------------- caméra */
  const OVER = { target: new THREE.Vector3(0, 0.4, -0.6), dist: 64, elev: 0.98 };
  const view = { target: OVER.target.clone(), dist: OVER.dist, elev: OVER.elev, az: 0.35 };
  let tween = null, mode = 'over', zoneSel = -1, hoverI = -1, focusI = -1, dirty = true, lastT = 0;
  function overDist() {
    const fit = 36 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    return Math.max(OVER.dist, fit * 1.05);
  }
  function goTo(to, dur, done) {
    const red = isReduced();
    to.az = shortAngle(view.az, to.az === undefined ? view.az : to.az);
    if (red || !dur) { view.target.copy(to.target); view.dist = to.dist; view.elev = to.elev; view.az = to.az; tween = null; dirty = true; if (done) done(); return; }
    tween = { from: { target: view.target.clone(), dist: view.dist, elev: view.elev, az: view.az }, to, t0: -1, dur, done, lift: to.lift || 0 };
  }
  function zoneView(i, close) {
    const Z = ZONES[i];
    return close
      ? { target: new THREE.Vector3(...Z.center), dist: i === 4 ? 10 : 9.5, elev: i === 4 ? 0.62 : 0.5, az: Z.az, lift: 0.22 }
      : { target: new THREE.Vector3(Z.center[0] * 0.8, 0.6, Z.center[2] * 0.8 - 0.6), dist: overDist() * 0.6, elev: 0.88, az: Z.az * 0.7 };
  }
  function placeCamera() {
    const hd = view.dist * Math.cos(view.elev);
    camera.position.set(view.target.x + Math.sin(view.az) * hd, view.target.y + view.dist * Math.sin(view.elev), view.target.z + Math.cos(view.az) * hd);
    camera.lookAt(view.target);
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (mode === 'over' && !tween) view.dist = overDist();
    dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  /* -------------------------------------------------------------- survol et clic (rayon) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hitboxes, false)[0];
    return hit ? hit.object.userData.zone : -1;
  }
  let down = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const i = pickAt(e.clientX, e.clientY);
    if (i !== hoverI) { hoverI = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; onHover(i); dirty = true; }
  });
  canvas.addEventListener('pointerleave', () => { if (hoverI !== -1) { hoverI = -1; canvas.style.cursor = ''; onHover(-1); dirty = true; } });
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8; down = null;
    if (moved) return;
    const i = pickAt(e.clientX, e.clientY);
    if (i >= 0) onPick(i);
  });

  /* -------------------------------------------------------------- étiquettes HTML sur la projection 3D */
  const v3 = new THREE.Vector3();
  function placeTags() {
    const w = host.clientWidth, h = host.clientHeight;
    tags.forEach((el, i) => {
      v3.set(...ZONES[i].anchor).project(camera);
      const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      el.style.zIndex = String(1000 - Math.round(v3.z * 500));
    });
  }

  /* -------------------------------------------------------------- rendu (appelé par la boucle de present.js) */
  function render(nowMs) {
    if (lost) return false;
    const red = isReduced();
    const dt = lastT ? Math.min(64, nowMs - lastT) / 1000 : 0.016;
    lastT = nowMs;
    let animating = false;
    if (!red) T.value = nowMs / 1000;
    // caméra : envol en cours ou rotation lente
    if (tween) {
      if (tween.t0 < 0) tween.t0 = nowMs;
      const p = Math.min(1, (nowMs - tween.t0) / tween.dur), k = ease(p), f = tween.from, t = tween.to;
      view.target.lerpVectors(f.target, t.target, k);
      view.dist = f.dist + (t.dist - f.dist) * k;
      view.elev = f.elev + (t.elev - f.elev) * k + Math.sin(p * Math.PI) * tween.lift;
      view.az = f.az + (t.az - f.az) * k;
      animating = true;
      if (p >= 1) { const done = tween.done; tween = null; if (done) done(); }
    } else if (!red) {
      const speed = mode === 'over' ? 0.055 : mode === 'focus' ? 0.03 : 0.012;
      view.az += speed * dt;
    }
    // zones : allumage progressif
    zones.forEach((z, i) => {
      z.target = i === hoverI || i === focusI || i === zoneSel ? 1 : 0;
      if (Math.abs(z.heat - z.target) > 0.003) { z.heat += (z.target - z.heat) * (red ? 1 : Math.min(1, dt * 7)); animating = true; } else z.heat = z.target;
      const k = z.heat, pulse = red ? 1 : 0.75 + 0.25 * Math.sin(nowMs / 260);
      z.body.emissive.copy(z.Z.col).multiplyScalar(k * 0.32);
      z.line.opacity = 0.55 + 0.45 * k;
      z.halo.material.opacity = 0.18 + 0.6 * k * pulse;
      if (z.ringMesh) { z.ringMesh.material.opacity = k * pulse; const s = 1 + (red ? 0 : (nowMs / 1400) % 1 * 0.12) * k; z.ringMesh.scale.set(s, 1, s); }
      z.beamU.uOn.value = k;
      z.winMatA.opacity = z.winMatB.opacity = 0.7 + 0.3 * k;
      z.trimMat.color.copy(z.Z.col).multiplyScalar(0.85 + 0.9 * k);
    });
    belts.forEach((U) => { U.uHeat.value = zWalk.heat; });
    placeCamera();
    const live = !red || animating;
    if (live || dirty) {
      renderer.render(scene, camera);
      placeTags();
      dirty = false;
    }
    if (!live) lastT = 0;
    return live || dirty;
  }

  /* -------------------------------------------------------------- commandes */
  // vue d'ensemble
  function overview(instant) {
    mode = 'over'; zoneSel = -1; focusI = -1;
    goTo({ target: OVER.target.clone(), dist: overDist(), elev: OVER.elev }, instant ? 0 : 1200);
    dirty = true;
  }
  // repère clavier : la zone s'allume, la caméra la pointe (sans ouvrir la vidéo)
  function focus(i) {
    if (i < 0) { overview(); return; }
    mode = 'focus'; focusI = i; zoneSel = -1;
    goTo(zoneView(i, false), 1100);
    dirty = true;
  }
  // clic : la caméra s'envole vers la zone (~1,2 s), puis onArrive(i)
  function fly(i) {
    mode = 'zone'; zoneSel = i; focusI = -1;
    goTo(zoneView(i, true), 1200, () => onArrive(i));
    dirty = true;
  }
  function hover(i) { if (i !== hoverI) { hoverI = i; dirty = true; } }

  function dispose() {
    ro.disconnect();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    shadowTex.dispose(); glowTex.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignoré */ }
    canvas.remove();
  }

  placeCamera();
  return { render, overview, focus, fly, hover, dispose, invalidate() { dirty = true; }, get mode() { return mode; } };
}
