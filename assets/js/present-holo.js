/* =============================================================================
   Sophie Barat — présentation, écran 7 : hologramme 3D interactif (three.js local)
   Objets en géométrie simple (livre, tablette + emploi du temps, calculatrice, globe),
   matériau additif bleu / violet avec effet fresnel, lignes de balayage, scintillement,
   particules qui montent, socle lumineux, matérialisation (particules + balayage).
   Aucune boucle propre : present.js appelle render(now) depuis sa boucle unique.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { mergeGeometries } from '../vendor/three/addons/BufferGeometryUtils.js';

const COL_A = new THREE.Color('#2bb8ff');   // bleu électrique
const COL_B = new THREE.Color('#8f5cff');   // violet
export const NAMES = ['Book', 'Timetable', 'Calculator', 'Globe'];

/* ------------------------------------------------------------------ shaders */
const SURF_VS = /* glsl */`
varying vec3 vW; varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
#ifdef LINE
  vN = vec3(0.0, 0.0, 1.0);
#else
  vN = normalize(mat3(modelMatrix) * normal);
#endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SURF_FS = /* glsl */`
uniform float uTime; uniform float uReveal; uniform float uY0; uniform float uY1;
uniform float uFlicker; uniform float uBase; uniform float uGain;
uniform vec3 uA; uniform vec3 uB;
varying vec3 vW; varying vec3 vN;
void main() {
  float h = clamp((vW.y - uY0) / max(uY1 - uY0, 0.001), 0.0, 1.0);
  float d = (uReveal * 1.2 - 0.1) - h;           // front de matérialisation (de bas en haut)
  if (d < 0.0) discard;
  float edge = 1.0 - smoothstep(0.0, 0.07, d);
  vec3 col = mix(uA, uB, smoothstep(0.0, 1.0, h));
#ifdef LINE
  float a = 0.62;
#else
  vec3 V = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.4);  // fresnel : bords lumineux
  float a = uBase + f * 0.95;
