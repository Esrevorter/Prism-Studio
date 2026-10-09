# Prism Studio (Prototype)

Interactive front-end prototype for **Prism Studio**, the desktop GUI client for the
Prism (PRSM) network, implemented from [`spec.md`](./spec.md).

## What's implemented (mapped to the spec)

| Spec section | Where | Notes |
|---|---|---|
| §2.1 Progressive Disclosure | Topbar **Simple / Advanced** toggle | One toggle, not buried in menus; hides/shows power detail across all modules |
| §2.1 Forgiving by Design | Wallet → Send, Security | Plain-English confirmations, discard-draft, recovery dry-rehearsal |
| §2.2 Neuro-inclusive UI | `src/styles/theme.css` | Muted dark palette, high contrast, tabular numerals, no flashy animation; gentle non-modal nudges (`NudgeTray`) |
| §2.2 Focus Modes | Sidebar → 🎧 Focus Mode | Collapses the app to a single Send / Receive / Ask AI Action Bar |
| §3.1 Dashboard "Mix Console" | `components/Dashboard.jsx` | Balance (available/pending/locked), Quick Actions, Network Health, AI Daily Briefing |
| §3.2 Wallet — Send | `components/Wallet.jsx` | Natural-language parsing (`lib/nlp.js`), manual form w/ address-book auto-fill, RingCT privacy slider (default 16), fee tiers, Pre-Flight Simulator |
| §3.2 Wallet — Receive & Selective Disclosure | `components/Wallet.jsx` | One-time stealth address + QR, balance/source-of-funds/tax ZKP proofs (mock arkworks timing), time-bound auditor view key |
| §3.3 Mining "Engine Room" | `components/Mining.jsx` | Thread allocator slider, DAW-Throttle Mode (drops to 10% threads on simulated audio load — Journey 2), thermal auto-throttle, pool management + yield estimate |
| §3.4 AI Co-Pilot | `components/Assistant.jsx` | Chat with deterministic mock of the local llama.cpp tool-calling layer, Autonomous Agents dashboard (DCA/Yield, pause instantly, dry-run previews), Security Guardian clipboard scam-scan |
| §3.5 Security "Backup Tape" | `components/Security.jsx` | MPC wizard (3-of-5 shards), social recovery contacts + threshold visualization, biometric gate demo |
| §5 Journeys 1–3 | Ask-AI bar → Wallet; Mining sim; Disclosure proofs | Try: type `Pay Sarah 200 PRSM for the vocal edit. Use the standard privacy settings.` in the top bar |

## Stack

React 18 + Zustand (per spec §4) with Vite. The whole state layer is mocked in
`src/store.js`; in production these actions route through the Tauri Rust core to
libprism / llama.cpp / arkworks. The frontend is kept framework-compatible so it
can be wrapped by Tauri without changes.

## Run

```bash
npm install
npm run dev      # http://localhost:1420
npm run build    # production bundle in dist/
```

## Known gaps / next steps

- Real Tauri shell + Rust sidecar (`libprism`, `llama.cpp` bindings) — this prototype mocks that boundary.
- Actual GGUF model inference behind `coPilotReply()` and JSON-schema tool calling.
- OS-level process detection for DAW-Throttle (spec open question #3); currently simulated via a demo button + random ticks.
- Real ZKP circuits for selective disclosure (open question #2) and MPC shard generation (currently UI flow only).
- Radix UI primitives for full keyboard/screen-reader dialogs; current markup uses semantic HTML + ARIA basics.
