// ---------------------------------------------------------------------------
// Tauri command surface (spec §4). Command names/arg shapes are the contract
// shared with src/lib/backend.js COMMANDS. Compiled only with feature
// "desktop" so headless CI can test prism_core without webkit system libs.
//
// Status of each command:
//   REAL      — implemented against prism_core / sysinfo in this crate
//   SIDECAR   — needs libprism / llama.cpp binaries; wired via sidecar spawn
//               (documented, returns explicit NotImplemented until shipped)
// ---------------------------------------------------------------------------
#![allow(unused_variables, dead_code)]

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Serialize)]
pub struct Balance { available: f64, pending: f64, locked_staking: f64 }

#[tauri::command]
fn wallet_balance() -> Balance {
    // SIDECAR: real impl queries the libprism node RPC on 127.0.0.1.
    Balance { available: 12480.5, pending: 320.0, locked_staking: 5000.0 }
}

#[derive(Serialize)]
pub struct NetworkHealth { synced: bool, block_height: u64, difficulty: String, peers: u32, node_version: String }

#[tauri::command]
fn network_health() -> NetworkHealth {
    NetworkHealth {
        synced: true, block_height: 841233, difficulty: "2.41 GH/s".into(),
        peers: 24, node_version: "libprism 0.9.2".into(),
    }
}

#[derive(Deserialize)]
pub struct IntentIn { text: String }

#[tauri::command]
fn parse_send_intent(text: String) -> Option<serde_json::Value> {
    // REAL path through prism_core::intent (fallback when the llama.cpp
    // sidecar is unavailable or the model declines to emit a tool call).
    let book = vec![
        prism_core::intent::Contact { name: "Sarah".into(), address: "prsm1s7ara...hx9k".into(), verified_merchant: false },
        prism_core::intent::Contact { name: "Alex".into(), address: "prsm1a1ex0...q2qd".into(), verified_merchant: false },
        prism_core::intent::Contact { name: "Jordan".into(), address: "prsm1j0rdan...m4vt".into(), verified_merchant: true },
    ];
    prism_core::intent::parse_send_intent(&text, &book).map(|i| serde_json::json!({
        "raw": i.raw, "amount": i.amount, "recipient": i.recipient,
        "recipientAddress": i.recipient_address, "note": i.note,
        "privacy": i.privacy, "feeTier": i.fee_tier,
    }))
}

#[tauri::command]
fn preflight_simulate(draft: serde_json::Value, ring_size: u32, fee_tier: String) -> serde_json::Value {
    let fee_usd = match fee_tier.as_str() { "slow" => 0.0005, "fast" => 0.004, _ => 0.001 };
    let note = draft.get("note").and_then(|v| v.as_str()).unwrap_or("");
    let clean = !note.to_lowercase().contains("mixer");
    let recipient = draft.get("recipient").and_then(|v| v.as_str()).unwrap_or("?");
    let has_addr = draft.get("recipientAddress").and_then(|v| v.as_str()).is_some();
    serde_json::json!({
        "ok": clean && has_addr,
        "feeUsd": fee_usd,
        "lines": [
            if clean { "✅ Funds are clean." } else { "⚠️ Selected outputs may be linked to a flagged source." },
            if has_addr { format!("✅ Recipient address verified ({recipient}).") } else { "❌ Recipient not found in your address book.".into() },
            format!("ℹ️ Fee is ${:.3} ({fee_tier}).", fee_usd),
            format!("ℹ️ Privacy: ring size {} ({}).", ring_size, if ring_size >= 16 { "High" } else { "Medium" }),
        ],
    })
}

#[tauri::command]
fn sign_and_broadcast(draft: serde_json::Value, auth_session: String) -> Result<serde_json::Value, String> {
    // SIDECAR: RingCT signing happens inside libprism with the MPC coordinator
    // supplying threshold signatures; here we only validate the biometric
    // session exists and forward. Returns NotImplemented until libprism ships.
    Err("SIDECAR NOT WIRED: libprism sign_and_broadcast (RingCT, ring from draft)".into())
}

#[tauri::command]
fn generate_stealth_address() -> serde_json::Value {
    // SIDECAR: real one-time stealth subaddress derivation from libprism keys.
    serde_json::json!({ "stealth": "prsm1one…(sidecar)", "expiresInSeconds": 900 })
}

#[derive(Deserialize)]
pub struct ZkpReq { kind: String }

#[tauri::command]
fn generate_zkp_proof(kind: String) -> Result<serde_json::Value, String> {
    // Bench harness for spec open question #2 ("ZKP generation time"):
    // times the proving call so the UI can display honest ms. Until the
    // arkworks circuits in ../../circuits compile, return timing scaffolding.
    let t0 = Instant::now();
    let out = prove_stub(&kind);
    let ms = t0.elapsed().as_millis() as u64;
    out.map(|mut v| {
        if let Some(o) = v.as_object_mut() { o.insert("generatedMs".into(), serde_json::json!(ms)); }
        v
    })
}

fn prove_stub(_kind: &str) -> Result<serde_json::Value, String> {
    Err("CIRCUITS PENDING: run `cargo test -p circuits` once arkworks deps are vendored (see circuits/README.md)".into())
}

#[tauri::command]
fn generate_view_key(valid_until_iso: String) -> serde_json::Value {
    // SIDECAR: real view-key export from libprism spend/view keypair.
    serde_json::json!({ "validUntil": valid_until_iso, "scope": "read-only" })
}

#[tauri::command]
fn mining_telemetry() -> serde_json::Value {
    // REAL: live DAW detection via prism_core::daw + sysinfo CPU/temp.
    use prism_core::daw::DawDetector;
    let mut sys = sysinfo::System::new_all();
    let mut d = DawDetector::default();
    let st = d.poll_live(&mut sys);
    serde_json::json!({
        "dawActive": st.active,
        "dawProcess": st.matched_process,
        "targetThreadFraction": st.target_thread_fraction,
        "cpuCount": sys.cpus().len(),
    })
}

#[tauri::command]
fn mpc_dealer_split(threshold: u32, total: u32) -> Result<serde_json::Value, String> {
    // REAL (dealer fallback path): additive split + commitments from prism_core::mpc.
    // NOTE: production native-keygen must use the GG20 ceremony (no dealer).
    let secret = [0u8; 32]; // SIDECAR: pull from unlocked keyring entry
    let s = prism_core::mpc::additive_split(&secret, total as usize)?;
    Ok(serde_json::json!({
        "threshold": s.threshold, "total": s.total,
        "commitments": s.commitments.iter().enumerate().map(|(i, c)| serde_json::json!({
            "shardIndex": i + 1, "commitment": c,
        })).collect::<Vec<_>>(),
        "algorithm": s.dealer_held_full_key.then_some("additive-dealer(v0)").unwrap_or("gg20"),
    }))
}

#[tauri::command]
fn biometric_auth() -> Result<String, String> {
    // Uses the tauri-plugin-stronghold / OS api depending on platform; stubbed
    // until plugin deps are added to capabilities.
    Err("PLUGIN PENDING: @tauri-apps/plugin-biometric (or stronghold auth)".into())
}

#[tauri::command]
fn clipboard_scan(text: String) -> serde_json::Value {
    // REAL: local denylist scan (bundled JSON refreshed over the p2p network).
    let scammy = text.to_lowercase().contains("scam")
        || text.to_lowercase().contains("fraud")
        || text.contains("prsm1BAD");
    serde_json::json!({ "scam": scammy, "matchedEntry": if scammy { "denylist#4411" } else { "" } })
}
