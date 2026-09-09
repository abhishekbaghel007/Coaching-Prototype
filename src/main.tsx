import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import WebsiteHome from './website/WebsiteHome';
import ProgressFinal from './progress/ProgressFinal';
import './index.css';
import './design/stable-app-web-shell.css';
import './design/page-scroll-v2.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdmin = path === '/admin' || path.startsWith('/admin/');
const isWebsite = path === '/website' || path.startsWith('/website/');
const isProgress = path === '/progress' || path.startsWith('/progress/');
const isWebsiteProgress = path === '/website/progress';

function StudentShell() {
  const [progressOpen, setProgressOpen] = useState(false);
  useEffect(() => {
    if (window.location.pathname !== '/' && window.location.pathname !== '') return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest('button,a,[role="button"]') as HTMLElement | null;
      if (!clickable) return;
      const label = (clickable.textContent || '').trim().toLowerCase();
      if (label === 'progress' || label === 'view progress' || label === 'performance' || label.includes('progress')) {
        event.preventDefault(); event.stopPropagation(); setProgressOpen(true);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
  return <><App />{progressOpen && <ProgressFinal onClose={() => setProgressOpen(false)} />}</>;
}

function WebsiteShell() {
  const [progressOpen, setProgressOpen] = useState(false);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest('button,a,[role="button"]') as HTMLElement | null;
      if (!clickable) return;
      const label = (clickable.textContent || '').trim().toLowerCase();
      if (label === 'progress' || label === 'view progress' || label === 'performance' || label.includes('progress')) {
        event.preventDefault(); event.stopPropagation(); setProgressOpen(true);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
  return <><WebsiteHome />{progressOpen && <ProgressFinal website onClose={() => setProgressOpen(false)} />}</>;
}

const Root = isAdmin
  ? AdminApp
  : isWebsiteProgress
    ? () => <ProgressFinal website onClose={() => { window.location.href = '/website'; }} />
    : isProgress
      ? () => <ProgressFinal onClose={() => { window.location.href = '/'; }} />
      : isWebsite
        ? WebsiteShell
        : StudentShell;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
