// ---------------------------------------------------------------------------
// Prism Studio — global store (Zustand)
// Spec §4: "State Management: Zustand". All UI state flows through this
// single store so the Simple/Advanced toggle and Focus Mode can
// progressively disclose detail. Backend calls are mocked here; in
// production they route through the Tauri Rust core to libprism (§4).
// ---------------------------------------------------------------------------
import { create } from 'zustand';

const PRSM_USD = 2.15; // mock fiat rate for previews

export const useStore = create((set, get) => ({
  // ---- Global UX toggles (spec §2.1 Progressive Disclosure, §2.2 Focus Modes)
  viewMode: 'simple',            // 'simple' | 'advanced'
  focusMode: false,              // collapse everything into the Action Bar
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'simple' ? 'advanced' : 'simple' })),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  activeModule: 'dashboard',     // dashboard | wallet | mining | assistant | security
  setActiveModule: (m) => set({ activeModule: m, focusMode: false }),

  // ---- Wallet / network mock data (spec §3.1)
  balance: { available: 12480.5, pending: 320.0, lockedStaking: 5000.0 },
  network: {
    synced: true,
    blockHeight: 841233,
    difficulty: '2.41 GH/s',
    peers: 24,
    nodeVersion: 'libprism 0.9.2',
  },
  dailyBriefing:
    'You received 3 payments yesterday. Your auto-DCA agent bought 50 PRSM this morning.',

  transactions: [
    { id: 'tx-1', direction: 'in',  amount: 500, label: 'Mix work — Jordan (verified merchant)', ts: 'Yesterday 14:02' },
    { id: 'tx-2', direction: 'in',  amount: 120, label: 'Sample pack purchase refund', ts: 'Yesterday 09:41' },
    { id: 'tx-3', direction: 'out', amount: 450, label: 'Sample packs ×4 (verified merchants)', ts: 'Last week' },
    { id: 'tx-4', direction: 'in',  amount: 50,  label: 'DCA Agent buy', ts: 'Today 05:00' },
  ],

  addressBook: [
    { name: 'Sarah', address: 'prsm1s7ara...hx9k', verifiedMerchant: false },
    { name: 'Alex', address: 'prsm1a1ex0...q2qd', verifiedMerchant: false },
    { name: 'Jordan', address: 'prsm1j0rdan...m4vt', verifiedMerchant: true },
    { name: 'Splice Sounds', address: 'prsm1sp1ice...t7fw', verifiedMerchant: true },
  ],

  // ---- Send flow (spec §3.2)
  sendDraft: null,               // parsed natural-language intent
  privacyRingSize: 16,           // RingCT default per spec
  feeTier: 'standard',           // slow | standard | fast
  setPrivacyRingSize: (n) => set({ privacyRingSize: n }),
  setFeeTier: (t) => set({ feeTier: t }),
  setSendDraft: (d) => set({ sendDraft: d }),
  preflight: null,               // result of the Pre-Flight Simulator
  runPreflight: () => {
    const { sendDraft, privacyRingSize, feeTier } = get();
    if (!sendDraft) return null;
    const feeUsd = { slow: 0.0005, standard: 0.001, fast: 0.004 }[feeTier];
    const clean = !/mixer/i.test(sendDraft.note || '');
    const result = {
      ok: clean && !!sendDraft.recipientAddress,
      lines: [
        clean ? '✅ Funds are clean.' : '⚠️ Selected outputs may be linked to a flagged source.',
        sendDraft.recipientAddress
          ? `✅ Recipient address verified (${sendDraft.recipient}).`
          : '❌ Recipient not found in your address book.',
        `ℹ️ Fee is $${feeUsd.toFixed(3)} (${feeTier}).`,
        `ℹ️ Privacy: ring size ${privacyRingSize} (${privacyRingSize >= 16 ? 'High' : 'Medium'}).`,
      ],
      feeUsd,
    };
    set({ preflight: result });
    return result;
  },
  confirmSend: () => {
    const { sendDraft, transactions } = get();
    if (!sendDraft) return;
    set({
      transactions: [
        {
          id: `tx-${Date.now()}`,
          direction: 'out',
          amount: sendDraft.amount,
          label: `${sendDraft.note || 'Payment'} — ${sendDraft.recipient}`,
          ts: 'Just now',
        },
        ...transactions,
      ],
      balance: {
        ...get().balance,
        available: +(get().balance.available - sendDraft.amount).toFixed(2),
      },
      sendDraft: null,
      preflight: null,
    });
    get().pushNudge({ tone: 'gentle', text: 'Payment sent. The recipient has been notified.' });
  },

  // ---- Mining (spec §3.3)
  mining: {
    running: true,
    maxThreads: 12,
    allocatedThreads: 12,
    intensity: 100,              // %
    hashrate: '4.8 kH/s',
    cpuTempC: 61,
    dawThrottle: true,           // auto-throttle when DAW detected
    dawActive: false,            // simulated OS signal
    thermalThrottle: false,
    pool: 'prism-pool.eu (public)',
    estDailyYield: 3.42,         // PRSM
    log: [],
  },
  setMiningField: (patch) => set((s) => ({ mining: { ...s.mining, ...patch } })),
  allocateThreads: (n) => {
    const m = get().mining;
    set({
      mining: {
        ...m,
        allocatedThreads: n,
        intensity: Math.round((n / m.maxThreads) * 100),
        hashrate: `${(n * 0.4).toFixed(1)} kH/s`,
      },
    });
  },
  simulateTick: () => {
    // One second of simulated system state: DAW detection + thermal management.
    const m = get().mining;
    if (!m.running) return;
    let { allocatedThreads, dawActive, cpuTempC, thermalThrottle } = m;

    // Simulate a DAW bounce occasionally spiking the CPU (Journey 2).
    if (m.dawThrottle && !dawActive && Math.random() < 0.08) dawActive = true;
    else if (dawActive && Math.random() < 0.15) dawActive = false;

    if (dawActive) {
      allocatedThreads = Math.max(1, Math.round(m.maxThreads * 0.1)); // 10% per spec
      cpuTempC = Math.max(48, cpuTempC - 2);
    } else {
      if (allocatedThreads === Math.max(1, Math.round(m.maxThreads * 0.1))) {
        allocatedThreads = m.maxThreads; // smoothly scale back up
      }
      cpuTempC = Math.min(84, cpuTempC + (Math.random() < 0.5 ? 1 : -1));
    }
    thermalThrottle = cpuTempC > 80;
    if (thermalThrottle) allocatedThreads = Math.max(1, allocatedThreads - 2);

    set({
      mining: {
        ...m,
        allocatedThreads,
        dawActive,
        cpuTempC,
        thermalThrottle,
        intensity: Math.round((allocatedThreads / m.maxThreads) * 100),
        hashrate: `${(allocatedThreads * 0.4).toFixed(1)} kH/s`,
        log: [
          `height=841233 threads=${allocatedThreads} temp=${cpuTempC}°C`,
          ...m.log,
        ].slice(0, 6),
      },
    });
  },

  // ---- AI Assistant (spec §3.4)
  chat: [
    { role: 'ai', text: 'Local model ready (Mistral-7B via llama.cpp). Nothing leaves this machine.' },
  ],
  pushChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),

  agents: [
    { id: 'dca', name: 'DCA Agent', desc: 'Buys 50 PRSM every Friday at 5 PM.', status: 'running', lastRun: 'Today 05:00 — bought 50 PRSM' },
    { id: 'yield', name: 'Yield Agent', desc: 'Moves idle PRSM to a privacy-preserving liquidity pool.', status: 'paused', lastRun: 'Paused by user' },
  ],
  toggleAgent: (id) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, status: a.status === 'running' ? 'paused' : 'running' } : a
      ),
    })),

  // ---- Security Guardian clipboard watch (spec §3.4)
  clipboardWatch: true,
  scamHit: null,
  scanClipboard: (text) => {
    const scammy = /scam|fraud|phish/i.test(text) || text.includes('prsm1BAD');
    const hit = scammy
      ? '⚠️ This address matches a known scam database entry. Do not send funds.'
      : null;
    set({ scamHit: hit });
    if (hit) get().pushNudge({ tone: 'warning', text: hit });
    return hit;
  },

  // ---- Gentle nudges (spec §2.2 contextual reminders, non-intrusive)
  nudges: [{ id: 1, tone: 'gentle', text: 'Security check: your backup shards have not been verified in 30 days.' }],
  pushNudge: (n) => set((s) => ({ nudges: [...s.nudges, { ...n, id: Date.now() }] })),
  dismissNudge: (id) => set((s) => ({ nudges: s.nudges.filter((n) => n.id !== id) })),

  // ---- Security & Recovery (spec §3.5)
  mpc: { shardsTotal: 5, threshold: 3, shardsCreated: 0, contacts: [] },
  createShard: () =>
    set((s) => ({ mpc: { ...s.mpc, shardsCreated: Math.min(s.mpc.shardsTotal, s.mpc.shardsCreated + 1) } })),
  inviteContact: (name) =>
    set((s) => ({
      mpc: {
        ...s.mpc,
        contacts: s.mpc.contacts.some((c) => c.name === name)
          ? s.mpc.contacts
          : [...s.mpc.contacts, { name, holdsShard: false }],
      },
    })),
  assignShardToContact: (name) =>
    set((s) => ({
      mpc: {
        ...s.mpc,
        shardsCreated: Math.min(s.mpc.shardsTotal, s.mpc.shardsCreated + 1),
        contacts: s.mpc.contacts.map((c) => (c.name === name ? { ...c, holdsShard: true } : c)),
      },
    })),
  biometricUnlocked: false,
  simulateBiometric: () => {
    set({ biometricUnlocked: true });
    setTimeout(() => set({ biometricUnlocked: false }), 4000);
  },

  // helpers
  prsmUsd: (amt) => +(amt * PRSM_USD).toFixed(2),
}));

export { PRSM_USD };
