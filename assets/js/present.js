/* =============================================================================
   Sophie Barat — mode présentation
   Navigation : ← → espace, Page préc./suiv., clic à gauche / à droite, balayage.
   F : plein écran · Échap : retour au site · l'adresse suit l'écran (#3).
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

  /* ------------------------------------------------------------------ préparation des écrans */
  slides.forEach(function (s, i) {
    s.id = 'slide-' + (i + 1);
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', (i + 1) + ' of ' + total + ': ' + s.dataset.title);
    s._steps = maxStep(s);
    s._shown = 0;
  });
  function maxStep(s) {
    return $$('[data-step]', s).reduce(function (m, el) { return Math.max(m, +el.dataset.step); }, 0);
  }
  function setSteps(s, n) {
    s._shown = n;
    $$('[data-step]', s).forEach(function (el) { el.classList.toggle('is-shown', +el.dataset.step <= n); });
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
      img.srcset = base + '-sm.webp 960w, ' + base + '.webp 1920w';
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
    if (!media || media._loading) return;
    media._loading = true;
    if (media.hasAttribute('data-room')) return prepareRoom(s, media);
    loadImg(media.dataset.img, media.dataset.alt).then(function (img) {
      media.insertBefore(img, media.firstChild); media.classList.add('has-img');
    }).catch(function () { useFallback(media); });
  }

  /* chambre : paire repos / musculation en fondu, sinon une seule image */
  var room = { imgs: [], timer: null, mode: 0, paused: false };
  function prepareRoom(s, media) {
    var alt = media.dataset.alt;
    Promise.all([loadImg('assets/img/expo/room-rest', 'A student’s room set up as a calm rest room.'), loadImg('assets/img/expo/room-gym', 'The same room turned into a gym.')])
      .then(function (pair) {
        pair.forEach(function (img, i) { img.className = 'room-img' + (i === 0 ? ' is-on' : ''); media.insertBefore(img, media.firstChild); });
        room.imgs = pair; media.classList.add('has-img'); syncRoomImg();
      })
      .catch(function () {
        return loadImg('assets/img/expo/room', alt).then(function (img) { media.insertBefore(img, media.firstChild); media.classList.add('has-img'); });
      })
      .catch(function () { useFallback(media); });
  }
  var modes = $$('.slide-room .mode');
  function setMode(i) {
    room.mode = i;
    modes.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
    syncRoomImg();
  }
  function syncRoomImg() {
    if (room.imgs.length !== 2) return;
    var gym = room.mode % 2 === 1; // Rest → repos, Gym → muscu, Music → repos, Study → muscu
    room.imgs[0].classList.toggle('is-on', !gym);
    room.imgs[1].classList.toggle('is-on', gym);
  }
  function roomCycle(on) {
    clearInterval(room.timer); room.timer = null;
    if (on && !reduced() && !room.paused) room.timer = setInterval(function () { setMode((room.mode + 1) % modes.length); }, 2600);
  }
  modes.forEach(function (b, i) { b.addEventListener('click', function () { room.paused = true; roomCycle(false); setMode(i); }); });

  /* ------------------------------------------------------------------ navigation */
  var live = $('#live'), count = $('#count'), bar = $('#bar'), who = $('#who');
  var prevBtn = $('#prev'), nextBtn = $('#next');
  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(total - 1, n));
    var back = n < cur;
    if (n === cur && !opts.force) return;
    slides.forEach(function (s, i) {
      var on = i === n;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', String(!on));
      if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
    var s = slides[n];
    // en revenant en arrière, l'écran s'affiche avec tous ses repères
    setSteps(s, back && opts.allSteps !== false ? s._steps : 0);
    cur = n;
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
    // chambre : pastilles qui s'allument tour à tour
    if (s.classList.contains('slide-room')) { room.paused = false; setMode(0); roomCycle(true); } else roomCycle(false);
    // configurateur : on le prépare dès l'écran « In 3D »
    if (s.classList.contains('slide-3d')) prepareConfig();
  }
  function next() {
    var s = slides[cur];
    if (s._shown < s._steps) { setSteps(s, s._shown + 1); announceStep(s); prevBtn.disabled = false; return; }
    go(cur + 1);
  }
  function prev() {
    var s = slides[cur];
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
    var onControl = t.closest && t.closest('button, a, input, select, textarea');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': next(); e.preventDefault(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': prev(); e.preventDefault(); break;
      case ' ': case 'Spacebar':
        if (onControl) return; // espace active le bouton qui a le focus
        if (e.shiftKey) prev(); else next(); e.preventDefault(); break;
      case 'Home': go(0); e.preventDefault(); break;
      case 'End': go(total - 1); e.preventDefault(); break;
      case 'f': case 'F': toggleFullscreen(); e.preventDefault(); break;
      case 'Escape': location.href = 'index.html'; break;
    }
  });

  /* clic / appui : à gauche = précédent, à droite = suivant ; balayage sur tactile */
  var deck = $('#deck');
  var touch = null, swiped = false;
  deck.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('button, a, input, select, textarea, label')) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (e.clientX < window.innerWidth * 0.35) prev(); else next();
  });
  deck.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touch = null; return; }
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
  }
  motionBtn.addEventListener('click', function () {
    var r = !reduced();
    html.classList.toggle('reduce-motion', r);
    try { localStorage.setItem('sb-motion', r ? 'reduce' : 'full'); } catch (err) { /* ignoré */ }
    syncMotion();
    live.textContent = r ? 'Animations reduced' : 'Animations restored';
    if (slides[cur].classList.contains('slide-room')) roomCycle(true);
  });
  syncMotion();

  /* ------------------------------------------------------------------ commandes discrètes au repos */
  var idleT;
  function wake() { body.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(function () { body.classList.add('is-idle'); }, 3000); }
  ['mousemove', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, wake, { passive: true }); });
  wake();

  /* ------------------------------------------------------------------ configurateur 3D par-dessus */
  var cfg = $('#cfg'), frame = $('#cfg-frame'), backBtn = $('#cfg-back'), open3d = $('#open-3d');
  var cfgOpen = false, cfgReady = false, wantOpen = false;
  function prepareConfig() {
    if (frame.src) return;
    frame.addEventListener('load', function () {
      var doc;
      try { doc = frame.contentDocument; } catch (err) { return; }
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
    frame.src = 'index.html'; // préchargé sans s'ouvrir (pour ne pas prendre le focus) ; ouvert au clic
  }
  function immerse() {
    // ouvre directement le configurateur plein écran du site (même bouton que « Open the configurator »)
    try {
      var doc = frame.contentDocument;
      if (doc && !doc.body.classList.contains('config-open')) { var b = doc.querySelector('[data-open-config]'); if (b) b.click(); }
    } catch (err) { /* ignoré */ }
  }
  function focusFrame() {
    setTimeout(function () { try { frame.contentWindow.focus(); var c = frame.contentDocument.getElementById('stage-canvas'); if (c) c.focus({ preventScroll: true }); } catch (err) { /* ignoré */ } }, 80);
  }
  function openConfig() {
    prepareConfig();
    cfgOpen = true; wantOpen = true;
    cfg.classList.add('is-open'); cfg.setAttribute('aria-hidden', 'false');
    deck.setAttribute('inert', ''); $('#controls').setAttribute('inert', '');
    live.textContent = '3D configurator opened';
    backBtn.focus();
    if (cfgReady) immerse();
  }
  function closeConfig() {
    if (!cfgOpen) return;
    cfgOpen = false; wantOpen = false;
    cfg.classList.remove('is-open'); cfg.setAttribute('aria-hidden', 'true');
    deck.removeAttribute('inert'); $('#controls').removeAttribute('inert');
    live.textContent = 'Back to slide ' + (cur + 1) + ': ' + slides[cur].dataset.title;
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
