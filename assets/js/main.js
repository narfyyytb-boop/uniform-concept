/* =============================================================================
   Sophie Barat — interactions du site
   ========================================================================== */
import { COLORS, ITEMS, TENUES, DEFAULT_TENUE, MODELS } from './collection-data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const isReduced = () => html.classList.contains('reduce-motion');
const itemById = id => ITEMS.find(i => i.id === id);

/* ------------------------------------------------------------------ utilitaires */
function toast(msg, ms = 3200) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

/* ------------------------------------------------------------------ réduction des animations */
function setMotion(reduce, persist = true) {
  html.classList.toggle('reduce-motion', reduce);
  if (persist) { try { localStorage.setItem('sb-motion', reduce ? 'reduce' : 'full'); } catch { /* ignoré */ } }
  $$('[data-motion-toggle]').forEach(b => {
    b.setAttribute('aria-pressed', String(reduce));
    const s = b.querySelector('span'); if (s) s.textContent = reduce ? 'Turn animations back on' : 'Reduce animations';
  });
  window.dispatchEvent(new CustomEvent('sb:motion', { detail: reduce }));
}
setMotion(isReduced(), false);
$$('[data-motion-toggle]').forEach(b => b.addEventListener('click', () => {
  setMotion(!isReduced());
  toast(isReduced() ? 'Animations reduced' : 'Animations restored');
}));

/* ------------------------------------------------------------------ en-tête & navigation */
const header = $('.site-header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 10);
window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

const nav = $('#main-nav'); const menuBtn = $('#menu-btn');
function closeSubs(except) {
  $$('.has-sub').forEach(li => { if (li !== except) { li.classList.remove('is-open'); li.querySelector('.nav-link')?.setAttribute('aria-expanded', 'false'); } });
}
function setMenu(open) {
  if (!nav || !menuBtn) return;
  nav.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menuBtn.querySelector('use')?.setAttribute('href', open ? '#i-close' : '#i-menu');
  document.body.style.overflow = open ? 'hidden' : '';
  if (!open) closeSubs();
}
menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
$$('.has-sub > .nav-link').forEach(btn => {
  const li = btn.parentElement;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !li.classList.contains('is-open');
    closeSubs(li); li.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
  });
  li.addEventListener('keydown', e => {
    if (e.key === 'Escape' && li.classList.contains('is-open')) { closeSubs(); btn.focus(); }
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && li.classList.contains('is-open')) {
      const links = $$('.sub a', li); const i = links.indexOf(document.activeElement);
      e.preventDefault(); links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
    }
  });
  li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget) && window.matchMedia('(min-width: 961px)').matches) closeSubs(); });
});
document.addEventListener('click', e => { if (!e.target.closest('.has-sub')) closeSubs(); });
nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });

