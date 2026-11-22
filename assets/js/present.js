/* =============================================================================
   Sophie Barat — mode présentation
   Navigation : ← → espace, Page préc./suiv., clic à gauche / à droite, balayage.
   F : plein écran · Échap : retour au site · l'adresse suit l'écran (#3).
   Effets : ouverture cinéma, rendu « film » (grain, vignettage, bandes), parallaxe,
   transitions de caméra, avant / après du lycée (écran 7), hologramme 3D (écran 8),
   maquette 3D du lycée du futur (écran 9), chambre interactive (écran 13),
   particules (internat, tapis roulants). Une seule boucle requestAnimationFrame.
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var body = document.body;
  var slides = $$('.slide');
  var total = slides.length;
  var cur = -1;
  var reduced = function () { return html.classList.contains('reduce-motion'); };
  var finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };
  var live = $('#live'), count = $('#count'), bar = $('#bar'), who = $('#who');
  var prevBtn = $('#prev'), nextBtn = $('#next');
  var deck = $('#deck');
  var cfgOpen = false;

  /* ------------------------------------------------------------------ préparation des écrans */
  slides.forEach(function (s, i) {
    s.id = 'slide-' + (i + 1);
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', (i + 1) + ' of ' + total + ': ' + s.dataset.title);
    s._steps = maxStep(s);
    s._shown = 0;
    s._hasMedia = !!$('.media', s);
    if (s._hasMedia) s.classList.add('has-media');
  });
  function maxStep(s) {
    return $$('[data-step]', s).reduce(function (m, el) { return Math.max(m, +el.dataset.step); }, 0);
  }
  function setSteps(s, n) {
    s._shown = n;
    $$('[data-step]', s).forEach(function (el) { el.classList.toggle('is-shown', +el.dataset.step <= n); });
    if (s._onSteps) s._onSteps(n);
  }

  /* ------------------------------------------------------------------ images (avec secours) */
  // charge base-sm.webp ou base.webp selon la largeur ; si -sm manque, essaie base.webp
  function loadImg(base, alt) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.alt = alt || '';
      img.decoding = 'async';
      var triedFull = false;
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        if (!triedFull) { triedFull = true; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = base + '.webp'; }
        else reject(new Error('missing ' + base));
      };
      img.sizes = '100vw';
      img.srcset = base + '-sm.webp 960w, ' + base + '.webp 2560w';
      img.src = base + '.webp';
    });
  }
  function useFallback(media) {
    var fb = $('.fallback', media);
    fb.setAttribute('role', 'img');
    fb.setAttribute('aria-label', media.dataset.alt + ' (image coming soon)');
  }
  function prepareMedia(s) {
    var media = $('.media', s);
    if (!media || media._loading || !media.dataset.img) return;
    media._loading = true;
    if (media.hasAttribute('data-room')) probeRoom();
    loadImg(media.dataset.img, media.dataset.alt).then(function (img) {
      media.insertBefore(img, media.firstChild); media.classList.add('has-img');
    }).catch(function () { useFallback(media); });
  }

  /* ------------------------------------------------------------------ vidéos de fond en boucle */
  // seule la vidéo de l'écran actif joue ; la suivante se précharge ; « réduire les animations » = affiche fixe ;
  // si la vidéo ne se charge pas, elle disparaît et l'image (avec son effet Ken Burns) reste dessous
  function prepVideo(v, onFail) {
    v.autoplay = false; v.removeAttribute('autoplay'); v.muted = true;
    try { v.pause(); } catch (err) { /* ignoré */ }
    var sources = $$('source', v);
    if (sources.length) sources[sources.length - 1].addEventListener('error', onFail);
    v.addEventListener('error', onFail);
  }
  function playVideo(v) {
    if (!v.paused) return;
    v.preload = 'auto';
    var p = v.play(); if (p && p.catch) p.catch(function () { /* lecture refusée : l'affiche reste */ });
  }
  slides.forEach(function (s) {
    var v = $('video[data-video]', s);
    if (!v) return;
    s._video = v;
    var media = v.closest('.media');
    prepVideo(v, function () { media.classList.add('video-failed'); });
  });
  function syncVideos() {
    slides.forEach(function (s, i) {
      var v = s._video;
      if (!v || v.closest('.video-failed')) return;
      // chambre : la vidéo de base s'arrête quand une variante la recouvre
      var covered = s === roomSlide && room.layer && room.layerSettled;
      if (s === mapSlide && map.panel >= 0) covered = true; // plan : la vidéo de drone s'arrête sous le panneau vidéo
      if (i === cur && !reduced() && !cfgOpen && !covered) playVideo(v);
      else {
        if (!v.paused) v.pause();
        if (reduced() && v.currentTime > 0) v.currentTime = 0; // image fixe = l'affiche (1re image)
      }
    });
    roomVideos();
    var nx = slides[cur + 1];
    if (nx && nx._video && !reduced()) nx._video.preload = 'auto';
  }

  /* ------------------------------------------------------------------ rendu « film » : grain animé */
  var grain = $('.film-grain');
  (function makeGrain() {
    if (!grain) return;
    try {
      var c = document.createElement('canvas'), N = 160;
      c.width = c.height = N;
      var g = c.getContext('2d'), d = g.createImageData(N, N);
      for (var i = 0; i < d.data.length; i += 4) {
        var v = Math.random() * 255 | 0;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      grain.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
    } catch (err) { grain.remove(); grain = null; }
  })();
  function moveGrain() {
    if (!grain) return;
    grain.style.transform = 'translate3d(' + (-(Math.random() * 160) | 0) + 'px,' + (-(Math.random() * 160) | 0) + 'px,0)';
  }

  /* ------------------------------------------------------------------ un seul canvas de particules, déplacé d'écran en écran */
  var fx = { c: document.createElement('canvas'), ctx: null, mode: null, w: 0, h: 0, dpr: 1, parts: [], streaks: [], host: null };
  fx.c.className = 'fx-canvas';
  fx.c.setAttribute('aria-hidden', 'true');
  try { fx.ctx = fx.c.getContext('2d'); } catch (err) { fx.ctx = null; }
  var sprite = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(200,230,255,.6)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return c;
  })();
  function fxResize() {
    if (!fx.host) return;
    fx.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    fx.w = fx.host.clientWidth; fx.h = fx.host.clientHeight;
    fx.c.width = Math.round(fx.w * fx.dpr); fx.c.height = Math.round(fx.h * fx.dpr);
  }
  function fxAttach(s) {
    var mode = s.dataset.fx || null;
    if (!fx.ctx || !mode || reduced()) { fx.mode = null; return; }
    // ville : dans le décor (sous le voile) ; tapis roulants : au-dessus du voile, sous le texte
    var host = mode === 'walk' ? s : ($('.media', s) || s);
    if (fx.c.parentNode !== host) host.insertBefore(fx.c, mode === 'walk' ? $('.content', s) : null);
    fx.host = host;
    fxResize();
    if (fx.mode !== mode) fxInit(mode);
    fx.mode = mode;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fxInit(mode) {
    fx.parts = []; fx.streaks = [];
    var i;
    if (mode === 'city') {
      for (i = 0; i < 70; i++) fx.parts.push({ x: Math.random(), y: Math.random() * 0.8, s: rnd(.5, 1.6), vx: rnd(-.004, .004), vy: rnd(-.012, -.003), ph: Math.random() * 6.3 });
      for (i = 0; i < 3; i++) fx.streaks.push(newCityStreak(true));
    } else if (mode === 'walk') {
      for (i = 0; i < 36; i++) fx.streaks.push(newWalkStreak(true));
    }
  }
  function newCityStreak(initial) {
    var dir = Math.random() < .5 ? 1 : -1;
    return { x: initial ? Math.random() : (dir > 0 ? -0.25 : 1.25), y: rnd(.06, .34), len: rnd(.05, .14), v: rnd(.00004, .00011) * dir, slope: rnd(-.04, .04), wait: initial ? rnd(0, 4000) : rnd(1500, 6000), violet: Math.random() < .45 };
  }
  function newWalkStreak(initial) {
    // couloir en perspective : X latéral (sur le sol), Z profondeur (loin = grand)
    return { X: rnd(-1.45, 1.45), Z: initial ? rnd(1, 12) : rnd(10, 13), L: rnd(2.2, 4.5), v: rnd(.003, .006), violet: Math.random() < .4 };
  }
  function fxDraw(t, dt) {
    var g = fx.ctx, W = fx.w, H = fx.h;
    if (!g || !W) return;
    g.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    var i, p;
    if (fx.mode === 'city') {
      for (i = 0; i < fx.parts.length; i++) {
        p = fx.parts[i];
        p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
        if (p.y < -0.02) { p.y = 0.8; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02; else if (p.x > 1.02) p.x = -0.02;
        var tw = 0.35 + 0.35 * Math.sin(t / 900 + p.ph);
        var sz = p.s * 6;
        g.globalAlpha = tw * (p.y < 0.1 ? p.y * 10 : 1) * 0.7;
        g.drawImage(sprite, p.x * W - sz / 2, p.y * H - sz / 2, sz, sz);
      }
      for (i = 0; i < fx.streaks.length; i++) {
        p = fx.streaks[i];
        if (p.wait > 0) { p.wait -= dt; continue; }
        p.x += p.v * dt;
        if (p.x < -0.3 || p.x > 1.3) { fx.streaks[i] = newCityStreak(false); continue; }
        var x0 = p.x * W, y0 = p.y * H, x1 = (p.x - Math.sign(p.v) * p.len) * W, y1 = y0 - p.slope * p.len * W;
        var gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, p.violet ? 'rgba(190,150,255,.55)' : 'rgba(140,215,255,.6)');
        gr.addColorStop(1, 'rgba(80,120,255,0)');
        g.globalAlpha = 1; g.strokeStyle = gr; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
    } else if (fx.mode === 'walk') {
      var cx = W * 0.5, vy = H * 0.48, f = H - vy;
      g.lineCap = 'round';
      for (i = 0; i < fx.streaks.length; i++) {
        p = fx.streaks[i];
        p.Z -= p.v * dt;
        if (p.Z < 0.55) { fx.streaks[i] = newWalkStreak(false); continue; }
        var zh = p.Z, zt = p.Z + p.L;
        var hx = cx + p.X / zh * f, hy = vy + f / zh, tx = cx + p.X / zt * f, ty = vy + f / zt;
        var fade = Math.min(1, (13 - p.Z) / 4) * Math.min(1, (p.Z - 0.55) / 0.6);
        if (fade <= 0) continue;
        var gw = g.createLinearGradient(hx, hy, tx, ty);
        gw.addColorStop(0, p.violet ? 'rgba(180,140,255,.75)' : 'rgba(120,210,255,.8)');
        gw.addColorStop(1, 'rgba(60,110,255,0)');
        g.globalAlpha = fade * 0.85; g.strokeStyle = gw; g.lineWidth = Math.max(0.8, 3 / zh);
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  window.addEventListener('resize', fxResize);

  /* ------------------------------------------------------------------ parallaxe (souris) */
  var par = { x: 0, y: 0, tx: 0, ty: 0 };
  function parallaxOn() { return finePointer.matches && !reduced() && !cfgOpen; }
  function syncParallaxClass() { html.classList.toggle('px-on', parallaxOn()); }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    kick();
  }, { passive: true });
  if (finePointer.addEventListener) finePointer.addEventListener('change', function () { syncParallaxClass(); kick(); });

  /* ------------------------------------------------------------------ boucle unique */
  var raf = 0, last = 0, frameN = 0;
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min(64, t - last) : 16.7;
    last = t; frameN++;
    if (cfgOpen) { last = 0; return; }
    var more = false, red = reduced(), s = slides[cur];
    // parallaxe : lerp vers la souris
    if (parallaxOn() && s && s._hasMedia) {
      var k = 1 - Math.pow(1 - 0.075, dt / 16.7);
      par.x += (par.tx - par.x) * k; par.y += (par.ty - par.y) * k;
      s.style.setProperty('--px', par.x.toFixed(4));
      s.style.setProperty('--py', par.y.toFixed(4));
      if (Math.abs(par.tx - par.x) + Math.abs(par.ty - par.y) > 0.001) more = true;
    }
    // grain qui bouge (~20 images/s)
    if (!red && body.classList.contains('film-on')) { if (frameN % 3 === 0) moveGrain(); more = true; }
    // particules
    if (!red && fx.mode) { fxDraw(t, dt); more = true; }
    // hologramme (WebGL seulement sur l'écran 8)
    if (holo.inst && cur === holoIdx) { try { if (holo.inst.render(t)) more = true; } catch (err) { holoFail(); } }
    // maquette 3D (WebGL seulement sur l'écran 9)
    if (map.inst && cur === mapIdx) { try { if (map.inst.render(t)) more = true; } catch (err) { mapFlat(); } }
    // avant / après : balayage du curseur
    if (baTick(t)) more = true;
    if (more) raf = requestAnimationFrame(frame); else last = 0;
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = 0; kick(); } });

  /* ------------------------------------------------------------------ ouverture cinématographique (écran 1) */
  var titleSlide = $('.slide-title');
  var intro = { on: false, timer: 0, played: false };
  function startIntro() {
    intro.played = true;
    if (!titleSlide) return;
    if (reduced()) { titleSlide.classList.add('intro-done'); return; }
    intro.on = true;
    titleSlide.classList.add('intro');
    intro.timer = setTimeout(endIntro, 4300);
  }
  function endIntro() {
    if (!intro.on) return;
    intro.on = false; clearTimeout(intro.timer);
    titleSlide.classList.add('intro-done');
    titleSlide.classList.remove('intro');
  }

  /* ------------------------------------------------------------------ avant / après (écran 7) */
  // la vraie photo du lycée, puis le lycée du futur (même cadrage) révélé par un curseur vertical
  var baSlide = $('.slide-ba');
  var ba = { el: baSlide ? $('.ba', baSlide) : null, pos: 0, from: 0, to: 0, t0: -1, dur: 0, ok: false, drag: false, instant: false };
  var BA_IMG = 'assets/img/expo/lycee-futur';
  function baSet(p) {
    ba.pos = Math.max(0, Math.min(100, p));
    baSlide.style.setProperty('--ba', ba.pos.toFixed(2) + '%');
    baSlide.style.setProperty('--ba-n', (ba.pos / 100).toFixed(4));
    if (ba.pos < 99.5) baSlide.classList.remove('ba-full');
  }
  function baEnd() {
    ba.dur = 0;
    baSlide.classList.remove('ba-sweeping');
    if (ba.pos >= 99.5) baSlide.classList.add('ba-full');
  }
  // balayage automatique (2,6 s) ; animations réduites : le curseur se place directement
  function baAnimate(to, dur) {
    if (reduced() || !dur) { baSet(to); baEnd(); return; }
    ba.from = ba.pos; ba.to = to; ba.dur = dur; ba.t0 = -1;
    baSlide.classList.toggle('ba-sweeping', to > ba.pos);
    kick();
  }
  function baTick(t) {
    if (!ba.dur) return false;
    if (ba.t0 < 0) ba.t0 = t;
    var p = Math.min(1, (t - ba.t0) / ba.dur);
    var k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    baSet(ba.from + (ba.to - ba.from) * k);
    if (p >= 1) { baEnd(); return false; }
    return true;
  }
  function baFromX(x) {
    var r = ba.el.getBoundingClientRect();
    if (r.width) baSet((x - r.left) / r.width * 100);
  }
  // l'image du futur est-elle là ? (balise <img> + onerror : pas de fetch)
  function baLoad() {
    if (!baSlide) return;
    var img = new Image(), retried = false;
    img.className = 'ba-img'; img.alt = ''; img.decoding = 'async';
    img.onload = function () {
      $('.ba-after', baSlide).appendChild(img);
      ba.ok = true;
      baSlide.classList.add('ba-ready');
      baSet(baSlide._shown ? (reduced() ? 50 : 100) : 0); baEnd();
    };
    img.onerror = function () {
      // si la petite version manque, on essaie la grande ; sinon : la photo seule
      if (!retried && /-sm\.webp/.test(img.currentSrc || '')) { retried = true; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = BA_IMG + '.webp'; return; }
      baMissing();
    };
    img.sizes = '100vw';
    img.srcset = BA_IMG + '-sm.webp 944w, ' + BA_IMG + '.webp 1888w';
    img.src = BA_IMG + '.webp';
  }
  function baMissing() {
    baSlide.classList.add('ba-missing');
    $$('.ba-mark', baSlide).forEach(function (m) { m.remove(); });
    baSlide._steps = maxStep(baSlide);
    if (baSlide._shown) setSteps(baSlide, 0);
  }
  if (baSlide) {
    baSet(0);
    baSlide._onSteps = function (n) {
      if (!ba.ok) return;
      var instant = ba.instant; ba.instant = false;
      if (n >= 1) baAnimate(reduced() ? 50 : 100, instant ? 0 : 2600);
      else baAnimate(0, instant ? 0 : 700);
    };
    // glisser à la souris ou au doigt, n'importe où sur l'image
    ba.el.addEventListener('pointerdown', function (e) {
      if (!ba.ok || e.button > 0) return;
      ba.drag = true; ba.dur = 0;
      baSlide.classList.remove('ba-sweeping');
      baSlide.classList.add('ba-dragging');
      try { ba.el.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
      baFromX(e.clientX);
      e.preventDefault();
    });
    ba.el.addEventListener('pointermove', function (e) { if (ba.drag) baFromX(e.clientX); });
    var baUp = function () { if (!ba.drag) return; ba.drag = false; baSlide.classList.remove('ba-dragging'); baEnd(); };
    ba.el.addEventListener('pointerup', baUp);
    ba.el.addEventListener('pointercancel', baUp);
    // au clavier : le bouton (visible au focus) fait passer le curseur à 50 %, 100 %, puis 0 %
    var baBtn = $('.ba-toggle', baSlide);
    if (baBtn) baBtn.addEventListener('click', function () {
      var to = ba.pos < 49 ? 50 : ba.pos < 99 ? 100 : 0;
      baAnimate(to, 700);
      live.textContent = to === 0 ? 'Today' : to === 50 ? 'Today and tomorrow, side by side' : 'Tomorrow';
    });
    baLoad();
  }

  /* ------------------------------------------------------------------ hologramme 3D (écran 8) */
  var holoSlide = $('.slide-holo'), holoIdx = slides.indexOf(holoSlide);
  var holoStage = $('.holo-stage'), holoHost = $('.holo-canvas'), holoLabel = $('.holo-label'), holoNext = $('.holo-next');
  var HOLO_NAMES = ['Book', 'Timetable', 'Calculator', 'Globe'];
  var holo = { mod: null, inst: null, loading: null, failed: false, want: -1, stepIdx: -1 };
  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (err) { return false; }
  }
  function holoLoad() {
    if (holo.loading || holo.failed || !holoStage) return;
    if (!webglOK()) { holoFail(); return; }
    holo.loading = import(new URL('assets/js/present-holo.js', document.baseURI).href)
      .then(function (m) { holo.mod = m; if (cur === holoIdx) holoActivate(true); })
      .catch(function () { holoFail(); });
  }
  // le rendu WebGL n'est créé qu'une fois l'écran 8 affiché ; ailleurs il n'est plus dessiné
  function holoActivate(on) {
    if (holo.failed || !holoStage || !on) return;
    if (!holo.mod) { holoLoad(); return; }
    if (!holo.inst) {
      try {
        holo.inst = holo.mod.createHolo(holoHost, { reduced: reduced, onError: holoFail });
        if (holo.want >= 0) holo.inst.show(holo.want, true);
      } catch (err) { holoFail(); return; }
    }
    holo.inst.invalidate();
    kick();
  }
  function holoShow(i) {
    if (i === holo.want) return;
    holo.want = i;
    if (holoStage) holoStage.classList.toggle('is-on', i >= 0);
    if (i >= 0 && holoLabel) {
      holoLabel.textContent = HOLO_NAMES[i];
      holoLabel.classList.remove('pop'); void holoLabel.offsetWidth; holoLabel.classList.add('pop');
    }
    if (holo.inst) holo.inst.show(i);
    kick();
  }
  if (holoSlide) holoSlide._onSteps = function (n) {
    var idx = -1;
    $$('.holo-mark', holoSlide).forEach(function (m) { if (+m.dataset.step <= n) idx = +m.dataset.obj; });
    if (idx !== holo.stepIdx) { holo.stepIdx = idx; holoShow(idx); }
  };
  if (holoNext) holoNext.addEventListener('click', function () {
    var i = (holo.want + 1) % HOLO_NAMES.length;
    holoShow(i);
    live.textContent = 'Hologram: ' + HOLO_NAMES[i];
  });
  // en cas d'erreur WebGL : l'écran garde la vidéo seule, et les repères de l'hologramme disparaissent
  function holoFail() {
    if (holo.failed) return;
    holo.failed = true;
    if (holo.inst) { try { holo.inst.dispose(); } catch (err) { /* ignoré */ } holo.inst = null; }
    if (holoStage) holoStage.remove();
    if (!holoSlide) return;
    var shownBefore = holoSlide._shown;
    var keptBefore = $$('[data-step]:not(.holo-mark)', holoSlide).map(function (el) { return +el.dataset.step; });
    $$('.holo-mark', holoSlide).forEach(function (m) { m.remove(); });
    holoSlide._onSteps = null;
    var uniq = keptBefore.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    $$('[data-step]', holoSlide).forEach(function (el) { el.dataset.step = uniq.indexOf(+el.dataset.step) + 1; });
    holoSlide._steps = maxStep(holoSlide);
    setSteps(holoSlide, uniq.filter(function (v) { return v <= shownBefore; }).length);
  }

  /* ------------------------------------------------------------------ plan du campus (écran 9) */
  // vue aérienne photoréaliste (image + vidéo de drone) ; vue d'ensemble, puis un repère par zone
  // (dans l'ordre des écrans suivants) : la zone s'allume et la caméra s'en approche ; clic = plongée + vidéo de la zone.
  // Secours : maquette three.js (present-map.js) si l'image du campus manque, puis plan 2D sans WebGL.
  var mapSlide = $('.slide-map'), mapIdx = slides.indexOf(mapSlide);
  var mapStage = mapSlide ? $('.map-stage', mapSlide) : null, mapHost = mapSlide ? $('.map-canvas', mapSlide) : null;
  var mapTags = mapSlide ? $$('.map-tag', mapSlide) : [];
  var mapPanel = mapSlide ? $('.map-panel', mapSlide) : null, mapVideo = mapPanel ? $('.map-video', mapPanel) : null;
  var mapTitle = mapPanel ? $('.map-panel-title', mapPanel) : null, mapBack = mapPanel ? $('.map-back', mapPanel) : null;
  var MAP_VIDEOS = ['boarding', 'mall', 'food', 'room', 'walkway'];
  var map = { mod: null, inst: null, loading: null, flat: false, panel: -1, flying: -1, step: 0, hot: -1, focus: -1, arrive: false, opener: null };
  var campusMedia = mapSlide ? $('.media.campus', mapSlide) : null;
  var campus = { ok: campusMedia ? null : false, probing: false };
  function mapName(i) { return mapTags[i] ? mapTags[i].textContent.trim() : ''; }
  // image du campus : chargée dès l'écran précédent ; si elle manque, on passe à la maquette three.js
  function campusProbe() {
    if (campus.probing || campus.ok !== null) return;
    campus.probing = true;
    loadImg(campusMedia.dataset.campus, campusMedia.dataset.alt).then(function (img) {
      var frameEl = $('.campus-frame', campusMedia);
      frameEl.insertBefore(img, frameEl.firstChild);
      campusMedia.classList.add('has-img');
      campus.ok = true;
      if (cur === mapIdx) mapActivate();
    }).catch(function () {
      campus.ok = false;
      campusMedia.remove(); campusMedia = null;
      mapSlide._hasMedia = false; mapSlide._video = null; mapSlide.classList.remove('has-media');
      if (cur === mapIdx) body.classList.remove('film-on');
      mapLoad();
    });
  }
  function mapLoad() {
    if (map.loading || map.flat || !mapStage) return;
    if (campus.ok !== false) { campusProbe(); return; }
    if (!webglOK()) { mapFlat(); return; }
    map.loading = import(new URL('assets/js/present-map.js', document.baseURI).href)
      .then(function (m) { map.mod = m; if (cur === mapIdx) mapActivate(); })
      .catch(function () { mapFlat(); });
  }
  // le rendu n'est créé qu'une fois l'écran 9 affiché ; ailleurs il n'est plus dessiné
  function mapActivate() {
    if (map.flat || !mapStage) return;
    if (campus.ok === null) { campusProbe(); return; }
    if (!map.inst && campus.ok) {
      map.inst = createCampus();
      mapSlide.classList.add('map-campus');
      map.arrive = true; mapApplyStep();
    }
    if (!map.inst && !map.mod) { mapLoad(); return; }
    if (!map.inst) {
      try {
        map.inst = map.mod.createMap(mapHost, { reduced: reduced, onError: mapFlat, onArrive: mapOpenPanel, onPick: mapPick, onHover: mapHover, tags: mapTags });
        mapSlide.classList.add('map-3d');
        map.arrive = true; mapApplyStep();
      } catch (err) { mapFlat(); return; }
    }
    map.inst.invalidate();
    kick();
  }

  // ---- caméra du plan photo : même interface que la maquette three.js (overview, focus, fly, hover, render…)
  // Positions en fractions de l'image 16:9 (planche de vérification : build/ai/expo/campus/planche.png).
  // x, y : pied du marqueur sur le bâtiment ; cx, cy, rx, ry : centre et demi-axes du halo autour du bâtiment.
  var CAMPUS_ZONES = [
    { x: 0.22, y: 0.292, cx: 0.222, cy: 0.255, rx: 0.185, ry: 0.105 }, // Boarding : l'aile internat (balcons), en haut à gauche
    { x: 0.85, y: 0.66, cx: 0.85, cy: 0.735, rx: 0.15, ry: 0.17 },      // Shopping : la galerie vitrée ronde, en bas à droite
    { x: 0.255, y: 0.75, cx: 0.17, cy: 0.765, rx: 0.19, ry: 0.17 },     // Restaurants : la terrasse aux parasols, en bas à gauche
    { x: 0.765, y: 0.225, cx: 0.765, cy: 0.24, rx: 0.135, ry: 0.1 },    // Rooms : le bloc de chambres cubes, en haut à droite
    { x: 0.21, y: 0.485, cx: 0.2, cy: 0.505, rx: 0.21, ry: 0.075 }      // Walkways : la passerelle vitrée, à gauche
  ];
  // mouvement de la vidéo de drone (boucle aller-retour, légère poussée vers l'avant) : 25 instants régulièrement espacés
  // sur sa durée, chacun [s, x0, y0, … x4, y4] = zoom de l'image et position du pied de chaque marqueur (fractions).
  // Mesuré sur la vidéo par build/ai/expo/campus/track.py — les marqueurs et les halos suivent les bâtiments.
  var CAMPUS_TRACK = [
    [1.0037,0.219,0.2911,0.851,0.6611,0.2536,0.7514,0.7652,0.2239,0.2086,0.4851],
    [1.0063,0.2185,0.2909,0.8519,0.6621,0.2529,0.7528,0.7655,0.2236,0.2078,0.4854],
    [1.0108,0.2177,0.2905,0.8535,0.6641,0.2515,0.7552,0.7661,0.2229,0.2065,0.4862],
    [1.0154,0.2168,0.2903,0.8551,0.6662,0.2502,0.7578,0.7666,0.2225,0.2051,0.4871],
    [1.0217,0.2157,0.29,0.8574,0.6692,0.2484,0.7613,0.7675,0.2218,0.2033,0.4883],
    [1.0286,0.2144,0.2895,0.8599,0.6723,0.2464,0.7652,0.7684,0.221,0.2013,0.4895],
    [1.0364,0.2132,0.2895,0.8629,0.6763,0.2443,0.77,0.7695,0.2206,0.1992,0.4914],
    [1.0356,0.213,0.288,0.8622,0.6744,0.2442,0.7679,0.769,0.2191,0.199,0.4897],
    [1.04,0.2118,0.288,0.8635,0.6767,0.2426,0.7707,0.7693,0.2189,0.1974,0.4908],
    [1.0467,0.2109,0.2876,0.8661,0.6797,0.2409,0.7744,0.7704,0.2181,0.1957,0.492],
    [1.0466,0.2106,0.288,0.8658,0.6801,0.2407,0.7747,0.7702,0.2185,0.1955,0.4924],
    [1.0498,0.2108,0.2882,0.8677,0.6819,0.2405,0.7769,0.7713,0.2186,0.1953,0.4934],
    [1.0508,0.21,0.2879,0.8675,0.6822,0.2397,0.7772,0.7709,0.2183,0.1944,0.4934],
    [1.0544,0.2096,0.2874,0.869,0.6836,0.2389,0.779,0.7716,0.2176,0.1936,0.4937],
    [1.0461,0.2107,0.2878,0.8656,0.6796,0.2408,0.7742,0.7701,0.2183,0.1956,0.492],
    [1.0468,0.2108,0.2872,0.8661,0.6793,0.2409,0.774,0.7704,0.2177,0.1957,0.4916],
    [1.0401,0.2118,0.288,0.8635,0.6767,0.2426,0.7707,0.7693,0.2189,0.1974,0.4908],
    [1.0356,0.2129,0.288,0.8622,0.6744,0.2442,0.7679,0.7691,0.2191,0.199,0.4897],
    [1.0365,0.2132,0.2895,0.8629,0.6764,0.2443,0.77,0.7696,0.2206,0.1991,0.4915],
    [1.0286,0.2144,0.2895,0.8599,0.6723,0.2464,0.7652,0.7684,0.221,0.2013,0.4895],
    [1.0217,0.2157,0.29,0.8574,0.6692,0.2484,0.7613,0.7675,0.2218,0.2033,0.4883],
    [1.0154,0.2168,0.2903,0.8551,0.6662,0.2502,0.7578,0.7666,0.2225,0.2051,0.4871],
    [1.0106,0.2177,0.2906,0.8534,0.664,0.2516,0.7551,0.766,0.223,0.2065,0.4862],
    [1.0062,0.2186,0.2909,0.8519,0.6621,0.2529,0.7527,0.7655,0.2236,0.2079,0.4854],
    [1.0037,0.219,0.2911,0.851,0.6611,0.2536,0.7514,0.7652,0.2239,0.2086,0.4851]
  ];
  var CAMPUS_ASPECT = 16 / 9;
  function createCampus() {
    var media = campusMedia, cam = $('.campus-cam', media), frameEl = $('.campus-frame', media);
    var spot = $('.campus-spot', media), ring = $('.campus-ring', media), video = $('.campus-video', media);
    var title = $('.map-head .slide-h', mapSlide), titleRange = document.createRange();
    var st = { w: 0, h: 0, fw: 0, fh: 0, fl: 0, ft: 0, v: { z: 1, x: 0, y: 0, b: 0 }, from: null, to: null, t0: 0, dur: 0,
      arrive: -1, hover: -1, focus: -1, fly: -1, dirty: true };
    function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    // instant de la vidéo de drone (ligne de CAMPUS_TRACK interpolée), ou null si l'image fixe est affichée
    function drift() {
      if (!CAMPUS_TRACK || !video || media.classList.contains('video-failed') || !video.duration || reduced()) return null;
      var n = CAMPUS_TRACK.length - 1, u = Math.max(0, Math.min(1, video.currentTime / video.duration)) * n;
      var k = Math.min(n - 1, Math.floor(u)), a = u - k, p = CAMPUS_TRACK[k], q = CAMPUS_TRACK[k + 1];
      return p.map(function (v, j) { return v + (q[j] - v) * a; });
    }
    // pied du marqueur de la zone i, et un point (x, y) du bâtiment de cette zone (halo), dans l'image affichée
    function foot(i, d) { var z = CAMPUS_ZONES[i]; return d ? [d[1 + 2 * i], d[2 + 2 * i]] : [z.x, z.y]; }
    function at(i, x, y, d) {
      var z = CAMPUS_ZONES[i], f = foot(i, d), s = d ? d[0] : 1;
      return [f[0] + (x - z.x) * s, f[1] + (y - z.y) * s];
    }
    // cadre « cover » : l'image 16:9 remplit l'écran, centrée (comme object-fit: cover)
    function layout() {
      var w = media.clientWidth, h = media.clientHeight;
      if (w === st.w && h === st.h) return false;
      st.w = w; st.h = h;
      if (w / h > CAMPUS_ASPECT) { st.fw = w; st.fh = w / CAMPUS_ASPECT; } else { st.fh = h; st.fw = h * CAMPUS_ASPECT; }
      st.fl = (w - st.fw) / 2; st.ft = (h - st.fh) / 2;
      frameEl.style.cssText = 'left:' + st.fl + 'px;top:' + st.ft + 'px;width:' + st.fw + 'px;height:' + st.fh + 'px';
      return true;
    }
    // vue qui rapproche la zone i (zoom z) et l'amène en partie (k) vers le centre, sans jamais montrer de bord vide
    function viewFor(i, z, k) {
      var c = CAMPUS_ZONES[i], p = at(i, c.cx, c.cy, drift()), px = st.fl + p[0] * st.fw, py = st.ft + p[1] * st.fh;
      var qx = px + (st.w / 2 - px) * k, qy = py + (st.h * 0.56 - py) * k;
      return { z: z, x: Math.min(0, Math.max(st.w - z * st.w, qx - z * px)), y: Math.min(0, Math.max(st.h - z * st.h, qy - z * py)), b: 0 };
    }
    function targetView() {
      if (reduced() || !st.w) return { z: 1, x: 0, y: 0, b: 0 };
      if (st.fly >= 0) return viewFor(st.fly, 2, 0.8);
      if (st.focus >= 0) return viewFor(st.focus, 1.25, 0.45);
      return { z: 1, x: 0, y: 0, b: 0 };
    }
    function retarget(dur) {
      st.from = { z: st.v.z, x: st.v.x, y: st.v.y, b: st.v.b }; st.to = null;
      st.t0 = 0; st.dur = reduced() ? 0 : dur; st.moving = true; st.dirty = true;
      kick();
    }
    function sync() {
      var lit = st.fly >= 0 ? st.fly : st.focus;
      mapSlide.classList.toggle('is-diving', st.fly >= 0);
      mapSlide.classList.toggle('has-focus', lit >= 0);
      spot.classList.toggle('is-on', lit >= 0);
      ring.classList.toggle('is-on', (lit >= 0 ? lit : st.hover) >= 0);
      st.dirty = true;
      kick();
    }
    function apply() {
      cam.style.transform = 'translate(' + st.v.x.toFixed(2) + 'px,' + st.v.y.toFixed(2) + 'px) scale(' + st.v.z.toFixed(4) + ')';
      cam.style.filter = st.v.b > 0.05 ? 'blur(' + st.v.b.toFixed(2) + 'px)' : '';
    }
    function place(d) {
      // halo et assombrissement autour de la zone : en fractions du cadre (ils zooment avec l'image)
      var lit = st.fly >= 0 ? st.fly : st.focus, zi = lit >= 0 ? lit : st.hover;
      if (zi >= 0) {
        var z = CAMPUS_ZONES[zi], c = at(zi, z.cx, z.cy, d), sc0 = d ? d[0] : 1;
        ring.style.left = (c[0] * 100) + '%'; ring.style.top = (c[1] * 100) + '%';
        ring.style.width = (z.rx * 200 * sc0) + '%'; ring.style.height = (z.ry * 200 * sc0) + '%';
      }
      if (lit >= 0) {
        var s = CAMPUS_ZONES[lit], cs = at(lit, s.cx, s.cy, d);
        spot.style.background = 'radial-gradient(ellipse ' + (s.rx * 150) + '% ' + (s.ry * 150) + '% at ' + (cs[0] * 100).toFixed(2) + '% ' + (cs[1] * 100).toFixed(2) + '%, rgba(3, 10, 32, 0) 55%, rgba(3, 10, 32, .5) 100%)';
      }
      // marqueurs : projetés à l'écran à partir du cadre réellement affiché (zoom, parallaxe, transition comprises)
      var sr = mapSlide.getBoundingClientRect(), fr = frameEl.getBoundingClientRect();
      var k = sr.width / (mapSlide.offsetWidth || 1) || 1;
      // le titre ne cache aucun marqueur : une étiquette qui le toucherait passe sous son point
      titleRange.selectNodeContents(title);
      var tr = titleRange.getBoundingClientRect(), stem = Math.max(26, Math.min(46, window.innerHeight * 0.036)) + 6;
      var tl = (tr.left - sr.left) / k - 12, tt = (tr.top - sr.top) / k - 12, trr = (tr.right - sr.left) / k + 12, tb = (tr.bottom - sr.top) / k + 12;
      mapTags.forEach(function (t, i) {
        var p = foot(i, d);
        var x = (fr.left - sr.left + p[0] * fr.width) / k, y = (fr.top - sr.top + p[1] * fr.height) / k;
        var sc = t.classList.contains('is-focus') ? 1.22 : 1, hw = t.offsetWidth / 2 * sc, top = y - (stem + t.offsetHeight) * sc;
        t.classList.toggle('is-below', x + hw > tl && x - hw < trr && top < tb && y > tt);
        t.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
        t.style.zIndex = (i === st.focus || i === st.fly) ? 3 : i === st.hover ? 2 : '';
      });
    }
    function onResize() { st.w = 0; st.dirty = true; kick(); }
    window.addEventListener('resize', onResize);
    return {
      overview: function (instant) { st.focus = -1; st.fly = -1; st.arrive = -1; sync(); retarget(instant ? 0 : 1100); },
      focus: function (i) { st.focus = i; st.fly = -1; st.arrive = -1; sync(); retarget(1300); },
      // plongée (~1,1 s, léger flou de mouvement), puis la vidéo de la zone s'ouvre
      fly: function (i) {
        st.fly = i; sync();
        if (reduced()) { mapOpenPanel(i); return; }
        st.arrive = i; retarget(1100);
      },
      hover: function (i) { st.hover = i; sync(); },
      invalidate: function () { st.w = 0; st.dirty = true; },
      render: function (t) {
        var resized = layout(), d = drift(), anim = false;
        if (st.moving) {
          if (!st.t0) st.t0 = t;
          var u = st.dur ? Math.min(1, (t - st.t0) / st.dur) : 1, e = ease(u), f = st.from, g = targetView();
          st.v = { z: f.z + (g.z - f.z) * e, x: f.x + (g.x - f.x) * e, y: f.y + (g.y - f.y) * e, b: st.fly >= 0 && u < 1 ? Math.sin(Math.PI * u) * 2.2 : 0 };
          if (u < 1) anim = true;
          else {
            st.moving = false;
            if (st.arrive >= 0) { var a = st.arrive; st.arrive = -1; mapOpenPanel(a); }
          }
          apply();
        } else if (resized || (d && (st.focus >= 0 || st.fly >= 0))) {
          // taille changée, ou zone rapprochée pendant la vidéo : la vue reste calée sur le bâtiment
          st.v = targetView(); apply();
        }
        place(d);
        st.dirty = false;
        return anim || !!(video && !video.paused && !media.classList.contains('video-failed'));
      },
      dispose: function () {
        window.removeEventListener('resize', onResize);
        cam.style.transform = ''; cam.style.filter = '';
        mapTags.forEach(function (t) { t.style.translate = ''; t.style.zIndex = ''; t.classList.remove('is-below'); });
        mapSlide.classList.remove('map-campus', 'is-diving', 'has-focus');
      }
    };
  }
  // secours sans WebGL : plan 2D, les 5 zones en boutons
  function mapFlat() {
    if (map.flat || !mapSlide) return;
    map.flat = true;
    if (map.inst) { try { map.inst.dispose(); } catch (err) { /* ignoré */ } map.inst = null; }
    mapSlide.classList.remove('map-3d'); mapSlide.classList.add('map-flat');
    mapTags.forEach(function (t) { t.style.transform = ''; t.style.translate = ''; t.style.zIndex = ''; });
    if (map.flying >= 0) mapOpenPanel(map.flying);
    mapSyncTags();
  }
  function mapSyncTags() {
    mapTags.forEach(function (t, i) {
      t.classList.toggle('is-hot', i === map.hot || i === map.focus || i === map.flying || i === map.panel);
      t.classList.toggle('is-focus', i === map.focus);
    });
  }
  function mapHover(i) { map.hot = i; if (map.inst) map.inst.hover(i); mapSyncTags(); }
  function mapApplyStep() {
    var instant = map.arrive; map.arrive = false;
    var mark = map.step > 0 ? $('.map-mark[data-step="' + map.step + '"]', mapSlide) : null;
    map.focus = mark ? +mark.dataset.zone : -1;
    mapSyncTags();
    if (!map.inst) return;
    if (map.focus < 0) { map.inst.overview(instant); return; }
    // flèches : même plongée qu'un clic sur la zone, puis sa vidéo s'ouvre (en revenant sur l'écran, simple rapprochement)
    if (instant) { map.inst.focus(map.focus); return; }
    map.opener = mapTags[map.focus];
    live.textContent = mapName(map.focus);
    map.flying = map.focus;
    map.inst.fly(map.focus);
    mapSyncTags();
    kick();
  }
  // clic sur une zone : la caméra s'envole (~1,2 s), puis la vidéo s'ouvre
  function mapPick(i) {
    if (map.panel >= 0 || map.flying === i) return;
    map.opener = mapTags[i];
    live.textContent = mapName(i);
    if (!map.inst) { mapOpenPanel(i); return; }
    map.flying = i;
    map.inst.fly(i);
    mapSyncTags();
    kick();
  }
  function mapOpenPanel(i) {
    if (cur !== mapIdx) return;
    if (map.inst && map.flying !== i) return;
    map.flying = -1; map.panel = i;
    var base = 'assets/video/expo/' + MAP_VIDEOS[i];
    if (mapVideo.dataset.zone !== String(i)) {
      mapVideo.dataset.zone = String(i);
      mapVideo.poster = base + '-poster.webp';
      mapVideo.innerHTML = '<source src="' + base + '.mp4" type="video/mp4"><source src="' + base + '.webm" type="video/webm">';
      mapVideo.preload = 'auto';
      mapVideo.load();
    }
    mapTitle.textContent = mapName(i);
    mapPanel.classList.add('is-open');
    mapPanel.setAttribute('aria-hidden', 'false');
    mapPanel.removeAttribute('inert');
    mapSyncVideo();
    live.textContent = mapName(i) + ': video';
    mapSyncTags();
    try { mapBack.focus({ preventScroll: true }); } catch (err) { mapBack.focus(); }
  }
  function mapSyncVideo() {
    if (!mapVideo) return;
    var play = map.panel >= 0 && cur === mapIdx && !reduced() && !cfgOpen;
    mapVideo.controls = map.panel >= 0 && reduced();
    if (play) { var p = mapVideo.play(); if (p && p.catch) p.catch(function () { /* l'affiche reste */ }); }
    else if (!mapVideo.paused) mapVideo.pause();
    syncVideos();
  }
  // « Back to the map » / Échap : ferme la vidéo et ramène la caméra en vue d'ensemble
  function mapClosePanel(instant) {
    if (!mapPanel || (map.panel < 0 && map.flying < 0)) return false;
    var hadFocus = mapPanel.contains(document.activeElement);
    map.panel = -1; map.flying = -1;
    mapPanel.classList.remove('is-open');
    mapPanel.setAttribute('aria-hidden', 'true');
    mapPanel.setAttribute('inert', '');
    mapSyncVideo();
    if (map.inst) { if (map.focus >= 0) map.inst.focus(map.focus); else map.inst.overview(instant); }
    mapSyncTags();
    if (!instant) live.textContent = 'Back to the map';
    if (hadFocus && map.opener && !instant) map.opener.focus({ preventScroll: true });
    kick();
    return true;
  }
  if (mapSlide) {
    mapPanel.setAttribute('inert', '');
    mapSlide._onSteps = function (n) { map.step = n; if (map.panel >= 0 || map.flying >= 0) mapClosePanel(true); mapApplyStep(); };
    mapTags.forEach(function (t, i) {
      t.addEventListener('click', function () { mapPick(i); });
      t.addEventListener('mouseenter', function () { mapHover(i); });
      t.addEventListener('mouseleave', function () { if (map.hot === i) mapHover(-1); });
      t.addEventListener('focus', function () { mapHover(i); });
      t.addEventListener('blur', function () { if (map.hot === i) mapHover(-1); });
    });
    mapBack.addEventListener('click', function () { mapClosePanel(false); });
    // clic sur le fond sombre autour de la vidéo : retour à la carte
    mapPanel.addEventListener('click', function (e) { if (e.target === mapPanel) mapClosePanel(false); });
  }

  /* ------------------------------------------------------------------ chambre interactive (écran 13) */
  var roomSlide = $('.slide-room'), roomIdx = slides.indexOf(roomSlide);
  var roomMedia = roomSlide ? $('.media', roomSlide) : null;
  var roomSweep = roomSlide ? $('.room-sweep', roomSlide) : null;
  var MODES = ['rest', 'gym', 'music', 'study'];
  var modes = $$('.slide-room .mode');
  var room = { mode: -1, layers: {}, layer: null, layerSettled: false, probe: null, settleT: 0 };
  // existence des variantes : requête HEAD, résultat gardé en mémoire
  var existsCache = {};
  function exists(url) {
    if (!existsCache[url]) {
      existsCache[url] = (window.fetch ? fetch(url, { method: 'HEAD', cache: 'no-cache' }) : Promise.reject(new Error('no fetch')))
        .then(function (r) { return r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); }, function () { return false; });
    }
    return existsCache[url];
  }
  // une famille de fichiers n'est sondée en entier que si la première variante (« rest ») existe :
  // au pire une seule requête 404 par famille, aucune une fois les médias en place
  function existsAll(urls) {
    return exists(urls[0]).then(function (ok) {
      return ok ? Promise.all(urls.map(exists)) : urls.map(function () { return false; });
    });
  }
  function probeRoom() {
    if (room.probe || !roomMedia) return;
    var imgs = MODES.map(function (m) { return 'assets/img/expo/room-' + m + '.webp'; });
    var vids = MODES.map(function (m) { return 'assets/video/expo/room-' + m + '.mp4'; });
    room.probe = Promise.all([existsAll(imgs), existsAll(vids)]).then(function (found) {
      return Promise.all(MODES.map(function (m, k) { return addVariant(m, found[0][k], found[1][k]); }));
    }).then(function () { setMode(room.mode, true); });
  }
  function addVariant(m, hasImg, hasMp4) {
    var img = 'assets/img/expo/room-' + m, vid = 'assets/video/expo/room-' + m;
    // vidéo : la source .webm n'est demandée par le navigateur que si le .mp4 ne passe pas
    if (hasMp4) { makeVideoLayer(m, vid, true, hasImg ? img + '.webp' : null); return Promise.resolve(); }
    if (hasImg) return loadImg(img, roomAlt(m)).then(function (el) { addLayer(m, el); }, function () { /* image illisible : secours */ });
    return Promise.resolve();
  }
  function roomAlt(m) {
    return { rest: 'The room set up as a calm rest room.', gym: 'The same room turned into a gym.', music: 'The same room turned into a music studio.', study: 'The same room turned into a study room.' }[m];
  }
  function addLayer(m, el) {
    el.classList.add('room-layer');
    el.setAttribute('data-mode', m);
    var after = $('.bg-video', roomMedia);
    roomMedia.insertBefore(el, after ? after.nextSibling : null);
    room.layers[m] = el;
  }
  function makeVideoLayer(m, base, webm, poster) {
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    if (poster) v.poster = poster;
    var s1 = document.createElement('source'); s1.src = base + '.mp4'; s1.type = 'video/mp4'; v.appendChild(s1);
    if (webm) { var s2 = document.createElement('source'); s2.src = base + '.webm'; s2.type = 'video/webm'; v.appendChild(s2); }
    prepVideo(v, function () { v.remove(); if (room.layers[m] === v) delete room.layers[m]; setMode(room.mode, true); });
    addLayer(m, v);
  }
  function setMode(i, quiet) {
    if (!roomSlide) return;
    var changed = i !== room.mode;
    room.mode = i;
    modes.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
    // une variante manquante = la vidéo de la chambre
    var layer = i >= 0 ? room.layers[MODES[i]] || null : null;
    Object.keys(room.layers).forEach(function (m) { room.layers[m].classList.toggle('is-on', room.layers[m] === layer); });
    if (layer !== room.layer) {
      if (!quiet && changed && !reduced() && cur === roomIdx) sweep();
      room.layer = layer; room.layerSettled = false;
      clearTimeout(room.settleT);
      room.settleT = setTimeout(function () { room.layerSettled = true; syncVideos(); }, reduced() ? 0 : 1100);
    }
    syncVideos();
  }
  function sweep() {
    if (!roomSweep) return;
    roomSweep.classList.remove('is-sweeping'); void roomSweep.offsetWidth; roomSweep.classList.add('is-sweeping');
  }
  function roomVideos() {
    Object.keys(room.layers).forEach(function (m) {
      var v = room.layers[m];
      if (v.tagName !== 'VIDEO') return;
      if (v === room.layer && cur === roomIdx && !reduced() && !cfgOpen) playVideo(v);
      else if (!v.paused) v.pause();
    });
  }
  if (roomSlide) roomSlide._onSteps = function (n) { setMode(n >= 1 ? Math.min(n - 1, MODES.length - 1) : -1); };
  modes.forEach(function (b, i) {
    b.addEventListener('click', function () {
      setSteps(roomSlide, i + 1);
      prevBtn.disabled = false;
      live.textContent = b.textContent + ' mode';
    });
  });

  /* ------------------------------------------------------------------ uniformes : une pièce s'agrandit avec un reflet */
  var unis = $$('.slide-uniforms .uni');
  function clearUnis() { unis.forEach(function (x) { x.classList.remove('is-zoom'); x.setAttribute('aria-pressed', 'false'); }); }
  function toggleUni(u) {
    var on = !u.classList.contains('is-zoom');
    clearUnis();
    u.classList.toggle('is-zoom', on);
    u.setAttribute('aria-pressed', String(on));
  }
  unis.forEach(function (u) {
    u.tabIndex = 0;
    u.setAttribute('role', 'button');
    u.setAttribute('aria-pressed', 'false');
    var name = $('.uni-name', u);
    u.setAttribute('aria-label', 'Zoom on the ' + (name ? name.textContent.toLowerCase() : 'piece'));
    u.addEventListener('click', function () { toggleUni(u); });
    u.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleUni(u); }
    });
  });

  /* ------------------------------------------------------------------ navigation */
  var TRANS_MS = 720;
  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(total - 1, n));
    var back = n < cur;
    if (n === cur && !opts.force) return;
    var old = slides[cur];
    var animate = !!old && old !== slides[n] && !reduced();
    // transition de caméra : l'écran sortant avance (zoom + flou + fondu), l'entrant arrive depuis un léger recul
    slides.forEach(function (x) { clearTimeout(x._transT); x.classList.remove('is-leaving', 'is-entering'); });
    deck.classList.toggle('go-back', back);
    slides.forEach(function (s, i) {
      var on = i === n;
      s.classList.toggle('is-active', on || (animate && s === old));
      s.setAttribute('aria-hidden', String(!on));
      if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
    var s = slides[n];
    if (animate) {
      old.classList.add('is-leaving');
      s.classList.add('is-entering');
      old._transT = setTimeout(function () { old.classList.remove('is-leaving', 'is-active'); }, TRANS_MS);
      s._transT = setTimeout(function () { s.classList.remove('is-entering'); }, TRANS_MS);
    }
    if (old !== s) clearUnis();
    if (old === mapSlide && old !== s) { mapClosePanel(true); mapHover(-1); }
    if (s === baSlide && old !== s) ba.instant = true;
    if (s === mapSlide && old !== s) map.arrive = true;
    cur = n;
    // en revenant en arrière, l'écran s'affiche avec tous ses repères
    setSteps(s, back && opts.allSteps !== false ? s._steps : 0);
    [n, n + 1, n - 1].forEach(function (k) { if (slides[k]) prepareMedia(slides[k]); });
    count.textContent = (n + 1) + ' / ' + total;
    bar.style.width = ((n + 1) / total * 100) + '%';
    prevBtn.disabled = n === 0 && s._shown === 0;
    nextBtn.disabled = n === total - 1;
    var part = s.dataset.part, speaker = s.dataset.speaker;
    who.innerHTML = (part ? '<span>' + part + '</span>' : '') + (speaker ? '<span class="who-name">' + speaker + '</span>' : '');
    live.textContent = 'Slide ' + (n + 1) + ' of ' + total + ': ' + s.dataset.title;
    var h = '#' + (n + 1);
    if (location.hash !== h) history.replaceState(null, '', h);
    // ouverture : seulement au premier affichage de l'écran 1
    if (n === 0 && !intro.played) startIntro();
    else { intro.played = true; endIntro(); if (titleSlide) titleSlide.classList.add('intro-done'); }
    // rendu film, particules, parallaxe
    body.classList.toggle('film-on', s._hasMedia);
    fxAttach(s);
    s.style.setProperty('--px', par.x.toFixed(4)); s.style.setProperty('--py', par.y.toFixed(4));
    // configurateur préparé dès l'écran « In 3D » ; module de l'hologramme chargé à l'avance
    if (s.classList.contains('slide-3d')) { prepareConfig(); holoLoad(); }
    holoActivate(n === holoIdx);
    // maquette : module chargé dès l'écran précédent, rendu créé à l'arrivée
    if (n === mapIdx - 1 || n === mapIdx) mapLoad();
    if (n === mapIdx) mapActivate();
    if (s === baSlide) ba.instant = false;
    if (n === roomIdx || n === roomIdx - 1) probeRoom();
    syncVideos();
    kick();
  }
  function next() {
    if (intro.on) { endIntro(); return; }
    // écran du campus : chaque flèche plonge directement dans la zone suivante (la vidéo ouverte se ferme d'elle-même)
    var s = slides[cur];
    if (s._shown < s._steps) { setSteps(s, s._shown + 1); announceStep(s); prevBtn.disabled = false; return; }
    go(cur + 1);
  }
  function prev() {
    if (intro.on) { endIntro(); return; }
    var s = slides[cur];
    if (cur === mapIdx && s._shown === 0 && mapClosePanel(false)) return;
    if (s._shown > 0) { setSteps(s, s._shown - 1); prevBtn.disabled = cur === 0 && s._shown === 0; return; }
    go(cur - 1);
  }
  function announceStep(s) {
    var el = $$('[data-step="' + s._shown + '"]', s).filter(function (e) { return e.textContent.trim(); })[0];
    if (el) live.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  }
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  function fromHash() {
    var n = parseInt(location.hash.slice(1), 10);
    return isNaN(n) ? 0 : n - 1;
  }
  window.addEventListener('hashchange', function () { var n = fromHash(); if (n !== cur) go(n, { allSteps: false }); });

  /* clavier */
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (cfgOpen) { if (e.key === 'Escape') { e.preventDefault(); closeConfig(); } return; }
    var t = e.target;
    var onControl = t.closest && t.closest('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': next(); e.preventDefault(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': prev(); e.preventDefault(); break;
      case ' ': case 'Spacebar':
        if (onControl) return; // espace active le bouton qui a le focus
        if (e.shiftKey) prev(); else next(); e.preventDefault(); break;
      case 'Home': go(0); e.preventDefault(); break;
      case 'End': go(total - 1); e.preventDefault(); break;
      case 'f': case 'F': toggleFullscreen(); e.preventDefault(); break;
      case 'Escape':
        if (cur === mapIdx && mapClosePanel(false)) { e.preventDefault(); break; }
        location.href = 'index.html'; break;
    }
  });

  /* clic / appui : à gauche = précédent, à droite = suivant ; balayage sur tactile */
  var NO_NAV = 'button, a, input, select, textarea, label, .holo-stage, .uni, .ba, .map-stage, .map-panel';
  var touch = null, swiped = false;
  deck.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target.closest(NO_NAV)) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (e.clientX < window.innerWidth * 0.35) prev(); else next();
  });
  deck.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest('.holo-stage, .slide-ba.ba-ready .ba, .map-stage, .map-panel'))) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  deck.addEventListener('touchend', function (e) {
    if (!touch) return;
    var dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped = true; setTimeout(function () { swiped = false; }, 400);
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });

  /* ------------------------------------------------------------------ plein écran */
  var fsBtn = $('#fs');
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    try {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { var r = (html.requestFullscreen || html.webkitRequestFullscreen).call(html); if (r && r.catch) r.catch(function () {}); }
    } catch (err) { /* plein écran indisponible */ }
  }
  function syncFs() {
    var on = isFs();
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.setAttribute('aria-label', on ? 'Exit full screen (F)' : 'Full screen (F)');
    fsBtn.title = fsBtn.getAttribute('aria-label');
    $('use', fsBtn).setAttribute('href', on ? '#i-shrink' : '#i-expand');
    setTimeout(fxResize, 100);
  }
  fsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  if (!(html.requestFullscreen || html.webkitRequestFullscreen)) fsBtn.hidden = true;

  /* ------------------------------------------------------------------ réduire les animations */
  var motionBtn = $('#motion');
  function syncMotion() {
    var r = reduced();
    motionBtn.setAttribute('aria-pressed', String(r));
    var label = r ? 'Turn animations back on' : 'Reduce animations';
    motionBtn.setAttribute('aria-label', label); motionBtn.title = label;
    syncParallaxClass();
  }
  motionBtn.addEventListener('click', function () {
    var r = !reduced();
    html.classList.toggle('reduce-motion', r);
    try { localStorage.setItem('sb-motion', r ? 'reduce' : 'full'); } catch (err) { /* ignoré */ }
    syncMotion();
    live.textContent = r ? 'Animations reduced' : 'Animations restored';
    if (r) {
      endIntro();
      slides.forEach(function (x) { clearTimeout(x._transT); x.classList.remove('is-leaving', 'is-entering'); x.classList.toggle('is-active', x === slides[cur]); });
      if (fx.ctx) fx.ctx.clearRect(0, 0, fx.c.width, fx.c.height);
      fx.mode = null;
      if (holo.inst) { var w = holo.want; holo.inst.show(-1, true); holo.inst.show(w, true); }
    } else fxAttach(slides[cur]);
    if (holo.inst) holo.inst.invalidate();
    if (map.inst) map.inst.invalidate();
    if (r && ba.dur) { baSet(ba.to === 100 ? 50 : ba.to); baEnd(); }
    mapSyncVideo();
    syncVideos();
    kick();
  });
  syncMotion();

  /* ------------------------------------------------------------------ commandes discrètes au repos */
  var idleT;
  function wake() { body.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(function () { body.classList.add('is-idle'); }, 3000); }
  ['mousemove', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, wake, { passive: true }); });
  wake();

  /* ------------------------------------------------------------------ configurateur 3D par-dessus */
  var cfg = $('#cfg'), frame3d = $('#cfg-frame'), backBtn = $('#cfg-back'), open3d = $('#open-3d');
  var cfgReady = false, wantOpen = false;
  function prepareConfig() {
    if (frame3d.src) return;
    frame3d.addEventListener('load', function () {
      var doc;
      try { doc = frame3d.contentDocument; } catch (err) { return; }
      if (!doc) return;
      // le bandeau reste celui de la présentation, juste au-dessus
      var st = doc.createElement('style');
      st.textContent = '.student-banner{display:none!important}html{--banner-h:0px!important}';
      doc.head.appendChild(st);
      // « Close » et Échap dans le configurateur ramènent à la présentation
      doc.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#close-3d')) { e.preventDefault(); e.stopPropagation(); closeConfig(); }
      }, true);
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !doc.querySelector('dialog[open]')) { e.preventDefault(); e.stopPropagation(); closeConfig(); }
      }, true);
      cfgReady = true;
      if (wantOpen) { immerse(); focusFrame(); }
    });
    frame3d.src = 'index.html'; // préchargé sans s'ouvrir (pour ne pas prendre le focus) ; ouvert au clic
  }
  function immerse() {
    // ouvre directement le configurateur plein écran du site (même bouton que « Open the configurator »)
    try {
      var doc = frame3d.contentDocument;
      if (doc && !doc.body.classList.contains('config-open')) { var b = doc.querySelector('[data-open-config]'); if (b) b.click(); }
    } catch (err) { /* ignoré */ }
  }
  function focusFrame() {
    setTimeout(function () { try { frame3d.contentWindow.focus(); var c = frame3d.contentDocument.getElementById('stage-canvas'); if (c) c.focus({ preventScroll: true }); } catch (err) { /* ignoré */ } }, 80);
  }
  function openConfig() {
    prepareConfig();
    cfgOpen = true; wantOpen = true;
    cfg.classList.add('is-open'); cfg.setAttribute('aria-hidden', 'false');
    deck.setAttribute('inert', ''); $('#controls').setAttribute('inert', '');
    live.textContent = '3D configurator opened';
    syncParallaxClass();
    syncVideos();
    mapSyncVideo();
    backBtn.focus();
    if (cfgReady) immerse();
  }
  function closeConfig() {
    if (!cfgOpen) return;
    cfgOpen = false; wantOpen = false;
    cfg.classList.remove('is-open'); cfg.setAttribute('aria-hidden', 'true');
    deck.removeAttribute('inert'); $('#controls').removeAttribute('inert');
    live.textContent = 'Back to slide ' + (cur + 1) + ': ' + slides[cur].dataset.title;
    syncParallaxClass();
    syncVideos();
    kick();
    window.focus();
    open3d.focus({ preventScroll: true });
  }
  open3d.addEventListener('click', openConfig);
  backBtn.addEventListener('click', closeConfig);
  // piège du focus : dans le panneau, Tab circule entre le bouton retour et le configurateur
  cfg.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && document.activeElement === backBtn) { e.preventDefault(); focusFrame(); }
  });

  /* ------------------------------------------------------------------ départ */
  go(fromHash(), { force: true, allSteps: false });
})();
