import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
import './index.css';

const isAdminPath = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const Root = isAdminPath ? AdminApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