// lien actif selon la section visible
const spyTargets = [['collection', 'The collection'], ['futur', 'School of the future'],['etablissement', 'The school'], ['vie-scolaire', 'School life'], ['actualites', 'News'], ['logo', 'News']];
const navByLabel = label => $$('.nav-link').find(n => n.textContent.trim().startsWith(label));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const label = spyTargets.find(([id]) => id === en.target.id)?.[1];
      $$('.nav-link').forEach(n => n.classList.remove('is-active'));
      const link = label && navByLabel(label); if (link) link.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  spyTargets.forEach(([id]) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ------------------------------------------------------------------ apparitions au défilement */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  const watch = root => $$('.reveal:not(.is-in)', root).forEach((el, i) => {
    if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${(i % 4) * 0.08}s`);
    io.observe(el);
  });
  watch(document); window.__sbWatch = watch;
} else { $$('.reveal').forEach(el => el.classList.add('is-in')); }

/* ------------------------------------------------------------------ modales (dialog) */
function openDialog(d, opener) {
  if (!d) return; d._opener = opener || document.activeElement;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function closeDialog(d) { if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); d._opener?.focus?.(); }
$$('dialog.modal').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeDialog(d); });
  d.addEventListener('cancel', e => { e.preventDefault(); closeDialog(d); });
});

/* ------------------------------------------------------------------ recherche */
const SEARCH_INDEX = [
  ['Home', 'The next generation at Sophie Barat', '#accueil'],
  ['The collection', 'Uniforms, lookbook, details and finishes', '#collection'],
  ['The school of the future', 'Virtual school things and holograms, boarding school with a shopping centre and restaurants, rooms that change with a tablet, moving walkways', '#futur'],
  ['3D configurator', 'Build the girl’s or boy’s outfit in 3D', '#configurateur'],
  ['History', 'The school and its history', '#histoire'],
  ['Educational vision', 'Ambitions and teaching approach', '#projet'],
  ['Student support', 'Mentoring, guidance, extra help', '#accompagnement'],
  ['Values', 'Excellence, learning, sharing, future', '#valeurs'],
  ['School life', 'Activities, projects, events', '#vie-scolaire'],
  ['News', 'The latest news', '#actualites'],
  ['The logo', 'The logo, its colours and the slogan', '#logo'],
  ['Legal notice', 'Publisher, hosting, credits', 'legal-notice.html'],
  ['Privacy', 'Personal data and GDPR', 'privacy.html'],
  ['Accessibility', 'Statement and settings', 'legal-notice.html#accessibilite'],
  ...ITEMS.map(i => [i.nom, `${i.categorie} — ${i.description}`, `#fiche-${i.id}`]),
];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const searchDlg = $('#search'); const sInput = $('#search-input'); const sRes = $('#search-results');
function renderSearch(q) {
  if (!sRes) return;
  const n = norm(q.trim());
  const hits = n ? SEARCH_INDEX.filter(([t, d]) => norm(t + ' ' + d).includes(n)) : SEARCH_INDEX.slice(0, 6);
  sRes.innerHTML = hits.length ? hits.slice(0, 8).map(([t, d, h]) => `<li><a href="${h}">${escapeHtml(t)}<small>${escapeHtml(d.slice(0, 110))}</small></a></li>`).join('')
    : `<li><p>No results for “${escapeHtml(q)}”. Try “collection”, “logo” or “values”.</p></li>`;
}
$('#search-open')?.addEventListener('click', e => { renderSearch(''); openDialog(searchDlg, e.currentTarget); setTimeout(() => sInput?.focus(), 30); });
sInput?.addEventListener('input', () => renderSearch(sInput.value));
$('#search-form')?.addEventListener('submit', e => { e.preventDefault(); sRes?.querySelector('a')?.click(); });
sRes?.addEventListener('click', e => {
  const a = e.target.closest('a'); if (!a) return;
  const h = a.getAttribute('href');
  if (h.startsWith('#fiche-')) { e.preventDefault(); closeDialog(searchDlg); openSheet(h.slice(7)); return; }
  closeDialog(searchDlg);
});
document.addEventListener('keydown', e => {
  if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !e.target.closest('input, textarea, select') && searchDlg && !searchDlg.open) {
    e.preventDefault(); $('#search-open')?.click();
  }
});

/* ------------------------------------------------------------------ état du configurateur */
const state = {
  model: 'garcon', focus: 'haut', immersive: false,
  outfits: Object.fromEntries(Object.keys(MODELS).map(m => [m, {
    tenue: DEFAULT_TENUE[m],
    colors: Object.fromEntries(ITEMS.map(i => [i.id, i.couleurDefaut])),
  }])),
};
let viewer = null;
const listeners = new Set();
const commit = (opts) => { listeners.forEach(f => f(opts)); viewer?.setState(state, opts); };
const tenueOf = m => TENUES.find(t => t.id === state.outfits[m].tenue);
const partOf = (m, type) => tenueOf(m)[type];
const itemsFor = (model, type) => {
  // hauts : tous ceux qui existent pour ce modèle ; bas : ceux compatibles avec le haut porté
  const ids = type === 'haut' ? TENUES.filter(t => t.model === model).map(t => t.haut)
    : TENUES.filter(t => t.model === model).map(t => t.bas);
  return ITEMS.filter(i => i.type === type && ids.includes(i.id));
};
const focusedItem = () => itemById(partOf(state.model, state.focus));

function selectItem(id, { model } = {}) {
  const it = itemById(id); if (!it) return;
  if (model) state.model = model;
  if (!TENUES.some(t => t.model === state.model && t[it.type] === id)) state.model = TENUES.find(t => t[it.type] === id).model;
  const cur = tenueOf(state.model);
  const other = it.type === 'haut' ? 'bas' : 'haut';
  // on garde l'autre pièce si une tenue la combine avec la pièce choisie
  const t = TENUES.find(x => x.model === state.model && x[it.type] === id && x[other] === cur[other])
    || TENUES.find(x => x.model === state.model && x[it.type] === id);
  state.outfits[state.model].tenue = t.id; state.focus = it.type;
  commit();
}
function step(dir) {
  const list = TENUES.filter(t => t.model === state.model);
  const i = list.findIndex(t => t.id === state.outfits[state.model].tenue);
  const t = list[(i + dir + list.length) % list.length];
  state.outfits[state.model].tenue = t.id; state.focus = 'haut';
  commit(); announce();
}
function announce() {
  const it = focusedItem(); const c = COLORS[state.outfits[state.model].colors[it.id]].label;
  const s = $('#viewer-status'); if (s) s.textContent = `${MODELS[state.model].label}: ${it.nom}, ${c}.`;
}

/* carte produit */
const ICONS = { broderie: 'i-broderie', coupe: 'i-coupe', palette: 'i-palette', nuage: 'i-nuage', col: 'i-col', poche: 'i-poche' };
function renderCard({ swap = true } = {}) {
  const it = focusedItem(); if (!it) return;
  const ck = state.outfits[state.model].colors[it.id];
  $('#pc-kicker').textContent = `${it.type === 'haut' ? 'Top' : 'Bottom'} · ${MODELS[state.model].label}`;
  $('#pc-title').textContent = it.nom;
  $('#pc-desc').textContent = it.description;
  $('#pc-specs').innerHTML = it.points.map(([ic, label]) => `<li><svg class="ico" aria-hidden="true"><use href="#${ICONS[ic] || 'i-star'}"/></svg>${escapeHtml(label)}</li>`).join('');
  $('#pc-color-name').textContent = COLORS[ck].label;
  $('#swatches').innerHTML = it.couleurs.map(k => `<button type="button" class="swatch" role="radio" data-color="${k}" style="--c:${COLORS[k].hex}" aria-checked="${k === ck}" aria-label="${COLORS[k].label}" tabindex="${k === ck ? 0 : -1}"></button>`).join('');
  $$('.pk-list').forEach(list => {
    const type = list.dataset.type; const cur = partOf(state.model, type);
    list.innerHTML = itemsFor(state.model, type).map(i => `<button type="button" class="pk" role="radio" data-item="${i.id}" aria-checked="${i.id === cur}" tabindex="${i.id === cur ? 0 : -1}">${escapeHtml(i.categorie.replace(' / jackets', ''))}</button>`).join('');
  });
  $$('.seg [data-model]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.model === state.model)));
  if (swap && !isReduced()) {
    ['#pc-title', '#pc-desc', '#pc-specs'].forEach(s => { const el = $(s); el.classList.remove('is-swapping'); void el.offsetWidth; el.classList.add('is-swapping'); });
  }
}
listeners.add(renderCard);

// radiogroups : flèches clavier
function radioKeys(container, selector, onPick) {
  container?.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = $$(selector, e.target.closest('[role="radiogroup"]') || container); const i = items.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const n = items[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + items.length) % items.length];
    onPick(n); requestAnimationFrame(() => $(`${selector}[aria-checked="true"]`, container)?.focus());
  });
}
$('#swatches')?.addEventListener('click', e => { const b = e.target.closest('.swatch'); if (b) pickColor(b.dataset.color); });
radioKeys($('#swatches'), '.swatch', b => pickColor(b.dataset.color));
function pickColor(k) { const it = focusedItem(); state.outfits[state.model].colors[it.id] = k; commit(); renderCard({ swap: false }); announce(); }
$('#pc-pickers')?.addEventListener('click', e => { const b = e.target.closest('.pk'); if (b) { selectItem(b.dataset.item); announce(); } });
radioKeys($('#pc-pickers'), '.pk', b => { selectItem(b.dataset.item); announce(); });
$$('.seg [data-model]').forEach(b => b.addEventListener('click', () => { state.model = b.dataset.model; commit(); announce(); }));
radioKeys($('.seg'), '[data-model]', b => { state.model = b.dataset.model; commit(); announce(); });
$('#item-prev')?.addEventListener('click', () => step(-1));
$('#item-next')?.addEventListener('click', () => step(1));
$('#open-sheet')?.addEventListener('click', e => openSheet(focusedItem().id, e.currentTarget));

