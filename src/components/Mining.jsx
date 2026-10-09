import React from 'react';
import { useStore } from '../store.js';

// §3.3 Mining — "The Engine Room" (RandomX CPU miner, DAW-aware)
export default function Mining() {
  const s = useStore();
  const m = s.mining;
  const advanced = s.viewMode === 'advanced';

  const tempClass = m.cpuTempC > 80 ? 'crit' : m.cpuTempC > 72 ? 'hot' : '';

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>Engine Status</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0' }}>
            <span className={`badge ${m.running ? 'ok' : 'danger'}`}>{m.running ? 'Mining' : 'Paused'}</span>
            {m.dawActive && <span className="badge warn">DAW-Throttle engaged → audio priority</span>}
            {m.thermalThrottle && <span className="badge danger">Thermal throttle</span>}
          </div>
          <dl className="kv">
            <dt>Hashrate</dt><dd>{m.hashrate} (RandomX)</dd>
            <dt>Intensity</dt><dd>{m.intensity}%</dd>
            <dt>Est. daily yield</dt><dd>{m.estDailyYield} PRSM ≈ ${(m.estDailyYield * 2.15).toFixed(2)}</dd>
            {advanced && (
              <>
                <dt>Pool</dt><dd>{m.pool}</dd>
                <dt>Block height</dt><dd>#{s.network.blockHeight.toLocaleString()}</dd>
              </>
            )}
          </dl>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              className={m.running ? 'btn danger' : 'btn primary'}
              onClick={() => s.setMiningField({ running: !m.running })}
            >
              {m.running ? 'Pause engine' : 'Start engine'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Thread Allocator</h2>
          <p className="muted">Visual slider to allocate CPU threads ({m.maxThreads} logical cores detected).</p>
          <input
            type="range" min="0" max={m.maxThreads} step="1"
            value={m.allocatedThreads}
            onChange={(e) => s.allocateThreads(Number(e.target.value))}
            disabled={!m.running || m.dawActive}
            aria-label="CPU threads for mining"
          />
          <div className="meter" style={{ marginTop: 8 }}>
            <div style={{ width: `${(m.allocatedThreads / m.maxThreads) * 100}%` }} />
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {m.allocatedThreads}/{m.maxThreads} threads ·{' '}
            {m.dawActive ? 'Slider locked while DAW-Throttle is active (Journey 2).' : 'Manual control active.'}
          </div>

          <h3>Thermal Management</h3>
          <div className="kv"><dt>CPU temperature</dt><dd>{m.cpuTempC}°C</dd></div>
          <div className={`meter ${tempClass}`} style={{ marginTop: 6 }}>
            <div style={{ width: `${Math.min(100, (m.cpuTempC / 95) * 100)}%` }} />
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Auto-throttles above 80°C to protect hardware.
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>DAW-Throttle Mode</h2>
          <p className="muted">
            Instantly drops mining intensity to 10% when a high-priority audio application
            (Ableton, Pro Tools, FL Studio…) is detected under heavy load — zero dropouts,
            zero latency spikes. Scales back up smoothly when the session ends.
          </p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={m.dawThrottle}
              onChange={(e) => s.setMiningField({ dawThrottle: e.target.checked })}
            />
            <strong>Enable DAW-Throttle (recommended for producers)</strong>
          </label>
          {/* Demo hook: simulate the OS-level detection signal (spec open question #3) */}
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => s.setMiningField({ dawActive: !m.dawActive })}
          >
            {m.dawActive ? 'Simulate: render finished' : 'Simulate: heavy audio bounce started'}
          </button>
        </div>

        <div className="card">
          <h2>Pool Management</h2>
          {advanced ? (
            <>
              <label className="field">
                <span>Target</span>
                <select value={m.pool} onChange={(e) => s.setMiningField({ pool: e.target.value })}>
                  <option>prism-pool.eu (public)</option>
                  <option>prism-pool.us-east (public)</option>
                  <option>Solo mining (local node)</option>
                </select>
              </label>
              <dl className="kv">
                <dt>Payout scheme</dt><dd>FPS (full privacy sync)</dd>
                <dt>Fee</dt><dd>0.9%</dd>
                <dt>Latency</dt><dd>38 ms</dd>
              </dl>
              <div className="mono" style={{ marginTop: 10 }}>{m.log.join('\n') || 'engine log will stream here…'}</div>
            </>
          ) : (
            <p className="muted">
              Connected to <strong>{m.pool}</strong>. Switch to Advanced view to change pools,
              review payout schemes, or go solo.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