#endif
  float scan = 0.76 + 0.24 * sin(vW.y * 150.0 - uTime * 5.0);   // lignes de balayage
  float band = exp(-pow((h - fract(uTime * 0.22)) * 14.0, 2.0)); // bande lumineuse qui monte
  a = a * scan * uFlicker + band * 0.16;
  col += band * 0.22 + edge * vec3(0.7, 0.86, 1.0);
  a += edge * 0.9;
  gl_FragColor = vec4(col, a * uGain);
}`;

const DOT_VS = /* glsl */`
uniform float uSize; uniform float uPR; varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR / -mv.z;
}`;
const DOT_FS = /* glsl */`
uniform float uReveal; uniform float uY0; uniform float uY1; uniform float uFlicker; uniform float uGain;
uniform vec3 uA; uniform vec3 uB; varying vec3 vW;
void main() {
  float h = clamp((vW.y - uY0) / max(uY1 - uY0, 0.001), 0.0, 1.0);
  if ((uReveal * 1.2 - 0.1) - h < 0.0) discard;
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(mix(uA, uB, h) + 0.15, smoothstep(0.5, 0.1, r) * 0.75 * uFlicker * uGain);
}`;

// particules de matérialisation : elles partent dispersées et s'assemblent sur l'objet
const BUILD_VS = /* glsl */`
attribute vec3 aStart; attribute float aDelay;
uniform float uP; uniform float uSize; uniform float uPR;
varying float vA; varying float vH;
void main() {
  float t = clamp((uP - aDelay) / 0.55, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(aStart, position, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (1.0 + (1.0 - t) * 1.6) / -mv.z;
  vA = smoothstep(0.0, 0.06, uP) * (1.0 - smoothstep(0.72, 1.0, uP)) * (0.35 + 0.65 * t);
  vH = clamp(position.y / 2.2, 0.0, 1.0);
}`;
const PART_FS = /* glsl */`
uniform vec3 uA; uniform vec3 uB; varying float vA; varying float vH;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(mix(uA, uB, vH) + 0.25, smoothstep(0.5, 0.0, r) * vA);
}`;

// particules ambiantes qui montent du socle
const RISE_VS = /* glsl */`
attribute vec4 aSeed;   // angle, rayon, phase, vitesse
uniform float uTime; uniform float uSize; uniform float uPR; uniform float uOn;
varying float vA; varying float vH;
void main() {
  float y = fract(aSeed.z + uTime * aSeed.w);
  float ang = aSeed.x + uTime * 0.18;
  float rad = aSeed.y * (1.0 - y * 0.3);
  vec3 p = vec3(cos(ang) * rad, y * 2.3, sin(ang) * rad);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.6 + aSeed.w * 2.5) / -mv.z;
  vA = uOn * smoothstep(0.0, 0.12, y) * (1.0 - y) * 0.85;
  vH = y;
}`;

const DISC_VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FS = /* glsl */`
uniform float uTime; uniform float uOn; uniform float uPulse; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
  float ring1 = exp(-pow((r - 0.93) * 38.0, 2.0));
  float ring2 = exp(-pow((r - 0.70) * 60.0, 2.0)) * step(0.45, fract(ang * 24.0 + uTime * 0.35));
  float ring3 = exp(-pow((r - 0.42) * 70.0, 2.0)) * 0.7;
  float glow = pow(1.0 - r, 2.0) * 0.4;
  float wave = exp(-pow((r - fract(uTime * 0.45)) * 9.0, 2.0)) * 0.25;
  float a = ring1 * 0.95 + ring2 * 0.55 + ring3 + glow + wave + uPulse * pow(1.0 - r, 1.5) * 1.2;
  gl_FragColor = vec4(mix(uA, uB, r) + uPulse * 0.4, a * uOn);
}`;
const BEAM_FS = /* glsl */`
uniform float uTime; uniform float uOn; uniform float uPulse; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
void main() {
  float h = vUv.y;
  float streak = 0.65 + 0.35 * sin(vUv.x * 6.2831853 * 28.0 + uTime * 1.6) * sin(vUv.x * 6.2831853 * 9.0 - uTime * 0.7);
  float a = pow(1.0 - h, 2.4) * (0.11 + uPulse * 0.25) * streak;
  gl_FragColor = vec4(mix(uA, uB, h * 0.8), a * uOn);
}`;

/* ------------------------------------------------------------------ petits outils géométriques */
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function slab(w, h, d, r, bevel = 0.012) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -d / 2);
  return g;
}
function segGeo(arr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}
// afficheur 7 segments (calculatrice)
const SEG = { a: [0, 1, 1, 1], b: [1, 1, 1, .5], c: [1, .5, 1, 0], d: [0, 0, 1, 0], e: [0, 0, 0, .5], f: [0, .5, 0, 1], g: [0, .5, 1, .5] };
const DIGITS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function sevenSeg(str, x, y, w, h, z, out) {
  let cx = x;
  for (const ch of str) {
    if (ch === '.') { out.push(cx - w * .25, y, z, cx - w * .25 + w * .08, y, z); continue; }
    for (const k of DIGITS[ch] || '') { const s = SEG[k]; out.push(cx + s[0] * w, y + s[1] * h, z, cx + s[2] * w, y + s[3] * h, z); }
    cx += w * 1.55;
  }
}

/* ------------------------------------------------------------------ les objets */
function buildBook(add) {
  const pageCurve = x => 0.2 * Math.sin(Math.min(x, 1) * Math.PI * 0.62) - (x > 0.9 ? (x - 0.9) * 0.25 : 0);
  const page = (side, lift, scale) => {
    const g = new THREE.PlaneGeometry(1, 1.36, 24, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5;           // 0 → reliure, 1 → bord
      const z = p.getY(i);
      p.setXYZ(i, side * u * scale, pageCurve(u) + lift, z * scale);
    }
    g.computeVertexNormals();
    return g;
  };
  [-1, 1].forEach(side => {
    add('surf', page(side, 0, 1));
    add('surf', page(side, -0.035, 1.0));
    add('fill', page(side, -0.07, 1.04), 0.1);  // couverture
    // lignes de texte qui suivent la courbure de la page
    const seg = [];
    for (let r = 0; r < 11; r++) {
      const z = -0.5 + r * 0.1, len = r % 4 === 3 ? 0.45 : 0.76;
      for (let k = 0; k < 6; k++) {
        const u0 = 0.12 + len * k / 6, u1 = 0.12 + len * (k + 1) / 6;
        seg.push(side * u0, pageCurve(u0) + 0.006, z, side * u1, pageCurve(u1) + 0.006, z);
      }
    }
    // contour de la page
    for (let k = 0; k < 12; k++) {
      const u0 = k / 12, u1 = (k + 1) / 12;
      [-0.68, 0.68].forEach(z => seg.push(side * u0, pageCurve(u0), z, side * u1, pageCurve(u1), z));
    }
    seg.push(side, pageCurve(1), -0.68, side, pageCurve(1), 0.68);
    add('line', segGeo(seg));
  });
  add('line', segGeo([0, 0, -0.7, 0, 0, 0.7]));
  return { rotX: 0.62 };
}

function buildTablet(add) {
  const W = 1.7, H = 1.12;
  add('surf', slab(W, H, 0.05, 0.08));
  add('fill', new THREE.PlaneGeometry(W - 0.14, H - 0.14).translate(0, 0, 0.042), 0.07);
  // emploi du temps : grille + cours
  const x0 = -(W - 0.2) / 2, x1 = (W - 0.2) / 2, y0 = -(H - 0.2) / 2, y1 = (H - 0.2) / 2, z = 0.046;
  const cols = [x0, x0 + 0.17]; for (let c = 1; c <= 5; c++) cols.push(x0 + 0.17 + (x1 - x0 - 0.17) * c / 5);
  const rows = []; for (let r = 0; r <= 7; r++) rows.push(y1 - (y1 - y0) * r / 7);
  const seg = [];
  cols.forEach(x => seg.push(x, y0, z, x, y1, z));
  rows.forEach(y => seg.push(x0, y, z, x1, y, z));
  // jours (en-tête) et heures : petits traits façon texte
  for (let c = 1; c < 6; c++) { const cx = (cols[c] + cols[c + 1]) / 2; seg.push(cx - 0.07, (rows[0] + rows[1]) / 2, z + 0.002, cx + 0.07, (rows[0] + rows[1]) / 2, z + 0.002); }
  for (let r = 1; r < 7; r++) { const cy = (rows[r] + rows[r + 1]) / 2; seg.push(x0 + 0.04, cy, z + 0.002, x0 + 0.13, cy, z + 0.002); }
  add('line', segGeo(seg));
  const lessons = [[1, 1], [1, 2], [1, 4], [2, 3], [2, 5], [3, 1], [3, 2], [3, 6], [4, 4], [4, 5], [5, 2], [5, 3], [5, 6], [2, 1], [4, 1]];
  const blocks = lessons.map(([c, r]) => {
    const w = cols[c + 1] - cols[c] - 0.03, h = rows[r] - rows[r + 1] - 0.03;
    return new THREE.PlaneGeometry(w, h).translate((cols[c] + cols[c + 1]) / 2, (rows[r] + rows[r + 1]) / 2, z + 0.004);
  });
  add('fill', mergeGeometries(blocks), 0.3);
  return { rotX: -0.14 };
}

function buildCalculator(add) {
  const W = 0.96, H = 1.42;
  add('surf', slab(W, H, 0.08, 0.09));
  add('fill', new THREE.PlaneGeometry(W - 0.2, 0.3).translate(0, H / 2 - 0.25, 0.058), 0.22);
  const seg = [];
  sevenSeg('3.14159', -0.33, H / 2 - 0.32, 0.07, 0.13, 0.062, seg);
  add('line', segGeo(seg));
  const keys = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    keys.push(slab(0.15, 0.12, 0.04, 0.03, 0.008).translate(-0.3 + c * 0.2, 0.18 - r * 0.19, 0.06));
  }
  add('surf', mergeGeometries(keys));
  return { rotX: -0.24, rotZ: 0.06 };
}

function buildGlobe(add, spin) {
  const R = 0.62;
  add('surf', new THREE.SphereGeometry(R, 40, 28), 0.03, spin);
  const seg = [];
  for (let m = 0; m < 12; m++) {          // méridiens
    const a = m / 12 * Math.PI * 2;
    for (let k = 0; k < 24; k++) {
      const t0 = k / 24 * Math.PI, t1 = (k + 1) / 24 * Math.PI;
      seg.push(R * Math.sin(t0) * Math.cos(a), R * Math.cos(t0), R * Math.sin(t0) * Math.sin(a), R * Math.sin(t1) * Math.cos(a), R * Math.cos(t1), R * Math.sin(t1) * Math.sin(a));
    }
  }
  for (let p = 1; p < 8; p++) {           // parallèles
    const t = p / 8 * Math.PI, y = R * Math.cos(t), rr = R * Math.sin(t);
    for (let k = 0; k < 40; k++) {
      const a0 = k / 40 * Math.PI * 2, a1 = (k + 1) / 40 * Math.PI * 2;
      seg.push(rr * Math.cos(a0), y, rr * Math.sin(a0), rr * Math.cos(a1), y, rr * Math.sin(a1));
    }
  }
  add('line', segGeo(seg), 0, spin);
  // « continents » : points là où un petit bruit dépasse un seuil
  const dots = [];
  for (let i = 0; i < 4200 && dots.length < 2400; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const lat = Math.asin(u), lon = a;
    const n = Math.sin(lon * 2 + 0.6) * Math.cos(lat * 3) + 0.6 * Math.sin(lon * 5 + lat * 4) + 0.35 * Math.cos(lon * 9 - lat * 7);
    if (n > 0.55 && Math.abs(lat) < 1.3) dots.push(R * 1.005 * s * Math.cos(a), R * 1.005 * u, R * 1.005 * s * Math.sin(a));
  }
  add('dot', segGeo(dots), 0, spin);
  // monture : arc + pied
  const arc = new THREE.TorusGeometry(R + 0.09, 0.014, 6, 56, Math.PI * 1.15);
  arc.rotateZ(-Math.PI * 0.575 + Math.PI / 2);
  add('surf', arc, 0.08);
  add('surf', new THREE.CylinderGeometry(0.025, 0.025, 0.22, 10).translate(0, -R - 0.17, 0), 0.08);
  add('surf', new THREE.CylinderGeometry(0.3, 0.36, 0.06, 40).translate(0, -R - 0.3, 0), 0.06);
  spin.rotation.z = 0.41;                // axe de la Terre
  return { spinner: spin };
}

/* ------------------------------------------------------------------ création */
export function createHolo(host, opts) {
  const isReduced = opts.reduced || (() => false);
  const onError = opts.onError || (() => {});

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
  if (!renderer.getContext()) throw new Error('no webgl');
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Hologram: drag to turn it around');
  canvas.setAttribute('role', 'img');
  host.appendChild(canvas);

  let lost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; onError(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  camera.position.set(0, 1.62, 4.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 1.0;
  controls.maxPolarAngle = 1.78;
  controls.autoRotateSpeed = 1.6;
  controls.update();
  let dirty = true;
  controls.addEventListener('change', () => { dirty = true; });

  const T = { value: 0 }, FLICK = { value: 1 }, PRu = { value: PR };
  const A = { value: COL_A }, B = { value: COL_B };
  const add = THREE.AdditiveBlending;

  // socle lumineux + faisceau
  const pedU = { uTime: T, uOn: { value: 0 }, uPulse: { value: 0 }, uA: A, uB: B };
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 72).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms: pedU, vertexShader: DISC_VS, fragmentShader: DISC_FS, transparent: true, depthWrite: false, blending: add, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 2.5, 64, 1, true).translate(0, 1.25, 0),
    new THREE.ShaderMaterial({ uniforms: pedU, vertexShader: DISC_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: add, side: THREE.DoubleSide }));
  scene.add(disc, beam);

  // particules qui montent
  const RISE_N = 160, seeds = new Float32Array(RISE_N * 4);
  for (let i = 0; i < RISE_N; i++) seeds.set([Math.random() * 6.283, 0.25 + Math.random() * 0.8, Math.random(), 0.05 + Math.random() * 0.12], i * 4);
  const riseGeo = new THREE.BufferGeometry();
  riseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RISE_N * 3), 3));
  riseGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const riseU = { uTime: T, uSize: { value: 22 }, uPR: PRu, uOn: { value: 0 } };
  const rise = new THREE.Points(riseGeo, new THREE.ShaderMaterial({ uniforms: { ...riseU, uA: A, uB: B }, vertexShader: RISE_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: add }));
  rise.frustumCulled = false;
  scene.add(rise);

  // objets
  const floater = new THREE.Group();
  scene.add(floater);
  const builders = [buildBook, buildTablet, buildCalculator, buildGlobe];
  const objects = builders.map(build => {
    const U = { uTime: T, uReveal: { value: 0 }, uY0: { value: 0 }, uY1: { value: 1 }, uFlicker: FLICK, uGain: { value: 1 }, uA: A, uB: B };
    const root = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group();
    root.add(tilt); tilt.add(spin);
    const parts = [];
    const addPart = (kind, geo, base = 0.05, parent = tilt) => {
      let obj;
      if (kind === 'line') {
        obj = new THREE.LineSegments(geo, new THREE.ShaderMaterial({ uniforms: { ...U, uBase: { value: 0 } }, defines: { LINE: '' }, vertexShader: SURF_VS, fragmentShader: SURF_FS, transparent: true, depthWrite: false, blending: add }));
      } else if (kind === 'dot') {
        obj = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { ...U, uSize: { value: 9 }, uPR: PRu }, vertexShader: DOT_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: add }));
      } else {
        obj = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { ...U, uBase: { value: kind === 'fill' ? base : 0.04 } }, vertexShader: SURF_VS, fragmentShader: SURF_FS, transparent: true, depthWrite: false, blending: add, side: THREE.DoubleSide }));
        // contours nets en plus du fresnel
        if (kind === 'surf' && geo.type === 'ExtrudeGeometry') {
          parent.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), new THREE.ShaderMaterial({ uniforms: { ...U, uBase: { value: 0 } }, defines: { LINE: '' }, vertexShader: SURF_VS, fragmentShader: SURF_FS, transparent: true, depthWrite: false, blending: add })));
        }
      }
      parent.add(obj); parts.push(obj);
    };
    const cfg = build(addPart, spin) || {};
    tilt.rotation.x = cfg.rotX || 0; tilt.rotation.z = cfg.rotZ || 0;
    // mise à l'échelle et placement : au-dessus du socle
    root.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(2.2 / size.x, 1.6 / size.y, 2.2 / size.z);
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, 0.5 - box.min.y, -c.z);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    U.uY0.value = box.min.y; U.uY1.value = box.max.y;
    // nuage de particules pour la matérialisation : points tirés sur les surfaces
    const targets = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, idx = o.geometry.index, triN = idx ? idx.count / 3 : pos.count / 3;
      const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      const n = Math.min(500, Math.ceil(triN * 0.5) + 60);
      for (let k = 0; k < n; k++) {
        const t = Math.floor(Math.random() * triN);
        for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + j) : t * 3 + j);
        let a = Math.random(), b = Math.random(); if (a + b > 1) { a = 1 - a; b = 1 - b; }
        const p = v[0].clone().multiplyScalar(1 - a - b).addScaledVector(v[1], a).addScaledVector(v[2], b).applyMatrix4(o.matrixWorld);
        targets.push(p);
      }
    });
    while (targets.length > 1400) targets.splice(Math.floor(Math.random() * targets.length), 1);
    const N = targets.length, tp = new Float32Array(N * 3), sp = new Float32Array(N * 3), dl = new Float32Array(N);
    targets.forEach((p, i) => {
      tp.set([p.x, p.y, p.z], i * 3);
      const a = Math.random() * 6.283, r = 0.9 + Math.random() * 1.4;
      sp.set([p.x * 0.3 + Math.cos(a) * r, Math.random() * 0.4, p.z * 0.3 + Math.sin(a) * r], i * 3);
      dl[i] = (p.y - box.min.y) / Math.max(box.max.y - box.min.y, 0.01) * 0.25 + Math.random() * 0.12;
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    bg.setAttribute('aStart', new THREE.BufferAttribute(sp, 3));
    bg.setAttribute('aDelay', new THREE.BufferAttribute(dl, 1));
    const buildU = { uP: { value: 0 }, uSize: { value: 15 }, uPR: PRu, uA: A, uB: B };
    const cloud = new THREE.Points(bg, new THREE.ShaderMaterial({ uniforms: buildU, vertexShader: BUILD_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: add }));
    cloud.frustumCulled = false; cloud.visible = false;
    root.visible = false;
    floater.add(root); floater.add(cloud);
    return { root, U, cloud, buildU, y0: box.min.y, y1: box.max.y, spinner: cfg.spinner || null };
  });

  /* -------------------------------------------------------------- état */
  let cur = -1, want = -1, outObj = -1, outT0 = 0, inT0 = 0, inDone = true, pedOn = 0;
  const clock = () => performance.now();

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  function show(i, instant) {
    i = i < 0 ? -1 : i % objects.length;
    if (i === want) return;
    want = i;
    const now = clock();
    if (instant || isReduced()) {
      objects.forEach((o, k) => { o.root.visible = k === i; o.cloud.visible = false; o.U.uReveal.value = 1; o.U.uGain.value = 1; });
      cur = i; outObj = -1; inDone = true; pedOn = i >= 0 ? 1 : 0;
      dirty = true; return;
    }
    if (cur >= 0) { if (outObj >= 0 && outObj !== cur) objects[outObj].root.visible = false; outObj = cur; outT0 = now; objects[cur].cloud.visible = false; }
    cur = i;
    inT0 = now + (outObj >= 0 ? 320 : 0);
    inDone = i < 0;
    if (i >= 0) { const o = objects[i]; o.U.uReveal.value = 0; o.root.visible = true; o.cloud.visible = true; o.buildU.uP.value = 0; }
    dirty = true;
  }

  // renvoie true tant qu'il faut d'autres images
  function render(nowMs) {
    if (lost) return false;
    const red = isReduced();
    controls.autoRotate = !red;
    controls.enableDamping = !red;
    const t = nowMs / 1000;
    let animating = false;
    if (!red) T.value = t;
    // scintillement léger, avec de rares baisses
    const glitch = Math.sin(Math.floor(t * 9) * 12.9898) * 43758.5453;
    FLICK.value = red ? 1 : 0.94 + 0.05 * Math.sin(t * 21) * Math.sin(t * 6.3) - ((glitch - Math.floor(glitch)) > 0.965 ? 0.22 : 0);

    // sortie de l'objet précédent (de haut en bas)
    if (outObj >= 0) {
      const p = Math.min(1, (nowMs - outT0) / 320);
      objects[outObj].U.uReveal.value = 1 - p;
      if (p >= 1) { objects[outObj].root.visible = false; outObj = -1; }
      animating = true;
    }
    // entrée : particules qui s'assemblent puis balayage de bas en haut
    let pulse = 0;
    if (cur >= 0 && !inDone) {
      const o = objects[cur], p = Math.max(0, Math.min(1, (nowMs - inT0) / 1500));
      o.buildU.uP.value = p;
      const q = Math.max(0, Math.min(1, (p - 0.32) / 0.6));
      o.U.uReveal.value = q * q * (3 - 2 * q);
      pulse = Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.8;
      if (p >= 1) { inDone = true; o.cloud.visible = false; o.U.uReveal.value = 1; }
      animating = true;
    }
    // socle : s'allume quand un objet est là
    const pedTarget = cur >= 0 ? 1 : 0;
    if (red) pedOn = pedTarget;
    else if (Math.abs(pedOn - pedTarget) > 0.005) { pedOn += (pedTarget - pedOn) * 0.08; animating = true; }
    else pedOn = pedTarget;
    pedU.uOn.value = pedOn; pedU.uPulse.value = pulse; riseU.uOn.value = pedOn;
    rise.material.uniforms.uOn.value = pedOn;

    // flottement + rotation propre du globe
    const bob = red ? 0 : Math.sin(t * 1.15) * 0.045;
    floater.position.y = bob;
    objects.forEach(o => { o.U.uY0.value = o.y0 + bob; o.U.uY1.value = o.y1 + bob; if (o.spinner && !red) o.spinner.rotation.y = t * 0.35; });

    controls.update();
    const visible = cur >= 0 || outObj >= 0 || pedOn > 0;
    const live = !red && visible;
    if (live || animating || dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
    return live || animating || (controls.enableDamping && dirty);
  }

  function dispose() {
    ro.disconnect();
    controls.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignoré */ }
    canvas.remove();
  }

  return {
    show, render, dispose, names: NAMES, count: objects.length,
    get index() { return want; },
    invalidate() { dirty = true; },
  };
}