/* mode configurateur plein écran */
function setImmersive(on, opener) {
  state.immersive = on;
  document.body.classList.toggle('config-open', on);
  const v = $('#viewer');
  if (on) {
    setImmersive._opener = opener || document.activeElement;
    v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '3D uniform configurator');
    $('#main-nav')?.setAttribute('inert', ''); $('main > section:not(#accueil)') && $$('main > section:not(#accueil), .features, .hero-copy, .site-footer').forEach(el => el.setAttribute('inert', ''));
    setTimeout(() => $('#stage-canvas')?.focus({ preventScroll: true }), 50);
  } else {
    v.removeAttribute('role'); v.removeAttribute('aria-modal'); v.removeAttribute('aria-label');
    $$('[inert]').forEach(el => el.removeAttribute('inert'));
    setImmersive._opener?.focus?.({ preventScroll: true });
  }
  commit();
}
$('#explore-3d')?.addEventListener('click', e => setImmersive(true, e.currentTarget));
$('#close-3d')?.addEventListener('click', () => setImmersive(false));
$$('[data-open-config]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); setImmersive(true, e.currentTarget); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.immersive && !document.querySelector('dialog[open]')) setImmersive(false); });
// piège du focus dans le configurateur
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !state.immersive || document.querySelector('dialog[open]')) return;
  const f = $$('#viewer button:not([hidden]), #viewer canvas, #product-card button').filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* commandes caméra */
