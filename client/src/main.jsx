import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminDashboard } from './components/AdminDashboard';
import './index.css';

const path = window.location.pathname || '/';

if ('serviceWorker' in navigator && !path.startsWith('/admin')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path.startsWith('/admin') ? <AdminDashboard /> : <App />}
  </React.StrictMode>
);
