import React, { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { parseSendIntent } from './lib/nlp.js';
import Dashboard from './components/Dashboard.jsx';
import Wallet from './components/Wallet.jsx';
import Mining from './components/Mining.jsx';
import Assistant from './components/Assistant.jsx';
import Security from './components/Security.jsx';
import NudgeTray from './components/NudgeTray.jsx';

const MODULES = [
  { id: 'dashboard', label: 'Dashboard', sub: 'Mix Console' },
  { id: 'wallet', label: 'Wallet', sub: 'Signal Flow' },
  { id: 'mining', label: 'Mining', sub: 'Engine Room' },
  { id: 'assistant', label: 'AI Co-Pilot', sub: 'Assistant' },
  { id: 'security', label: 'Security', sub: 'Backup Tape' },
];

export default function App() {
  const s = useStore();
  const [ask, setAsk] = useState('');

  // Simulated OS/system ticks for the mining engine (Journey 2 demo).
  useEffect(() => {
    const t = setInterval(() => useStore.getState().simulateTick(), 1500);
    return () => clearInterval(t);
  }, []);

  function handleAsk(e) {
    e.preventDefault();
    if (!ask.trim()) return;
    const intent = parseSendIntent(ask, s.addressBook);
    if (intent) {
      // Journey 1: Ask AI bar → parsed draft → pre-flight preview.
      s.setSendDraft(intent);
      if (intent.feeTier) s.setFeeTier(intent.feeTier);
      if (intent.privacy === 'high') s.setPrivacyRingSize(16);
      if (intent.privacy === 'low') s.setPrivacyRingSize(5);
      s.setActiveModule('wallet');
      s.pushNudge({ tone: 'gentle', text: 'Draft payment ready for review in Wallet.' });
    } else {
      s.pushChat({ role: 'user', text: ask });
      s.setActiveModule('assistant');
    }
    setAsk('');
  }

  // ---- Focus Mode (§2.2): collapse everything into a single Action Bar ----
  if (s.focusMode) {
    return (
      <div className="app-shell focus">
        <div className="main">
          <div className="topbar">
            <strong>Prism Studio — Focus Mode</strong>
            <div className="spacer" />
            <button className="btn ghost" onClick={s.toggleFocusMode}>Exit Focus Mode</button>
          </div>
          <div className="content">
            <div className="action-bar">
              <button className="btn primary quick" onClick={() => { s.setActiveModule('wallet'); }}>➜ Send</button>
              <button className="btn quick" onClick={() => { s.setActiveModule('wallet'); }}>⇦ Receive</button>
              <button className="btn quick" onClick={() => { s.setActiveModule('assistant'); }}>✦ Ask AI</button>
            </div>
            <p className="muted" style={{ textAlign: 'center' }}>
              Non-essential UI is hidden to protect your flow. Balance: {s.balance.available} PRSM available.
            </p>
          </div>
          <NudgeTray />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Modules">
        <div className="brand">
          <svg className="prism-mark" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="12,2 22,20 2,20" fill="none" stroke="#7c6cf0" strokeWidth="2" />
          </svg>
          Prism Studio
        </div>
        {MODULES.map((m) => (
          <button
            key={m.id}
            className={`nav-item${s.activeModule === m.id ? ' active' : ''}`}
            onClick={() => s.setActiveModule(m.id)}
          >
            <span>{m.label}</span>
            {s.viewMode === 'advanced' && (
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>{m.sub}</span>
            )}
          </button>
        ))}
        <div className="sidebar-footer">
          <button className="btn ghost" onClick={s.toggleFocusMode}>🎧 Focus Mode</button>
          <div>
            Node: {s.network.synced ? 'Synced' : 'Syncing'} · #{s.network.blockHeight.toLocaleString()}
          </div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <form onSubmit={handleAsk} style={{ flex: 1, display: 'flex' }}>
            <input
              className="ask-bar"
              placeholder='Ask AI or type a payment: "Pay Sarah 200 PRSM for the vocal edit"'
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              aria-label="Ask AI"
            />
          </form>
          <div className="spacer" />
          {/* Progressive Disclosure toggle (§2.1) — one toggle, not buried in menus */}
          <div className="pill-row" role="group" aria-label="View mode">
            <button
              className={`pill${s.viewMode === 'simple' ? ' active' : ''}`}
              onClick={() => s.viewMode !== 'simple' && s.toggleViewMode()}
            >Simple</button>
            <button
              className={`pill${s.viewMode === 'advanced' ? ' active' : ''}`}
              onClick={() => s.viewMode !== 'advanced' && s.toggleViewMode()}
            >Advanced</button>
          </div>
        </header>

        <main className="content">
          {s.activeModule === 'dashboard' && <Dashboard />}
          {s.activeModule === 'wallet' && <Wallet />}
          {s.activeModule === 'mining' && <Mining />}
          {s.activeModule === 'assistant' && <Assistant />}
          {s.activeModule === 'security' && <Security />}
        </main>

        <footer className="statusbar">
          <span>PRSM ≈ $2.15</span>
          <span>Difficulty: {s.network.difficulty}</span>
          <span>Peers: {s.network.peers}</span>
          <span className="spacer" />
          <span>{s.network.nodeVersion} (mock core)</span>
        </footer>
      </div>

      <NudgeTray />
    </div>
  );
}
