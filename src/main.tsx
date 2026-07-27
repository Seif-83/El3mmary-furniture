import React from 'react';
import {createRoot} from 'react-dom/client';

// Polyfill for crypto.randomUUID in non-secure contexts (e.g. HTTP on local network IP)
if (typeof window !== "undefined" && window.crypto && !window.crypto.randomUUID) {
  Object.defineProperty(window.crypto, 'randomUUID', {
    value: function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    writable: true,
    configurable: true,
  });
}

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
