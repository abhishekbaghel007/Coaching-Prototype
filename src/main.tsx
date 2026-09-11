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
import './design/mobile-touch-fix.css';

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
