import React, { useState } from 'react';
import { useStore } from '../store.js';

// §3.5 Security & Recovery — "The Backup Tape"
export default function Security() {
  const s = useStore();
  const [step, setStep] = useState(1); // MPC wizard step 1..3
  const [contactName, setContactName] = useState('');
  const advanced = s.viewMode === 'advanced';

  const shardsOk = s.mpc.shardsCreated >= s.mpc.threshold;

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>MPC Setup Wizard</h2>
          <p className="muted">
            Step-by-step: split your private key into {s.mpc.shardsTotal} shards. The key never
            exists whole on any single device again.
          </p>

          {/* Progress rail */}
          <div className="pill-row" style={{ margin: '14px 0' }}>
            {['Split key', 'Distribute shards', 'Verify recovery'].map((label, i) => (
              <button
                key={label}
                className={`pill${step === i + 1 ? ' active' : ''}`}
                onClick={() => setStep(i + 1)}
              >
                {i + 1}. {label}
              </button>
            ))}
          </div>

          {step === 1 && (
            <>
              <dl className="kv">
                <dt>Shard scheme</dt><dd>{s.mpc.threshold}-of-{s.mpc.shardsTotal} (adjustable in Advanced)</dd>
                <dt>Generated so far</dt><dd>{s.mpc.shardsCreated}/{s.mpc.shardsTotal}</dd>
              </dl>
              {advanced && (
                <label className="field" style={{ marginTop: 10 }}>
                  <span>Threshold</span>
                  <select
                    value={s.mpc.threshold}
                    onChange={(e) => useStore.setState((st) => ({ mpc: { ...st.mpc, threshold: Number(e.target.value) } }))}
                  >
                    {[3, 4, 5].map((t) => <option key={t} value={t}>{t}-of-{s.mpc.shardsTotal}</option>)}
                  </select>
                </label>
              )}
              <button className="btn primary" onClick={s.createShard} disabled={s.mpc.shardsCreated >= s.mpc.shardsTotal}>
                Generate shard {s.mpc.shardsCreated + 1 <= s.mpc.shardsTotal ? `#${s.mpc.shardsCreated + 1}` : ''}
              </button>
              {s.mpc.shardsCreated >= s.mpc.shardsTotal && (
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => setStep(2)}>Next →</button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h3>Social Recovery — invite trusted contacts</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" placeholder="Trusted contact name (e.g. Maya)"
                  value={contactName} onChange={(e) => setContactName(e.target.value)}
                />
                <button className="btn" onClick={() => { s.inviteContact(contactName.trim()); setContactName(''); }} disabled={!contactName.trim()}>
                  Invite (encrypted QR / secure link)
                </button>
              </div>
              <ul className="tx-list" style={{ marginTop: 10 }}>
                {s.mpc.contacts.map((c) => (
                  <li key={c.name}>
                    <span>{c.name}</span>
                    <span>
                      {c.holdsShard
                        ? <span className="badge ok">holds shard ✓</span>
                        : <button className="btn ghost" onClick={() => s.assignShardToContact(c.name)}>Send shard</button>}
                    </span>
                  </li>
                ))}
                {s.mpc.contacts.length === 0 && <li className="muted">No contacts yet.</li>}
              </ul>
              <button className="btn" style={{ marginTop: 10 }} onClick={() => setStep(3)}>Next →</button>
            </>
          )}

          {step === 3 && (
            <>
              <h3>Recovery threshold visualization</h3>
              <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
                {Array.from({ length: s.mpc.shardsTotal }).map((_, i) => (
                  <div
                    key={i}
                    title={`Shard ${i + 1}`}
                    style={{
                      width: 42, height: 56, borderRadius: 8,
                      border: `2px solid ${i < s.mpc.shardsCreated ? 'var(--ok)' : 'var(--border)'}`,
                      background: i < s.mpc.shardsCreated ? 'rgba(76,175,125,0.15)' : 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: i < s.mpc.shardsCreated ? 'var(--ok)' : 'var(--text-dim)',
                    }}
                  >{i + 1}</div>
                ))}
              </div>
              <p className={shardsOk ? 'muted' : ''} style={{ color: shardsOk ? undefined : 'var(--warn)' }}>
                Need <strong>{s.mpc.threshold} of {s.mpc.shardsTotal}</strong> to recover —{' '}
                {shardsOk ? `${s.mpc.shardsCreated} shard(s) distributed. You are protected.` : 'not enough shards distributed yet.'}
              </p>
              <button
                className="btn primary" disabled={!shardsOk}
                onClick={() => s.pushNudge({ tone: 'gentle', text: 'Recovery dry-run passed: simulated quorum restore verified against the network. ✅' })}
              >
                Run recovery dry-rehearsal
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h2>Biometric Gate</h2>
          <p className="muted">
            Unlock the wallet for transactions with OS-level FaceID/TouchID — no password typing,
            less friction, same security floor.
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={s.simulateBiometric}>
              🔒 Authenticate via TouchID (demo)
            </button>
            <span style={{ marginLeft: 12 }}>
              {s.biometricUnlocked
                ? <span className="badge ok">Unlocked for 4s — signing window open</span>
                : <span className="badge">Locked</span>}
            </span>
          </div>

          {advanced && (
            <>
              <h3>Advanced security settings</h3>
              <dl className="kv">
                <dt>Signing window</dt><dd>4 seconds after biometric unlock</dd>
                <dt>Max tx size w/o password</dt><dd>500 PRSM</dd>
                <dt>Anti-phishing passphrase</dt><dd>Set ✓ (shown on receive screen)</dd>
                <dt>Scam DB freshness</dt><dd>Synced 2 hours ago (12,400 entries)</dd>
              </dl>
            </>
          )}

          <h3>Forgiving by Design (§2.1)</h3>
          <p className="muted">
            Every irreversible action here offers a plain-English confirmation and, where
            technically feasible, a 10-minute <em>Delay &amp; Undo</em> broadcast window.
          </p>
        </div>
      </div>
    </>
  );
}