// nom du fichier de capture, en anglais : sophie-barat-boy-signature-bomber-campus-trousers.png
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function shotName() {
  const t = tenueOf(state.model);
  return `sophie-barat-${[MODELS[state.model].label, itemById(t.haut).nom, itemById(t.bas).nom].map(slug).join('-')}.png`;
}
$$('[data-cam]').forEach(b => b.addEventListener('click', async () => {
  if (!viewer) return;
  const a = b.dataset.cam;
  if (a === 'zoom-in') viewer.zoom(0.8);
  if (a === 'zoom-out') viewer.zoom(1.25);
  if (a === 'reset') { viewer.reset(); $('[data-cam="pan"]')?.setAttribute('aria-pressed', 'false'); viewer.setPanMode(false); }
  if (a === 'pan') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); viewer.setPanMode(on); toast(on ? 'Pan mode: drag to move the camera' : 'Rotate mode'); }
  if (a === 'shot') {
    const blob = await viewer.screenshot(); if (!blob) return;
    const url = URL.createObjectURL(blob); const link = Object.assign(document.createElement('a'), { href: url, download: shotName() });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Image saved');
  }
}));
$$('[data-view]').forEach(b => b.addEventListener('click', () => {
  $$('[data-view]').forEach(x => x.classList.toggle('is-active', x === b)); viewer?.view(b.dataset.view);
}));
const autoBtn = $('#autorotate-btn');
autoBtn?.addEventListener('click', () => { if (!viewer) return; const on = autoBtn.getAttribute('aria-pressed') !== 'true'; viewer.setAutoRotate(on); });
function syncAuto(on) { autoBtn?.setAttribute('aria-pressed', String(on)); autoBtn?.setAttribute('aria-label', `360-degree auto-rotation: ${on ? 'on' : 'off'}`); }
syncAuto(!isReduced());

/* ------------------------------------------------------------------ chargement de la 3D */
async function initViewer() {
  const v = $('#viewer'); const canvas = $('#stage-canvas'); if (!v || !canvas) return;
  const setStatus = (st, msg) => { v.dataset.state = st; if (msg) $('.loader-text').innerHTML = msg; };
  try {
    const mod = await import('./viewer.js');
    if (!mod.webglAvailable()) throw Object.assign(new Error('webgl'), { code: 'webgl' });
    viewer = new mod.UniformViewer({ canvas, container: v, reducedMotion: isReduced() });
    viewer.addEventListener('autorotate', e => syncAuto(e.detail));
    viewer.addEventListener('interact', () => { if (viewer.controls.autoRotate) viewer.setAutoRotate(false); });
    window.addEventListener('sb:motion', e => { viewer.setReducedMotion(e.detail); if (!e.detail) viewer.setAutoRotate(true); });
    viewer.addEventListener('busy', e => v.classList.toggle('is-busy', e.detail));
    await viewer.load(p => { const pct = $('#loader-pct'); if (pct) pct.textContent = `${Math.round(p * 100)}%`; });
    viewer.setState(state, { animate: false });
    setStatus('ready');
    const cx = navigator.connection; const light = cx && (cx.saveData || /2g/.test(cx.effectiveType || ''));
    const preload = () => { if (!preload.done) { preload.done = true; viewer.preloadAll(); } };
    ['#item-prev', '#item-next', '#explore-3d', '.seg', '#pc-pickers', '[data-open-config]'].forEach(sel => $$(sel).forEach(el => el.addEventListener('pointerdown', preload, { once: true })));
    if (!light && window.innerWidth >= 900) setTimeout(preload, 6000);
  } catch (err) {
    console.error(err);
    setStatus('error', err.code === 'webgl'
      ? '3D isn’t available on this device (WebGL is turned off). The collection details are still available further down the page.'
      : 'The 3D models failed to load. <button class="btn-link" type="button" id="retry-3d">Try again</button>');
    $('#retry-3d')?.addEventListener('click', () => location.reload());
  }
}
renderCard({ swap: false });
if ($('#viewer')) {
  // chargement dès que la visionneuse approche de l'écran
  const v = $('#viewer');
  const start = () => { if (!initViewer.started) { initViewer.started = true; initViewer(); } };
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '300px' }); io.observe(v); } else start();
}

