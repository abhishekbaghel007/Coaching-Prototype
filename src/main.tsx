import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import WebsiteHome from './website/WebsiteHome';
import ProgressFinal from './progress/ProgressFinal';
import './index.css';
import './design/home-redesign.css';
import './design/mobile-performance.css';
import './design/mobile-layout-fixes.css';
import './design/global-polish.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdmin = path === '/admin' || path.startsWith('/admin/');
const isWebsite = path === '/website' || path.startsWith('/website/');
const isProgress = path === '/progress' || path.startsWith('/progress/');
const isWebsiteProgress = path === '/website/progress';

if (typeof document !== 'undefined') {
  const websiteRoute = isWebsite || isWebsiteProgress;
  document.documentElement.classList.toggle('website-route', websiteRoute);
  document.documentElement.classList.toggle('student-route', !websiteRoute && !isAdmin);
  document.body.classList.toggle('website-route', websiteRoute);
  document.body.classList.toggle('student-route', !websiteRoute && !isAdmin);
}

function useMobileTouchBridge() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    let lastY = 0;
    let active = false;
    let manual = false;
    let stalledMoves = 0;
    let lastScrollTop = 0;
    let velocity = 0;
    let momentumFrame = 0;

    const interactive = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      return !!el?.closest('button,a,input,textarea,select,[contenteditable="true"],[role="button"]');
    };

    const rootScroller = () => document.scrollingElement || document.documentElement;

    const stopMomentum = () => {
      if (momentumFrame) cancelAnimationFrame(momentumFrame);
      momentumFrame = 0;
    };

    const startMomentum = () => {
      stopMomentum();
      let v = velocity;
      const step = () => {
        const root = rootScroller();
        const max = Math.max(0, root.scrollHeight - window.innerHeight);
        if (Math.abs(v) < 0.15 || max <= 0) {
          momentumFrame = 0;
          return;
        }
        const next = Math.max(0, Math.min(max, root.scrollTop + v));
        root.scrollTop = next;
        if (next <= 0 || next >= max) {
          momentumFrame = 0;
          return;
        }
        v *= 0.94;
        momentumFrame = requestAnimationFrame(step);
      };
      if (Math.abs(v) >= 0.8) momentumFrame = requestAnimationFrame(step);
    };

    const onStart = (event: TouchEvent) => {
      stopMomentum();
      manual = false;
      stalledMoves = 0;
      velocity = 0;

      if (event.touches.length !== 1 || interactive(event.target)) {
        active = false;
        return;
      }

      const root = rootScroller();
      lastY = event.touches[0].clientY;
      lastScrollTop = root.scrollTop;
      active = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return;
      if (interactive(event.target)) {
        active = false;
        return;
      }

      const root = rootScroller();
      const y = event.touches[0].clientY;
      const delta = lastY - y;
      lastY = y;
      if (Math.abs(delta) < 0.5) return;

      const current = root.scrollTop;

      // Let the browser handle normal touch scrolling. The JS bridge only
      // takes over if the page demonstrably refuses to move for two moves.
      if (!manual) {
        if (Math.abs(current - lastScrollTop) > 0.5) {
          active = false;
          return;
        }
        stalledMoves += 1;
        lastScrollTop = current;
        if (stalledMoves < 2) return;
        manual = true;
      }

      const max = Math.max(0, root.scrollHeight - window.innerHeight);
      if (max <= 0) return;

      const next = Math.max(0, Math.min(max, current + delta));
      if (next !== current) {
        event.preventDefault();
        root.scrollTop = next;
        velocity = velocity * 0.65 + delta * 0.35;
      }
    };

    const end = () => {
      if (manual) startMomentum();
      active = false;
      manual = false;
      stalledMoves = 0;
    };

    document.addEventListener('touchstart', onStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onMove, { capture: true, passive: false });
    document.addEventListener('touchend', end, { capture: true, passive: true });
    document.addEventListener('touchcancel', end, { capture: true, passive: true });

    return () => {
      stopMomentum();
      document.removeEventListener('touchstart', onStart, true);
      document.removeEventListener('touchmove', onMove, true);
      document.removeEventListener('touchend', end, true);
      document.removeEventListener('touchcancel', end, true);
    };
  }, []);
}

function useProgressLauncher() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest('button,a,[role="button"]') as HTMLElement | null;
      if (!clickable) return;
      const label = (clickable.textContent || '').trim().toLowerCase();
      if (label === 'progress' || label === 'view progress' || label === 'performance') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return [open, setOpen] as const;
}

function StudentShell() {
  const [open, setOpen] = useProgressLauncher();
  return <><App />{open && <ProgressFinal onClose={() => setOpen(false)} />}</>;
}

function WebsiteShell() {
  const [open, setOpen] = useProgressLauncher();
  return <><WebsiteHome />{open && <ProgressFinal website onClose={() => setOpen(false)} />}</>;
}

const ProgressRoute = ({ website = false }: { website?: boolean }) => (
  <ProgressFinal website={website} onClose={() => { window.location.href = website ? '/website' : '/'; }} />
);

const Root = isAdmin
  ? AdminApp
  : isWebsiteProgress
    ? () => <ProgressRoute website />
    : isProgress
      ? ProgressRoute
      : isWebsite
        ? WebsiteShell
        : StudentShell;

function RootWithTouch() {
  useMobileTouchBridge();
  return <Root />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RootWithTouch /></React.StrictMode>,
);
