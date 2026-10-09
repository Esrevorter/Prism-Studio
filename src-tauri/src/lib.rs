//! Prism Studio — Rust core entry point (spec §4: "Tauri Shell + Rust Core").
//!
//! Module map:
//!   * `intent`   — natural-language send-intent parser (mirrors src/lib/nlp.js;
//!                  in production this is replaced/augmented by a llama.cpp
//!                  JSON-schema tool call — see AI note below).
//!   * `daw`      — DAW-Throttle process detection (answers spec open question #3).
//!   * `mpc`      — GG20-style additive secret sharing for the Backup Tape (§3.5).
//!   * `commands` — Tauri command surface exposed to the frontend
//!                  (names match COMMANDS in src/lib/backend.js). Behind the
//!                  `desktop` feature so core logic tests run without webkit.

pub mod daw;
pub mod intent;
pub mod mpc;

#[cfg(feature = "desktop")]
pub mod commands;

#[cfg(feature = "desktop")]
pub fn run() {
    use commands::*;
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            wallet_balance,
            network_health,
            parse_send_intent,
            preflight_simulate,
            sign_and_broadcast,
            generate_stealth_address,
            generate_zkp_proof,
            generate_view_key,
            mining_telemetry,
            mpc_dealer_split,
            biometric_auth,
            clipboard_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Prism Studio");
}
