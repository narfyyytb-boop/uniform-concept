/* =============================================================================
   Sophie Barat — visionneuse / configurateur 3D (Three.js, sans CDN)
   Personnages réalistes : un modèle texturé par tenue, chargé à la demande.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/addons/OrbitControls.js';
import { GLTFLoader } from '../vendor/three/addons/GLTFLoader.js';
import { RoomEnvironment } from '../vendor/three/addons/RoomEnvironment.js';
import { MeshoptDecoder } from '../vendor/three/addons/meshopt_decoder.module.js';
import { COLORS, TENUES, DEFAULT_TENUE, MODEL_DIR } from './collection-data.js';

const SPACING = 0.36;   // demi-écart entre les deux personnages (m)
const tenueById = id => TENUES.find(t => t.id === id);

/* Recoloration : les pixels bleu nuit (ou blancs) de la zone d'une pièce prennent la couleur choisie,
   en conservant l'ombrage d'origine (plis, coutures). */
function recolorMaterial(map) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0, envMapIntensity: 0.5 });
  const u = {
    uTop: { value: new THREE.Vector4(0, 0, 0, 0) },      // yMin, yMax, classe (0 navy / 1 blanc), actif
    uTopColor: { value: new THREE.Color() },
    uBot: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBotColor: { value: new THREE.Color() },
    uLocal: { value: new THREE.Matrix4() },               // maillage -> repère du personnage (mètres, pieds à 0)
    // bras : segment (du haut de l'avant-bras au poignet) + rayon ; le bas des manches descend
    // sous le haut de la jupe ou du pantalon, il doit pourtant suivre la couleur du haut
    uArmA0: { value: new THREE.Vector4() }, uArmB0: { value: new THREE.Vector3() },
    uArmA1: { value: new THREE.Vector4() }, uArmB1: { value: new THREE.Vector3() },
    uArmOn: { value: 0 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uLocal;\nvarying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = (uLocal * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLoc;
      uniform vec4 uTop; uniform vec3 uTopColor; uniform vec4 uBot; uniform vec3 uBotColor;
      uniform vec4 uArmA0; uniform vec3 uArmB0; uniform vec4 uArmA1; uniform vec3 uArmB1; uniform float uArmOn;
      float sbArm(vec4 a, vec3 b) {
        vec3 ab = b - a.xyz; float t = clamp(dot(vLoc - a.xyz, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
        float d = length(vLoc - (a.xyz + ab * t));
        return (1.0 - smoothstep(a.w - 0.008, a.w + 0.008, d)) * step(b.y - 0.03, vLoc.y) * step(vLoc.y, a.y + 0.05);
      }
      float sbClass(vec3 c, float cls) {
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        if (cls < 0.5) {
          float blue = smoothstep(1.15, 1.7, c.b / max(max(c.r, c.g), 0.0006));
          return blue * (1.0 - smoothstep(0.045, 0.085, lum));
        }
        float sat = (mx - mn) / max(mx, 0.001);
        return smoothstep(0.3, 0.5, lum) * (1.0 - smoothstep(0.07, 0.16, sat));
      }
      vec3 sbApply(vec3 c, vec4 z, vec3 target, float arm, float top) {
        if (z.w < 0.5) return c;
        // fondu de ±1 cm aux limites : l'ourlet du haut et le haut de la jupe ou du pantalon se touchent
        float inZone = smoothstep(z.x - 0.01, z.x + 0.01, vLoc.y) * (1.0 - smoothstep(z.y - 0.01, z.y + 0.01, vLoc.y));
        inZone = top > 0.5 ? max(inZone, arm) : inZone * (1.0 - arm);
        float m = sbClass(c, z.z) * inZone;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float ref = z.z < 0.5 ? 0.012 : 0.62;
        vec3 nc = target * clamp(lum / ref, 0.0, 2.2);
        return mix(c, nc, m);
      }`).replace('#include <map_fragment>', `#include <map_fragment>
      float sbA = uArmOn > 0.5 ? max(sbArm(uArmA0, uArmB0), sbArm(uArmA1, uArmB1)) : 0.0;
      diffuseColor.rgb = sbApply(diffuseColor.rgb, uTop, uTopColor, sbA, 1.0);
      diffuseColor.rgb = sbApply(diffuseColor.rgb, uBot, uBotColor, sbA, 0.0);`);
  };
  return mat;
}

/* Logo de poitrine : décalcomanie nette (objet « logo » ajouté par source/ai/apply_logo.py), posée 1,2 mm
   au-dessus du tissu. Jamais recolorée par le configurateur ; seule exception : sur une pièce passée en blanc,
   le texte blanc du logo prend le bleu nuit du logo fourni pour fond clair (logo-sophie-barat.png). */
const LOGO_INK = new THREE.Color('#091f4e');
function logoMaterial(src) {
  const map = src.map;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; }
  const mat = new THREE.MeshStandardMaterial({
    map, transparent: true, depthWrite: false, roughness: 0.7, metalness: 0, envMapIntensity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,   // toujours devant le tissu, sans scintillement
  });
  const u = { uInk: { value: new THREE.Vector4(LOGO_INK.r, LOGO_INK.g, LOGO_INK.b, 0) } };
  mat.userData.logo = (src.name || '').replace(/^logo_?/, '') || 'blanc';   // 'blanc' (texte blanc) ou 'sb' (monogramme)
  mat.userData.u = u;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uInk = u.uInk;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uInk;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      if (uInk.w > 0.5) {
        float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        float sat = (mx - mn) / max(mx, 0.001);
        diffuseColor.rgb = mix(diffuseColor.rgb, uInk.rgb, smoothstep(0.45, 0.75, lum) * (1.0 - smoothstep(0.12, 0.3, sat)));
      }`);
  };
  return mat;
}

export class UniformViewer extends EventTarget {
  constructor({ canvas, container, reducedMotion = false }) {
    super();
    this.canvas = canvas; this.container = container; this.reducedMotion = reducedMotion;
    this.slots = {};
    this.cache = new Map();
    this.state = null; this.immersive = false; this.selected = 'garcon';
    this.anim = []; this.needsRender = true;
    this.loader = new GLTFLoader(); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this._initThree();
  }

  _initThree() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.6 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    this.camera.position.set(0, 1.2, 4.7);
    // Les textures viennent de photos (déjà éclairées) : éclairage doux et enveloppant
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8090c0, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(0.7, 5, 2.6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.2, bottom: -0.4, near: 1, far: 10 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    scene.add(key);
    const back = new THREE.DirectionalLight(0xdfe6ff, 0.75); back.position.set(-0.8, 3.5, -3.5); scene.add(back);
    const rimBlue = new THREE.SpotLight(0x3f86ff, 22, 12, Math.PI / 5, 0.6, 1.4); rimBlue.position.set(-2.4, 2.8, -2.6); scene.add(rimBlue);
    const rimViolet = new THREE.SpotLight(0x8a4dff, 18, 12, Math.PI / 5, 0.6, 1.4); rimViolet.position.set(2.6, 2.2, -2.4); scene.add(rimViolet);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.ShadowMaterial({ opacity: 0.24 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    this._podium();

    const c = this.controls = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true; c.dampingFactor = 0.08; c.enablePan = false; c.screenSpacePanning = true;
    c.minDistance = 2.4; c.maxDistance = 7; c.minPolarAngle = 0.55; c.maxPolarAngle = 1.72;
    c.target.set(0, 0.92, 0);
    c.autoRotate = !this.reducedMotion; c.autoRotateSpeed = 1.1;
    c.addEventListener('change', () => { this.needsRender = true; });
    c.addEventListener('start', () => { this.container.classList.add('has-interacted'); this.dispatchEvent(new Event('interact')); });

    for (const k of ['garcon', 'fille']) {
      const group = new THREE.Group(); group.position.x = k === 'garcon' ? -SPACING : SPACING;
      scene.add(group); this.slots[k] = { group, current: null, targetX: group.position.x, wanted: null };
    }
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this._resize()).observe(this.container); this._resize();
    this.visible = true;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { threshold: 0.01 }).observe(this.container);
    this._keyboard();
    r.setAnimationLoop(() => this._tick());
  }

  _podium() {
    this.podium = new THREE.Group(); this.scene.add(this.podium); this.podiumMats = [];
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(90,140,255,0.55)'); grd.addColorStop(0.55, 'rgba(60,100,255,0.22)'); grd.addColorStop(1, 'rgba(40,60,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mk = o => { const m = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...o, opacity: 0 }); m.userData.op = o.opacity ?? 1; this.podiumMats.push(m); return m; };
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; this.podium.add(m); };
    // sol sombre dégradé : détache le podium de la photo du lycée en arrière-plan
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 256;
    const g2 = cv2.getContext('2d'); const grd2 = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd2.addColorStop(0, 'rgba(255,255,255,0.92)'); grd2.addColorStop(0.62, 'rgba(255,255,255,0.75)'); grd2.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grd2; g2.fillRect(0, 0, 256, 256);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x07163f, alphaMap: new THREE.CanvasTexture(cv2), transparent: true, depthWrite: false, opacity: 0 });
    floorMat.userData.op = 0.85; this.podiumMats.push(floorMat);
    add(new THREE.CircleGeometry(1.75, 64), floorMat, 0.0005);
    add(new THREE.CircleGeometry(1.25, 64), mk({ map: tex, opacity: 0.9 }), 0.001);
    add(new THREE.RingGeometry(0.98, 1.0, 128), mk({ color: 0x5b8dff, opacity: 0.95 }), 0.003);
    add(new THREE.RingGeometry(1.02, 1.07, 128), mk({ color: 0x2f6bff, opacity: 0.35 }), 0.002);
    add(new THREE.RingGeometry(0.80, 0.815, 128), mk({ color: 0x9a6bff, opacity: 0.7 }), 0.003);
  }

  _resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.75 ? 34 : 28;
    this.camera.updateProjectionMatrix(); this.needsRender = true;
  }

  _keyboard() {
    this.canvas.addEventListener('keydown', e => {
      const c = this.controls; const step = 0.18;
      const sph = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target));
      const keys = { ArrowLeft: () => (sph.theta -= step), ArrowRight: () => (sph.theta += step),
        ArrowUp: () => (sph.phi = Math.max(c.minPolarAngle, sph.phi - step * 0.6)), ArrowDown: () => (sph.phi = Math.min(c.maxPolarAngle, sph.phi + step * 0.6)),
        '+': () => (sph.radius = Math.max(c.minDistance, sph.radius * 0.88)), '=': () => (sph.radius = Math.max(c.minDistance, sph.radius * 0.88)),
        '-': () => (sph.radius = Math.min(c.maxDistance, sph.radius * 1.12)) };
      if (!keys[e.key]) return;
      e.preventDefault(); keys[e.key](); this.setAutoRotate(false);
      this.camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(sph)); c.update(); this.needsRender = true;
    });
  }

  /* ---------------------------------------------------------------- chargement */
  _loadTenue(id, onProgress) {
    if (!this.cache.has(id)) {
      this.cache.set(id, new Promise((resolve, reject) => {
        this.loader.load(MODEL_DIR + id + '.glb', gltf => {
          const root = gltf.scene;
          root.updateMatrixWorld(true);                         // pas encore dans la scène : matrixWorld = repère du personnage
          root.traverse(o => {
            if (!o.isMesh) return;
            if (/^logo/.test(o.material?.name || '')) {           // décalcomanie du logo : son propre matériau
              o.material = logoMaterial(o.material); o.castShadow = false; o.receiveShadow = true; o.renderOrder = 1;
              return;
            }
            o.castShadow = true; o.receiveShadow = true;
            const map = o.material.map; if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; }
            o.material = recolorMaterial(map);
            o.material.userData.u.uLocal.value.copy(o.matrixWorld);
          });
          root.userData.id = id;
          resolve(root);
        }, ev => onProgress?.(ev.total ? ev.loaded / ev.total : 0), err => { this.cache.delete(id); reject(err); });
      }));
    }
    return this.cache.get(id);
  }

  async load(onProgress) {
    const ids = [DEFAULT_TENUE.garcon, DEFAULT_TENUE.fille];
    const prog = [0, 0];
    await Promise.all(ids.map((id, i) => this._loadTenue(id, p => { prog[i] = p; onProgress?.((prog[0] + prog[1]) / 2); })));
    this.ready = true;
  }

  /** Précharge en arrière-plan les autres tenues (sans bloquer l'affichage). */
  preloadAll() {
    const ids = TENUES.map(t => t.id).filter(id => !this.cache.has(id));
    const next = () => { const id = ids.shift(); if (!id) return; this._loadTenue(id).catch(() => {}).finally(() => setTimeout(next, 200)); };
    next();
  }

  /* ---------------------------------------------------------------- état */
  /** state = { model, immersive, outfits: { garcon: { tenue, colors:{itemId:key} }, fille: {...} } } */
  setState(state, { animate = true } = {}) {
    const prev = this.state; this.state = structuredClone(state);
    for (const k of Object.keys(this.slots)) this._applySlot(k, animate);
    if (!prev || prev.model !== state.model || prev.immersive !== state.immersive) {
      this.selected = state.model; this.immersive = state.immersive; this._layout(!animate || !prev);
    }
    this.needsRender = true;
  }

  async _applySlot(k, animate) {
    const slot = this.slots[k]; const o = this.state.outfits[k];
    slot.wanted = o.tenue;
    if (slot.current?.userData.id !== o.tenue) {
      this.dispatchEvent(new CustomEvent('busy', { detail: true }));
      let root;
      try { root = await this._loadTenue(o.tenue); }
      catch (e) { this.dispatchEvent(new CustomEvent('error', { detail: e })); return; }
      finally { this.dispatchEvent(new CustomEvent('busy', { detail: false })); }
      if (slot.wanted !== o.tenue) return;
      const old = slot.current;
      slot.group.add(root); slot.current = root;
      if (old) slot.group.remove(old);
      if (animate && !this.reducedMotion && old) this._pop(root);
    }
    this._colors(k);
    this.needsRender = true;
  }

  _colors(k) {
    const slot = this.slots[k]; const o = this.state.outfits[k]; const t = tenueById(o.tenue);
    if (!slot.current || !t) return;
    const def = { navy: 'nuit', white: 'blanc' };
    slot.current.traverse(m => {
      if (!m.isMesh) return;
      const u = m.material.userData.u;
      if (m.material.userData.logo) {                     // logo : texte blanc -> bleu nuit sur une pièce blanche
        u.uInk.value.w = m.material.userData.logo === 'blanc' && o.colors[t.haut] === 'blanc' && t.zones.haut[2] === 'navy' ? 1 : 0;
        return;
      }
      const arms = t.bras || [];
      u.uArmOn.value = arms.length ? 1 : 0;
      [[u.uArmA0, u.uArmB0], [u.uArmA1, u.uArmB1]].forEach(([A, B], i) => {
        const s = arms[i] || arms[0];
        if (s) { A.value.set(s[0], s[1], s[2], s[6]); B.value.set(s[3], s[4], s[5]); }
      });
      for (const [part, uz, uc] of [['haut', u.uTop, u.uTopColor], ['bas', u.uBot, u.uBotColor]]) {
        const item = t[part]; const [y0, y1, cls] = t.zones[part];
        const chosen = o.colors[item]; const active = !!chosen && chosen !== def[cls];
        uz.value.set(y0, y1, cls === 'white' ? 1 : 0, active ? 1 : 0);
        if (active) uc.value.set(COLORS[chosen].hex);
      }
    });
  }

  _pop(root) {
    const t0 = performance.now();
    this.anim.push(now => {
      const k = Math.min(1, (now - t0) / 450); const e = 1 - Math.pow(1 - k, 3);
      root.scale.setScalar(0.97 + 0.03 * e); root.rotation.y = (1 - e) * 0.35;
      return k < 1;
    });
  }

  _layout(instant) {
    const imm = this.immersive; const sel = this.selected;
    for (const [k, s] of Object.entries(this.slots)) {
      const isSel = k === sel;
      s.targetX = imm ? (isSel ? 0 : (k === 'garcon' ? -3 : 3)) : (k === 'garcon' ? -SPACING : SPACING);
      s.group.visible = imm ? isSel : true;
      if (instant || this.reducedMotion) s.group.position.x = s.targetX;
    }
    const c = this.controls;
    c.enablePan = imm; c.minDistance = imm ? 0.9 : 2.4; c.maxDistance = imm ? 6.5 : 7;
    const target = imm ? new THREE.Vector3(0, 0.82, 0) : new THREE.Vector3(sel === 'garcon' ? -0.12 : 0.12, 0.9, 0);
    const pos = imm ? new THREE.Vector3(0, 1.02, 4.7) : null;
    this._tweenCamera(target, pos, instant);
    this.podiumScale = imm ? 0.62 : 1;
  }

  _tweenCamera(target, pos, instant) {
    const c = this.controls; const cam = this.camera;
    const t0 = c.target.clone(), p0 = cam.position.clone();
    const p1 = pos ?? p0.clone().sub(t0).add(target);
    if (instant || this.reducedMotion) { c.target.copy(target); cam.position.copy(p1); c.update(); this.needsRender = true; return; }
    const start = performance.now(); const dur = 900;
    this.anim.push(now => {
      const k = Math.min(1, (now - start) / dur); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      c.target.lerpVectors(t0, target, e); cam.position.lerpVectors(p0, p1, e); c.update();
      return k < 1;
    });
  }

  view(name) {
    const x = this.immersive ? 0 : (this.selected === 'garcon' ? -SPACING : SPACING);
    const t = new THREE.Vector3(x, 0.84, 0); let p;
    switch (name) {
      case 'face': p = new THREE.Vector3(x, 1.0, 4.5); break;
      case 'dos': p = new THREE.Vector3(x, 1.0, -4.5); break;
      case 'profil': p = new THREE.Vector3(x + 4.5, 1.0, 0.2); break;
      case 'detail': t.set(x, 1.3, 0); p = new THREE.Vector3(x + 0.35, 1.42, 1.15); break;
      default: return;
    }
    this.setAutoRotate(false); this._tweenCamera(t, p, false);
  }

  zoom(f) {
    const c = this.controls; const off = this.camera.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(off.length() * f, c.minDistance, c.maxDistance);
    this._tweenCamera(c.target.clone(), c.target.clone().add(off.setLength(len)), false);
  }

  reset() { this.setAutoRotate(!this.reducedMotion); this._layout(false); if (!this.immersive) { const c = this.controls; this._tweenCamera(c.target.clone(), new THREE.Vector3(c.target.x, 1.2, 4.7), false); } }
  setPanMode(on) { const c = this.controls; c.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; c.touches.ONE = on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE; }
  setAutoRotate(on) { this.controls.autoRotate = on; this.dispatchEvent(new CustomEvent('autorotate', { detail: on })); }
  setReducedMotion(on) { this.reducedMotion = on; if (on) this.setAutoRotate(false); }
  async screenshot() { this.renderer.render(this.scene, this.camera); return new Promise(res => this.canvas.toBlob(res, 'image/png')); }

  _tick() {
    const now = performance.now(); const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.visible || document.hidden) return;
    let active = false;
    if (this.anim.length) { this.anim = this.anim.filter(f => f(now)); active = true; }
    for (const s of Object.values(this.slots)) {
      const dx = s.targetX - s.group.position.x;
      if (Math.abs(dx) > 1e-4) { s.group.position.x += dx * Math.min(1, dt * 6); active = true; }
    }
    for (const m of this.podiumMats) {
      const target = this.ready ? m.userData.op : 0;
      if (Math.abs(m.opacity - target) > 0.003) { m.opacity += (target - m.opacity) * 0.06; active = true; }
    }
    const ps = this.podiumScale ?? 1; const cur = this.podium.scale.x;
    if (Math.abs(cur - ps) > 1e-3) { this.podium.scale.setScalar(cur + (ps - cur) * Math.min(1, dt * 5)); active = true; }
    const moved = this.controls.update();
    if (active || moved || this.controls.autoRotate || this.needsRender) { this.renderer.render(this.scene, this.camera); this.needsRender = false; }
  }
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl'); }
  catch { return false; }
}
