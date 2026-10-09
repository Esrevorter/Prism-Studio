// ---------------------------------------------------------------------------
// Prism Studio — Backend abstraction layer (spec §4: "Tauri Shell + Rust Core")
//
// Every call that will eventually route to the Rust core (libprism, llama.cpp,
// arkworks ZKP circuits, OS telemetry) goes through this module. The frontend
// never talks to a backend directly; it only knows about `backend`, which:
//
//   1. In production (inside Tauri): uses `invoke()` from @tauri-apps/api/core
//      to call the Rust commands declared in src-tauri/src/lib.rs.
//   2. In the browser prototype: falls back to deterministic JS mocks that
//      mirror the exact same command names and result shapes as the Rust side,
//      so UI behavior is identical across both runtimes.
//
// The command table below is the single source of truth shared with the Rust
// crate — keep src-tauri/src/lib.rs and COMMANDS in sync.
// ---------------------------------------------------------------------------

export const IS_TAURI =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Command names must match #[tauri::command] fn names in the Rust core.
export const COMMANDS = [
  'wallet_balance',        // -> { available, pending, lockedStaking }
  'network_health',        // -> { synced, blockHeight, difficulty, peers, nodeVersion }
  'parse_send_intent',     // (text) -> intent | null            [llama.cpp tool-call]
  'copilot_reply',         // (question, ctx) -> string          [llama.cpp]
  'preflight_simulate',    // (draft, ringSize, feeTier) -> checks
  'sign_and_broadcast',    // (draft, authSession) -> txId       [libprism RingCT sign]
  'generate_stealth_address', // -> one-time subaddress + QR payload
  'generate_zkp_proof',    // (kind, params) -> proof bundle     [arkworks groth16]
  'generate_view_key',     // (validUntilIso) -> time-bound view key
  'mining_telemetry',      // -> threads/temp/hashrate/DAW signal [sysinfo + DAW detect]
  'mpc_dealer_split',      // (threshold, total) -> shard commitments [GG20]
  'biometric_auth',        // -> auth session id                 [OS biometrics]
  'clipboard_scan',        // (text) -> scam verdict             [local denylist]
];

// ---- Browser mock implementations -----------------------------------------
// These intentionally replicate the Rust logic in
// src-tauri/src/commands/*.rs so results are consistent. Deterministic where
// possible (seeded PRNG) so demos are reproducible.

let seed = 1337;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const b58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (n) => Array.from({ length: n }, () => b58chars[Math.floor(rnd() * b58chars.length)]).join('');

const mocks = {
  wallet_balance: () => ({ available: 12480.5, pending: 320.0, lockedStaking: 5000.0 }),

  network_health: () => ({
    synced: true,
    blockHeight: 841233 + Math.floor(rnd() * 4),
    difficulty: '2.41 GH/s',
    peers: 24,
    nodeVersion: 'libprism 0.9.2',
  }),

  // Mirrors parseSendIntent() in lib/nlp.js and the Rust port's regex path.
  parse_send_intent: ({ text }, ctx) => ctx?.parseSend?.(text) ?? null,

  copilot_reply: ({ question, ctx }) => ctx?.copilotReply?.(question, ctx) ?? '',

  preflight_simulate: ({ draft, ringSize, feeTier }) => {
    const feeUsd = { slow: 0.0005, standard: 0.001, fast: 0.004 }[feeTier] ?? 0.001;
    const clean = !/mixer/i.test(draft.note || '');
    return {
      ok: clean && !!draft.recipientAddress,
      feeUsd,
      lines: [
        clean ? '✅ Funds are clean.' : '⚠️ Selected outputs may be linked to a flagged source.',
        draft.recipientAddress
          ? `✅ Recipient address verified (${draft.recipient}).`
          : '❌ Recipient not found in your address book.',
        `ℹ️ Fee is $${feeUsd.toFixed(3)} (${feeTier}).`,
        `ℹ️ Privacy: ring size ${ringSize} (${ringSize >= 16 ? 'High' : 'Medium'}).`,
      ],
    };
  },

  sign_and_broadcast: ({ draft }) => ({
    txId: `tx_${b58(24)}`,
    amount: draft.amount,
    recipient: draft.recipient,
    broadcastAt: new Date().toISOString(),
  }),

  generate_stealth_address: () => ({
    stealth: `prsm1one${b58(34)}`,
    qrPayload: `prsm:prsm1one${b58(34)}?memo=one-time`,
    expiresInSeconds: 900,
  }),

  // Mock of arkworks groth16 proving. Timing numbers answer spec open
  // question #2: on this prototype the "circuit" is simulated; the Rust core
  // runs the real circuit with a stop-watch and reports ms honestly.
  generate_zkp_proof: async ({ kind }) => {
    const ms = { balance: 1840, source_of_funds: 2610, tax_report: 4230 }[kind] ?? 2000;
    await new Promise((r) => setTimeout(r, Math.min(ms, 1200))); // demo-friendly cap
    return {
      kind,
      proof: `0x${Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')}`,
      publicInputsHash: `0x${Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')}`,
      verifyKey: `prsmvk_${b58(16)}`,
      generatedMs: ms,
      circuit: { balance: 'balance_gt.vkey', source_of_funds: 'provenance_set.vkey', tax_report: 'annual_flow.vkey' }[kind],
    };
  },

  generate_view_key: ({ validUntilIso }) => ({
    viewKey: `VIEWSK:${b58(40)}`,
    validUntil: validUntilIso,
    scope: 'read-only',
    note: 'Time-bound, read-only. Expired keys reveal nothing after their window.',
  }),

  mpc_dealer_split: ({ threshold, total }) => ({
    threshold,
    total,
    commitments: Array.from({ length: total }, (_, i) => ({
      shardIndex: i + 1,
      commitment: `C_${b58(20)}`,
    })),
    algorithm: 'GG20 (mock)',
  }),

  biometric_auth: () => ({ sessionId: `bio_${b58(12)}`, method: 'Platform biometrics', expiresInSec: 30 }),

  clipboard_scan: ({ text }) => {
    const scammy = /scam|fraud|phish/i.test(text) || text.includes('prsm1BAD');
    return { scam: scammy, matchedEntry: scammy ? 'denylist#4411 (fake-airdrop farm)' : null };
  },
};

// ---- Public API -------------------------------------------------------------
async function invokeTauri(cmd, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
}

export const backend = {
  mode: IS_TAURI ? 'tauri' : 'browser-mock',
  async call(cmd, args = {}, mockCtx = null) {
    if (IS_TAURI) return invokeTauri(cmd, args);
    if (!(cmd in mocks)) throw new Error(`Unknown backend command: ${cmd}`);
    // tiny latency so loading states behave like a real IPC boundary
    await new Promise((r) => setTimeout(r, 40 + rnd() * 80));
    return mocks[cmd](args, mockCtx);
  },
};
