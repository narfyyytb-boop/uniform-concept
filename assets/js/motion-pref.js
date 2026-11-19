/* Appliqué avant l'affichage : préférence « réduire les animations » (système ou choix mémorisé). */
(function () {
  var d = document.documentElement, pref = null;
  try { pref = localStorage.getItem('sb-motion'); } catch (e) { /* stockage indisponible */ }
  var sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pref === 'reduce' || (pref === null && sys)) d.classList.add('reduce-motion');
  if (/[?&]presentation\b/.test(location.search)) d.classList.add('hide-drafts');
  d.classList.add('js');
  // bandeau « Student project » : sa hauteur réelle (1 à 3 lignes selon la largeur) décale l'en-tête collant
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('.student-banner'); if (!b) return;
    var set = function () { d.style.setProperty('--banner-h', b.getBoundingClientRect().height + 'px'); };
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(b); else window.addEventListener('resize', set);
  });
  // transitions entre pages : coupées si « réduire les animations », et sans erreur si le navigateur les saute
  ['pageswap', 'pagereveal'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      var vt = e.viewTransition; if (!vt) return;
      ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (vt[k]) vt[k].catch(function () {}); });
      if (d.classList.contains('reduce-motion')) vt.skipTransition();
    });
  });
})();
