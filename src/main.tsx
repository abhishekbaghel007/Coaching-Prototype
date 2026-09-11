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

function WebsiteScrollShell() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const elements = [html, body, root].filter(Boolean) as HTMLElement[];
    const previous = elements.map(el => ({
      el,
      overflowY: el.style.overflowY,
      overflowX: el.style.overflowX,
      height: el.style.height,
      minHeight: el.style.minHeight,
      maxHeight: el.style.maxHeight,
      position: el.style.position,
      touchAction: el.style.touchAction,
    }));

    for (const el of elements) {
      el.style.setProperty('overflow-y', 'auto', 'important');
      el.style.setProperty('overflow-x', 'hidden', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '100%', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('touch-action', 'pan-y', 'important');
    }

    const site = document.querySelector<HTMLElement>('.np-site');
    if (site) {
      site.style.setProperty('height', 'auto', 'important');
      site.style.setProperty('min-height', '100vh', 'important');
      site.style.setProperty('max-height', 'none', 'important');
      site.style.setProperty('overflow', 'visible', 'important');
      site.style.setProperty('overflow-y', 'visible', 'important');
      site.style.setProperty('touch-action', 'pan-y', 'important');
    }

    return () => {
      for (const item of previous) {
        item.el.style.overflowY = item.overflowY;
        item.el.style.overflowX = item.overflowX;
        item.el.style.height = item.height;
        item.el.style.minHeight = item.minHeight;
        item.el.style.maxHeight = item.maxHeight;
        item.el.style.position = item.position;
        item.el.style.touchAction = item.touchAction;
      }
    };
  }, []);

  return <WebsiteShell />;
}

function StudentShell() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const app = document.querySelector<HTMLElement>('.app');
    const homeHeader = document.querySelector<HTMLElement>('.student-v7 .v7-top');
    const elements = [html, body, root, app].filter(Boolean) as HTMLElement[];
    const previous = elements.map(el => ({
      el,
      overflowY: el.style.overflowY,
      overflowX: el.style.overflowX,
      height: el.style.height,
      minHeight: el.style.minHeight,
      maxHeight: el.style.maxHeight,
      position: el.style.position,
    }));
    const previousHeader = homeHeader ? {
      position: homeHeader.style.position,
      top: homeHeader.style.top,
      zIndex: homeHeader.style.zIndex,
    } : null;

    for (const el of elements) {
      el.style.setProperty('overflow-y', 'auto', 'important');
      el.style.setProperty('overflow-x', 'hidden', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '100%', 'important');
      el.style.setProperty('max-height', 'none', 'important');
    }
    if (root) root.style.setProperty('position', 'static', 'important');
    if (body) body.style.setProperty('position', 'static', 'important');
    if (app) {
      app.style.setProperty('overflow', 'visible', 'important');
      app.style.setProperty('height', 'auto', 'important');
      app.style.setProperty('max-height', 'none', 'important');
    }
    if (homeHeader) {
      homeHeader.style.setProperty('position', 'relative', 'important');
      homeHeader.style.setProperty('top', 'auto', 'important');
      homeHeader.style.setProperty('z-index', '2', 'important');
    }

    return () => {
      for (const item of previous) {
        item.el.style.overflowY = item.overflowY;
        item.el.style.overflowX = item.overflowX;
        item.el.style.height = item.height;
        item.el.style.minHeight = item.minHeight;
        item.el.style.maxHeight = item.maxHeight;
        item.el.style.position = item.position;
      }
      if (homeHeader && previousHeader) {
        homeHeader.style.position = previousHeader.position;
        homeHeader.style.top = previousHeader.top;
        homeHeader.style.zIndex = previousHeader.zIndex;
      }
    };
  }, []);

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
        ? WebsiteScrollShell
        : StudentShell;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
