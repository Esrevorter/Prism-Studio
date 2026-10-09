import React, { useState } from 'react';
import { useStore } from '../store.js';
import { parseSendIntent } from '../lib/nlp.js';

// §3.2 Wallet & Transactions — "The Signal Flow"
export default function Wallet() {
  const s = useStore();
  const [tab, setTab] = useState('send'); // send | receive | disclosure
  const advanced = s.viewMode === 'advanced';

  return (
    <>
      <div className="pill-row" role="tablist">
        {[
          ['send', 'Send'],
          ['receive', 'Receive'],
          ['disclosure', 'Selective Disclosure'],
        ].map(([id, label]) => (
          <button key={id} className={`pill${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'send' && <SendPanel advanced={advanced} />}
      {tab === 'receive' && <ReceivePanel advanced={advanced} />}
      {tab === 'disclosure' && <DisclosurePanel advanced={advanced} />}

      <div className="card">
        <h2>Recent Activity</h2>
        <ul className="tx-list">
          {s.transactions.slice(0, advanced ? 10 : 4).map((t) => (
            <li key={t.id}>
              <span>{t.label}<br /><span className="muted">{t.ts}</span></span>
              <span className={`tx-amt ${t.direction}`}>
                {t.direction === 'in' ? '+' : '−'}{t.amount} PRSM
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ------------------------------ Send ---------------------------------------
function SendPanel({ advanced }) {
  const s = useStore();
  const [nl, setNl] = useState('');
  const [manual, setManual] = useState({ to: '', amount: '', note: '' });
  const draft = s.sendDraft;

  function parseNl(e) {
    e.preventDefault();
    const intent = parseSendIntent(nl, s.addressBook);
    if (!intent) {
      s.pushNudge({ tone: 'warning', text: 'Could not understand that as a payment. Try: "Send 100 PRSM to Alex for the mix, use standard fee."' });
      return;
    }
    s.setSendDraft(intent);
    if (intent.feeTier) s.setFeeTier(intent.feeTier);
    setNl('');
  }

  function fillManual() {
    if (!manual.to || !manual.amount) return;
    const contact =
      s.addressBook.find((c) => c.name === manual.to) ||
      s.addressBook.find((c) => c.address === manual.to);
    s.setSendDraft({
      raw: `Manual: ${manual.amount} PRSM to ${manual.to}`,
      amount: parseFloat(manual.amount),
      recipient: contact ? contact.name : manual.to,
      recipientAddress: contact ? contact.address : manual.to,
      note: manual.note || null,
      privacy: 'default',
      feeTier: s.feeTier,
    });
  }

  return (
    <div className="grid-2">
      <div className="card">
        <h2>Natural Language Input</h2>
        <p className="muted">Type it like you'd say it. The local AI drafts the transaction for your review.</p>
        <form onSubmit={parseNl}>
          <label className="field">
            <span>Payment intent</span>
            <input
              type="text"
              value={nl}
              onChange={(e) => setNl(e.target.value)}
              placeholder='"Send 100 PRSM to Alex for the mix, keep it private, use standard fee."'
            />
          </label>
          <button className="btn primary" type="submit" disabled={!nl.trim()}>Parse with AI</button>
        </form>

        <h3>Or use the manual form</h3>
        <label className="field">
          <span>To (address book auto-fill)</span>
          <select value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })}>
            <option value="">Select contact…</option>
            {s.addressBook.map((c) => (
              <option key={c.name} value={c.name}>{c.name} {c.verifiedMerchant ? '✓ merchant' : ''}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Amount (PRSM)</span>
          <input type="number" min="0" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
        </label>
        {advanced && (
          <label className="field">
            <span>Note / memo</span>
            <input type="text" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} />
          </label>
        )}
        <button className="btn" onClick={fillManual} disabled={!manual.to || !manual.amount}>
          Build draft
        </button>
      </div>

      <div className="card">
        <h2>Review &amp; Sign</h2>
        {!draft ? (
          <p className="muted">No draft yet. Parse a sentence or fill the manual form.</p>
        ) : (
          <>
            <dl className="kv">
              <dt>Plain-English summary</dt>
              <dd>
                Sending <strong>{draft.amount} PRSM</strong> to <strong>{draft.recipient}</strong>.{' '}
                Fee: ${({ slow: 0.0005, standard: 0.001, fast: 0.004 })[s.feeTier].toFixed(3)}.{' '}
                Privacy: {s.privacyRingSize >= 16 ? 'High' : 'Medium'}.
              </dd>
              {draft.note && (<><dt>Memo</dt><dd>{draft.note}</dd></>)}
              {draft.recipientAddress
                ? (<><dt>Address</dt><dd>{draft.recipientAddress}</dd></>)
                : (<><dt>Address</dt><dd style={{ color: 'var(--danger)' }}>⚠️ Not found in address book</dd></>)}
            </dl>

            <h3>Privacy Slider (RingCT ring size)</h3>
            <input
              type="range" min="5" max="32" step="1"
              value={s.privacyRingSize}
              onChange={(e) => s.setPrivacyRingSize(Number(e.target.value))}
              aria-label="Ring size"
            />
            <div className="muted">
              Ring size {s.privacyRingSize} — {s.privacyRingSize <= 8
                ? 'lower fee, less anonymity'
                : s.privacyRingSize <= 16
                  ? 'recommended balance'
                  : 'maximum anonymity, slightly higher fee'}
            </div>

            <h3>Fee tier</h3>
            <div className="pill-row">
              {['slow', 'standard', 'fast'].map((t) => (
                <button key={t} className={`pill${s.feeTier === t ? ' active' : ''}`} onClick={() => s.setFeeTier(t)}>
                  {t}
                </button>
              ))}
            </div>

            <h3>Pre-Flight Simulator</h3>
            {!s.preflight ? (
              <button className="btn" onClick={s.runPreflight}>Simulate before signing</button>
            ) : (
              <div className={`preflight ${s.preflight.ok ? 'ok' : 'bad'}`}>
                {s.preflight.lines.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}

            {/* Forgiving by Design (§2.1): plain-English confirm, biometric sign */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="btn primary"
                disabled={!s.preflight?.ok}
                onClick={() => { s.simulateBiometric(); s.confirmSend(); }}
              >
                Confirm &amp; Sign {s.biometricUnlocked ? '(TouchID ✓)' : '(via TouchID)'}
              </button>
              <button className="btn danger ghost" onClick={() => useStore.setState({ sendDraft: null, preflight: null })}>
                Discard draft
              </button>
            </div>
            {!s.preflight && (
              <p className="muted" style={{ marginTop: 8 }}>Run the simulator first — we never sign blind.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------ Receive ------------------------------------
function ReceivePanel({ advanced }) {
  const s = useStore();
  const [stealth, setStealth] = useState('prsm1st3alth...' + Math.random().toString(36).slice(2, 8));
  return (
    <div className="grid-2">
      <div className="card">
        <h2>Standard Receive</h2>
        <p className="muted">A fresh one-time stealth address is generated for every request — your public identity never appears on-chain.</p>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 12 }}>
          <div className="qr" role="img" aria-label="QR code" />
          <div>
            <div className="mono" style={{ fontSize: 14, color: 'var(--text)' }}>{stealth}</div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setStealth('prsm1st3alth...' + Math.random().toString(36).slice(2, 8))}>
              Generate new address
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Sharing options</h2>
        {advanced ? (
          <dl className="kv">
            <dt>Label this request</dt><dd>Invoice #4821 (optional)</dd>
            <dt>Request amount</dt><dd>— (leave empty to accept any)</dd>
            <dt>Expiry</dt><dd>7 days (auto-rotate after)</dd>
            <dt>Embed message</dt><dd>"Thanks for the session!"</dd>
          </dl>
        ) : (
          <p className="muted">Switch to Advanced view to attach an amount, expiry, or a message to your receive request.</p>
        )}
      </div>
    </div>
  );
}

// ------------------------ Selective Disclosure -------------------------------
function DisclosurePanel({ advanced }) {
  const s = useStore();
  const [proofState, setProofState] = useState(null); // null | 'generating' | doneKey

  function generate(kind) {
    setProofState(kind);
    // Mock ZKP generation; spec open question #2 targets < 5 seconds.
    setTimeout(() => setProofState(kind + ':done'), 2500);
  }

  const proofs = [
    { id: 'balance', title: 'Balance Proof', desc: '"Prove my balance is > 10,000 PRSM" (collateral).' },
    { id: 'origin', title: 'Source-of-Funds Proof', desc: '"Prove these funds did not originate from Mixer X" (compliance).' },
    { id: 'tax', title: 'Tax Report Proof', desc: 'ZK-verifiable yearly fiat-equivalent flows — no addresses or net worth revealed (Journey 3).' },
  ];

  return (
    <div className="grid-2">
      <div className="card">
        <h2>Generate Proofs</h2>
        <p className="muted">Zero-knowledge proofs verify facts about your wallet without revealing anything else.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {proofs.map((p) => (
            <div key={p.id} className="card" style={{ padding: 12 }}>
              <strong>{p.title}</strong>
              <div className="muted">{p.desc}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn" onClick={() => generate(p.id)} disabled={proofState === p.id}>
                  {proofState === p.id ? 'Generating… (arkworks, target <5s)' : 'Generate proof'}
                </button>
                {proofState === p.id + ':done' && (
                  <span>
                    <span className="badge ok">zk-proof-{p.id}.json ready</span>{' '}
                    <button className="btn ghost" onClick={() => s.pushNudge({ tone: 'gentle', text: `Exported zk-proof-${p.id}.json — shareable via secure link.` })}>
                      Export PDF/JSON
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Auditor View-Key</h2>
        <p className="muted">Issue a time-bound, read-only view key so a tax accountant can decode your incoming flows.</p>
        {advanced ? (
          <>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Scope</dt><dd>Incoming transactions only</dd>
              <dt>Valid for</dt><dd>90 days</dd>
              <dt>Revocable</dt><dd>Yes — instantly, from this screen</dd>
            </dl>
            <button className="btn primary" style={{ marginTop: 10 }}
              onClick={() => s.pushNudge({ tone: 'gentle', text: 'View key VK-a7f3… issued (expires in 90 days). Revocable anytime.' })}>
              Issue view key
            </button>
          </>
        ) : (
          <button className="btn primary" style={{ marginTop: 10 }}
            onClick={() => s.pushNudge({ tone: 'gentle', text: 'View key issued for 90 days. Switch to Advanced to adjust scope.' })}>
            Issue 90-day view key
          </button>
        )}
      </div>
    </div>
  );
}
