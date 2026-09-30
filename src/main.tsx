import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

const isElectron = /Electron/i.test(navigator.userAgent);

function BrowserOnlyScreen() {
  return (
    <div className="app">
      <div className="empty">
        <div className="brand-name" style={{ fontSize: 13, color: 'var(--accent)' }}>
          MapLead Workspace
        </div>
        <h1>Use the desktop window</h1>
        <p>
          This browser tab is only the Vite dev server. It cannot save progress.
        </p>
        <p style={{ color: 'var(--text)', fontWeight: 600 }}>
          Switch to the <strong>MapLead Workspace</strong> desktop window from the taskbar.
        </p>
      </div>
    </div>
  );
}

function PreloadFailedScreen() {
  return (
    <div className="app">
      <div className="empty">
        <div className="brand-name" style={{ fontSize: 13, color: 'var(--danger)' }}>
          MapLead Workspace
        </div>
        <h1>Desktop bridge failed to load</h1>
        <p>
          Fully quit the app, then run <code>npm run dev</code> again from{" "}
          <code>lead-workspace</code>.
        </p>
      </div>
    </div>
  );
}

function Root() {
  const [bridge, setBridge] = useState(() => typeof window.maplead !== 'undefined');

  // Preload should be ready before React, but retry briefly in case of race
  useEffect(() => {
    if (bridge || !isElectron) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (typeof window.maplead !== 'undefined') {
        setBridge(true);
        window.clearInterval(id);
      } else if (n >= 20) {
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [bridge]);

  if (!isElectron) return <BrowserOnlyScreen />;
  if (!bridge) return <PreloadFailedScreen />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
