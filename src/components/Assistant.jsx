import React, { useRef, useState } from 'react';
import { useStore } from '../store.js';
import { coPilotReply, parseSendIntent } from '../lib/nlp.js';

// §3.4 AI Assistant — "The Co-Pilot" (local LLM via llama.cpp)
export default function Assistant() {
  const s = useStore();
  const [q, setQ] = useState('');
  const logRef = useRef(null);
  const advanced = s.viewMode === 'advanced';

  function ask(e) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    // If it's a payment intent, hand off to the wallet draft flow instead.
    const intent = parseSendIntent(text, s.addressBook);
    if (intent) {
      s.pushChat({ role: 'user', text });
      s.pushChat({ role: 'ai', text: `I can do that. I've drafted "Sending ${intent.amount} PRSM to ${intent.recipient}" — review it in Wallet → Send.` });
      s.setSendDraft(intent);
      s.setActiveModule('wallet');
      setQ('');
      return;
    }
    const answer = coPilotReply(text, {
      balance: s.balance, transactions: s.transactions,
      mining: s.mining, agents: s.agents, network: s.network,
    });
    s.pushChat({ role: 'user', text });
    s.pushChat({ role: 'ai', text: answer });
    setQ('');
    setTimeout(() => logRef.current?.scrollTo(0, 1e9), 50);
  }

  return (
    <>
      <div className="card">
        <h2>Chat — local model, zero data leakage</h2>
        <p className="muted">
          Powered by Mistral-7B (GGUF) via llama.cpp on this machine.{advanced ? ' Tool calls are constrained to the wallet RPC JSON schema.' : ''}
        </p>
        <div className="chat-log" ref={logRef}>
          {s.chat.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.text}</div>
          ))}
        </div>
        <form onSubmit={ask} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder='e.g. "How much did I spend on sample packs last month?"'
            aria-label="Ask the Co-Pilot"
          />
          <button className="btn primary" type="submit" disabled={!q.trim()}>Ask</button>
        </form>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Autonomous Agents Dashboard</h2>
          <p className="muted">Scoped agents. Every action requires a dry-run preview and can be paused instantly.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {s.agents.map((a) => (
              <div key={a.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{a.name}</strong>
                  <span className={`badge ${a.status === 'running' ? 'ok' : 'warn'}`}>{a.status}</span>
                </div>
                <div className="muted">{a.desc}</div>
                {advanced && <div className="muted" style={{ marginTop: 4 }}>Last run: {a.lastRun}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn" onClick={() => s.toggleAgent(a.id)}>
                    {a.status === 'running' ? 'Pause now' : 'Resume'}
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => s.pushNudge({ tone: 'gentle', text: `${a.name} dry run: next action simulated against last week's state. No funds moved.` })}
                  >
                    Dry-run preview
                  </button>
                </div>
              </div>
            ))}
            <button className="btn" onClick={() => s.pushNudge({ tone: 'gentle', text: 'New agent wizard: choose a scope (read-only / scheduled send / yield), then approve a dry run before activation.' })}>
              + Create scoped agent
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Security Guardian</h2>
          <p className="muted">
            Passively watches your clipboard and active window. Copy a wallet address anywhere
            and it is checked against known scam databases — locally, instantly.
          </p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '12px 0' }}>
            <input
              type="checkbox" checked={s.clipboardWatch}
              onChange={(e) => useStore.setState({ clipboardWatch: e.target.checked })}
            />
            <strong>Clipboard watch enabled</strong>
          </label>
          <label className="field">
            <span>Simulate a clipboard copy (demo)</span>
            <input
              type="text" id="clip-demo"
              placeholder="Paste an address here to scan it…"
            />
          </label>
          <button
            className="btn"
            onClick={() => {
              const el = document.getElementById('clip-demo');
              const hit = s.scanClipboard(el?.value || '');
              if (!hit) s.pushNudge({ tone: 'gentle', text: 'Clipboard scan: address is clean (checked against 12,400-entry local scam DB).' });
            }}
          >
            Scan clipboard content
          </button>
          {s.scamHit && (
            <div className="preflight bad" style={{ marginTop: 12 }}>
              <div>{s.scamHit}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
