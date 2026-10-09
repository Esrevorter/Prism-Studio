# Prism ZKP Circuits (arkworks / groth16)

Design for spec §3.4 "Selective Disclosure" and §4 "Cryptographic Primitives".
This directory holds the **circuit specifications** that the Rust core compiles
with `ark-crypto-primitives` + `ark-groth16` once libprism's curve params are
vendored. They are expressed here as Rust snippets + JSON metadata so the UI
(Proof Generator mock in Security.jsx) can already show realistic artifacts,
timings, and verification flows.

## Circuits

### 1. balance_gt — "Prove you have at least X without revealing your balance"
- Public: `commitment` (Pedersen commitment to balance), `threshold`
- Private: `balance`, `blinding_factor`
- Statement: knowledge of opening of `commitment` where `balance ≥ threshold`.
- Used by: merchant checkout ("customer can afford $200"), lending collateral checks.

### 2. provenance_set — "All my incoming funds come from verified sources"
- Public: `tx_merkle_root`, `merchant_pubkey`, `epoch`
- Private: list of `(amount, origin_tag)` openings + per-origin signatures
- Statement: every input in the spend set is signed by a KYC'd counterparty
  (§3.4 "source of all my incoming funds"). Range proofs on amounts keep
  totals hidden.

### 3. annual_flow — "My income this year was between A and B" (tax report)
- Public: `date_range_hash`, `lower`, `upper`, `auditor_pubkey`
- Private: monthly balances + view-key attestations
- Statement: Σ inflows ∈ [lower, upper] over the range, each month attested
  under a time-bound view key (§3.5 audit trail).

## Bench protocol (answers open question #2: generation time)

`src-tauri/src/commands.rs::generate_zkp_proof` wraps proving with an
`Instant` stopwatch and returns `generatedMs`. Target budgets baked into the
UI copy:

| circuit        | budget | rationale                          |
|-------------- -|--------|------------------------------------|
| balance_gt    | < 2 s  | interactive checkout               |
| provenance_set| < 5 s  | pre-flight during payment          |
| annual_flow   | < 60 s | background job, auditor waits      |

If measured times exceed budget we fall back to recursive composition
(Inner Groth16 → outer batch) before shipping.

## Building

```bash
cd circuits && cargo bench --features gpu   # requires vendored arkworks
```

Not buildable in the browser prototype sandbox; the frontend mock in
`src/lib/backend.js` mirrors these shapes exactly so UX work continues in
parallel.
