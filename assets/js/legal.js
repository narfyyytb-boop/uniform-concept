/* Pages secondaires : année, bascule « réduire les animations ». */
const html = document.documentElement;
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
function sync() {
  const r = html.classList.contains('reduce-motion');
  document.querySelectorAll('[data-motion-toggle]').forEach(b => {
    b.setAttribute('aria-pressed', String(r));
    const s = b.querySelector('span'); if (s) s.textContent = r ? 'Turn animations back on' : 'Reduce animations';
  });
}
document.querySelectorAll('[data-motion-toggle]').forEach(b => b.addEventListener('click', () => {
  const r = !html.classList.contains('reduce-motion');
  html.classList.toggle('reduce-motion', r);
  try { localStorage.setItem('sb-motion', r ? 'reduce' : 'full'); } catch { /* ignoré */ }
  sync();
}));
sync();
