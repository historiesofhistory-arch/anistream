import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// ── Scroll restoration ────────────────────────────────────────────────────────
// Disable the browser's automatic scroll restoration so we can handle it
// ourselves in App.tsx. Without this, the browser tries to scroll to the
// previous page's position the moment the URL changes — which races with
// framer-motion's exit animation and produces a visible "scroll jump"
// glitch on the new page (especially noticeable when navigating away from
// a long search-results list).
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

createRoot(document.getElementById('root')!).render(<App />);
