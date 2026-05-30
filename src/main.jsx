import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const isTwin = window.location.pathname.startsWith('/twin');
const Root = isTwin
  ? React.lazy(() => import('./twin/ui/TwinApp.jsx'))
  : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isTwin ? (
      <React.Suspense fallback={<div style={{ background: '#0c1322', width: '100vw', height: '100vh' }} />}>
        <Root />
      </React.Suspense>
    ) : (
      <Root />
    )}
  </React.StrictMode>,
);
