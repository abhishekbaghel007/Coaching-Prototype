import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import WebsiteHome from './website/WebsiteHome';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdmin = path === '/admin' || path.startsWith('/admin/');
const isWebsite = path === '/website' || path.startsWith('/website/');
const Root = isAdmin ? AdminApp : isWebsite ? WebsiteHome : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
);
