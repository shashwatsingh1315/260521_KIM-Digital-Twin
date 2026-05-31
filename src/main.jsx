import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// The Factory Twin v2 dashboard is now the default experience at "/".
// The original prototype is still reachable at "/legacy" for reference.
const isLegacy = window.location.pathname.startsWith('/legacy');
const Root = isLegacy
  ? App
  : React.lazy(() => import('./twin/ui/TwinApp.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isLegacy ? (
      <Root />
    ) : (
      <React.Suspense fallback={<div style={{ background: '#0c1322', width: '100vw', height: '100vh' }} />}>
        <Root />
      </React.Suspense>
    )}
  </React.StrictMode>,
);
