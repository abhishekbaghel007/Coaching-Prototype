// Emergency shell guard for the student home only. It does not alter solver/question routes.
const rootPath = () => {
  const p = window.location.pathname.replace(/\/+$/, '');
  return p === '' || p === '/';
};

function normalizeScrollShell() {
  if (!rootPath()) return;
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById('root');
  for (const el of [html, body, root]) {
    if (!el) continue;
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('min-height', '100%', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('overflow-x', 'hidden', 'important');
    el.style.setProperty('overflow-y', 'auto', 'important');
    el.style.setProperty('touch-action', 'pan-y', 'important');
  }
  document.querySelectorAll<HTMLElement>('.app, .np-home, .np-home-main').forEach(el => {
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('overflow-y', 'visible', 'important');
    el.style.setProperty('touch-action', 'pan-y', 'important');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalizeScrollShell);
else normalizeScrollShell();
window.setTimeout(normalizeScrollShell, 250);
window.setTimeout(normalizeScrollShell, 1000);