/* ------------------------------------------------------------------ collection : cartes & fiches */
const products = $('#products');
if (products) {
  products.innerHTML = ITEMS.map(i => `
  <article class="product reveal" data-type="${i.type}" id="article-${i.id}">
    <div class="product-media"><img src="assets/img/produits/${i.id}.webp" width="640" height="528" alt="Design visual: ${escapeHtml(i.nom.toLowerCase())} worn by a student (computer-generated image)." loading="lazy"><span class="tag">${escapeHtml(i.categorie)}</span></div>
    <div class="product-body">
      <h3>${escapeHtml(i.nom)}</h3>
      <p>${escapeHtml(i.description)}</p>
      <div class="product-colors" aria-label="Available colours: ${i.couleurs.map(k => COLORS[k].label).join(', ')}">${i.couleurs.map(k => `<span style="--c:${COLORS[k].hex}" title="${COLORS[k].label}"></span>`).join('')}</div>
      <div class="product-actions">
        <button class="btn btn-dark" type="button" data-sheet="${i.id}">View details</button>
        <button class="btn btn-light" type="button" data-try="${i.id}"><svg class="ico" aria-hidden="true"><use href="#i-cube"/></svg> Try it in 3D</button>
      </div>
    </div>
  </article>`).join('');
  window.__sbWatch?.(products);
  products.addEventListener('click', e => {
    const s = e.target.closest('[data-sheet]'); if (s) openSheet(s.dataset.sheet, s);
    const t = e.target.closest('[data-try]'); if (t) { selectItem(t.dataset.try); setImmersive(true, t); }
  });
}
$$('.chip[data-filter]').forEach(ch => ch.addEventListener('click', () => {
  $$('.chip[data-filter]').forEach(c => { c.classList.toggle('is-active', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
  $$('.product').forEach(p => p.classList.toggle('is-hidden', ch.dataset.filter !== 'all' && p.dataset.type !== ch.dataset.filter));
}));

const sheet = $('#sheet');
function openSheet(id, opener) {
  const i = itemById(id); if (!i || !sheet) return;
  $('#sheet-body').innerHTML = `
    <p class="pc-kicker">${escapeHtml(i.categorie)}</p>
    <h2 id="sheet-title">${escapeHtml(i.nom)}</h2>
    <p class="pc-desc">${escapeHtml(i.description)}</p>
    <div class="sheet-grid">
      <div class="sheet-media"><img src="assets/img/produits/${i.id}.webp" width="640" height="528" alt="Design visual: ${escapeHtml(i.nom.toLowerCase())} (computer-generated image)."></div>
      <dl>
        <div><dt>Fabric</dt><dd>${escapeHtml(i.matiere)}${i.aValider ? ' <span class="tag">To be confirmed</span>' : ''}</dd></div>
        <div><dt>Fit</dt><dd>${escapeHtml(i.coupe)}</dd></div>
        <div><dt>Available colours</dt><dd class="sheet-colors">${i.couleurs.map(k => `<span><i style="--c:${COLORS[k].hex}"></i>${COLORS[k].label}</span>`).join('')}</dd></div>
        <div><dt>Details and finishes</dt><dd><ul>${i.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></dd></div>
        <div><dt>Offered for</dt><dd>${i.pour.map(m => MODELS[m].label).join(' and ')}</dd></div>
      </dl>
    </div>
    <p class="note" style="color:#c3cfec"><svg class="ico" aria-hidden="true"><use href="#i-info"/></svg> Textile specifications are indicative proposals, subject to approval by the school.</p>
    <div class="sheet-actions"><button class="btn btn-primary" type="button" data-try-sheet="${i.id}"><svg class="ico" aria-hidden="true"><use href="#i-cube"/></svg> Try it in 3D</button><button class="btn btn-ghost" type="button" data-close>Close</button></div>`;
  $('[data-try-sheet]', sheet).addEventListener('click', () => { closeDialog(sheet); selectItem(i.id); setImmersive(true); });
  openDialog(sheet, opener);
}

/* ------------------------------------------------------------------ QR code de la présentation */
// ?config=1 : le configurateur s'ouvre directement (même action que le bouton [data-open-config])
if (new URLSearchParams(location.search).get('config') === '1') $('[data-open-config]')?.click();
