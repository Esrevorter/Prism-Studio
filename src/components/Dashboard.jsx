import React from 'react';
import { useStore } from '../store.js';

// §3.1 Dashboard — "The Mix Console"
export default function Dashboard() {
  const s = useStore();
  const advanced = s.viewMode === 'advanced';

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Total Balance</h2>
          <div className="big-number ticker">{s.balance.available.toLocaleString()} PRSM</div>
          <div className="muted">≈ ${(s.balance.available * 2.15).toLocaleString()} available</div>
          {advanced && (
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Pending</dt><dd>{s.balance.pending} PRSM</dd>
              <dt>Locked (staking/pool)</dt><dd>{s.balance.lockedStaking.toLocaleString()} PRSM</dd>
              <dt>Net worth (incl. locked)</dt>
              <dd>{(s.balance.available + s.balance.pending + s.balance.lockedStaking).toLocaleString()} PRSM</dd>
            </dl>
          )}
        </div>

        <div className="card">
          <h2>AI Daily Briefing</h2>
          <p style={{ margin: '6px 0 0' }}>{s.dailyBriefing}</p>
          {advanced && (
            <p className="muted">
              Generated locally by the Co-Pilot from your last 24h of decoded transactions. No data leaves this machine.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Quick Actions</h2>
        <div className="grid-3" style={{ marginTop: 10 }}>
          <button className="btn primary quick" onClick={() => s.setActiveModule('wallet')}>
            ➜ Send<span className="muted">Pay someone in plain English</span>
          </button>
          <button className="btn quick" onClick={() => s.setActiveModule('wallet')}>
            ⇦ Receive<span className="muted">One-time stealth address</span>
          </button>
          <button className="btn quick" onClick={() => s.setActiveModule('assistant')}>
            ✦ Ask AI<span className="muted">Local model, zero data leakage</span>
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Network Health</h2>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Sync status</dt>
            <dd><span className={`badge ${s.network.synced ? 'ok' : 'warn'}`}>{s.network.synced ? 'Synced' : 'Syncing'}</span></dd>
            <dt>Block height</dt><dd>#{s.network.blockHeight.toLocaleString()}</dd>
            <dt>Difficulty</dt><dd>{s.network.difficulty}</dd>
            {advanced && (
              <>
                <dt>Peers</dt><dd>{s.network.peers}</dd>
                <dt>Node</dt><dd>{s.network.nodeVersion}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="card">
          <h2>Engine Room (at a glance)</h2>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Mining</dt>
            <dd>
              <span className={`badge ${s.mining.running ? 'ok' : ''}`}>
                {s.mining.running ? `${s.mining.hashrate} · ${s.mining.allocatedThreads}/${s.mining.maxThreads} threads` : 'Paused'}
              </span>
            </dd>
            <dt>DAW-Throttle</dt>
            <dd>{s.mining.dawActive ? <span className="badge warn">Engaged (audio work detected)</span> : <span className="badge ok">Standby</span>}</dd>
            <dt>CPU temp</dt>
            <dd>{s.mining.cpuTempC}°C{s.mining.thermalThrottle ? ' ⚠ throttling' : ''}</dd>
            {advanced && (
              <>
                <dt>Est. daily yield</dt><dd>{s.mining.estDailyYield} PRSM</dd>
                <dt>Pool</dt><dd>{s.mining.pool}</dd>
              </>
            )}
          </dl>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => s.setActiveModule('mining')}>
            Open Engine Room →
          </button>
        </div>
      </div>
    </>
  );
}
