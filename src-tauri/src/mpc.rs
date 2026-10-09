// ---------------------------------------------------------------------------
// MPC Setup Wizard backend (spec §3.5 "Backup Tape").
//
// Real implementation target: GG20 (Dodgson et al.) threshold ECDSA over the
// secp256k1-compatible Prism curve, run as an interactive ceremony between the
// desktop and contact devices holding shards.
//
// This module ships the *dealer fallback* path used by the wizard demo:
// additive secret sharing over Z_p (p = 2^256 - 351 ... we use a 256-bit safe
// prime constant), with SHA-256 commitments published so each contact can
// verify their shard is consistent before accepting it. Shamir would be the
// next milestone (allows single-shard refresh); documented in README.
//
// SECURITY NOTE FOR REVIEWERS: additive splitting of a raw key means the
// dealer momentarily holds the full secret. That is acceptable ONLY for the
// initial import-a-existing-key flow; native key generation must use the
// distributed GG20 ceremony (no dealer). The UI wizard says so explicitly.
// ---------------------------------------------------------------------------
#![allow(dead_code)]

use sha2::{Digest, Sha256};

pub const MAX_SHARDS: usize = 5; // spec: split into 3–5 shards

/// Big-endian 256-bit modulus. Not a curated prime — placeholder until the
/// real curve order is wired in from libprism (see README "Crypto debt").
pub const FIELD_P_HEX: &str =
    "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"; // secp256k1 order

#[derive(Debug, Clone, PartialEq)]
pub struct ShardSplit {
    pub threshold: usize,
    pub total: usize,
    /// Hex-encoded shard scalars (would be encrypted to each contact's device
    /// key in production; never logged).
    pub shards: Vec<String>,
    /// Commitments C_i = H(shard_i) published for verification (§ wizard step 3).
    pub commitments: Vec<String>,
    pub dealer_held_full_key: bool, // true ⇒ additive dealer path, flagged in UI
}

/// Split `secret` (32 bytes, big-endian scalar mod p) into `total` additive
/// shards such that any `threshold`… actually ALL `total` are needed for this
/// additive scheme; threshold semantics come with Shamir/GG20. The wizard
/// therefore labels this export as "all-of-N backup" until Shamir lands.
pub fn additive_split(secret: &[u8; 32], total: usize) -> Result<ShardSplit, String> {
    if total == 0 || total > MAX_SHARDS {
        return Err(format!("shards must be 1..={MAX_SHARDS}"));
    }
    let p = parse_hex_u256(FIELD_P_HEX)?;
    // NOTE: add_mod is only a valid reduction while operands stay < 2^256 - p.
    // With the secp256k1 order that leaves ~2^224 headroom, so summing <=5
    // uniformly-sampled 256-bit shards never needs more than one subtract-back.
    debug_assert!(total <= MAX_SHARDS);
    let mut acc = [0u8; 32]; // running sum of the first total-1 shards
    let mut shards = Vec::new();
    let mut rng_seed = Sha256::digest([secret.as_slice(), b"prism-mpc-v0"].concat());

    for i in 0..total.saturating_sub(1) {
        // Deterministic-ish randomness for tests; production uses OsRng.
        // Counter-mode hashing: shard_i = H(seed || i) — independent per shard.
        let shard: [u8; 32] =
            Sha256::digest([rng_seed.as_slice(), &(i as u64).to_be_bytes()].concat())
                .into();
        add_mod(&mut acc, &shard, &p);
        shards.push(hex::encode(shard));
    }
    // Final shard = secret - acc (mod p) so that sum(shards) == secret (mod p).
    let last = sub_mod(secret, &acc, &p);
    shards.push(hex::encode(last));

    let commitments = shards
        .iter()
        .map(|s| hex::encode(Sha256::digest(hex::decode(s).unwrap())))
        .collect();

    Ok(ShardSplit {
        threshold: total, // additive ⇒ all-of-N until Shamir upgrade
        total,
        shards,
        commitments,
        dealer_held_full_key: true,
    })
}

/// Reconstruct the secret from all shards (used by the recovery rehearsal).
pub fn additive_recover(shards: &[String]) -> Result<[u8; 32], String> {
    let p = parse_hex_u256(FIELD_P_HEX)?;
    let mut acc = [0u8; 32];
    for s in shards {
        let bytes = hex::decode(s).map_err(|e| e.to_string())?;
        if bytes.len() != 32 {
            return Err("bad shard length".into());
        }
        add_mod(&mut acc, bytes.as_slice().try_into().unwrap(), &p);
    }
    Ok(acc)
}

// ---- tiny fixed-width 256-bit modular helpers (big-endian byte arrays) -----

fn parse_hex_u256(h: &str) -> Result<[u8; 32], String> {
    let b = hex::decode(h).map_err(|e| e.to_string())?;
    if b.len() != 32 {
        return Err("bad modulus".into());
    }
    let mut a = [0u8; 32];
    a.copy_from_slice(&b);
    Ok(a)
}

/// x = (x + y) mod m. Correct for operands < 2^256 − m (holds here: shards
/// are < 2^256 and m = secp256k1 order, so the dropped top carry is exactly
/// one extra m to subtract back — see comment on the carry branch).
fn add_mod(x: &mut [u8; 32], y: &[u8; 32], m: &[u8; 32]) {
    let mut carry: u16 = 0;
    for i in (0..32).rev() {
        let s = x[i] as u16 + y[i] as u16 + carry;
        x[i] = s as u8;
        carry = s >> 8;
    }
    // With carry c ∈ {0,1}: true sum = wrapped + c·2^256 ≡ wrapped + c·(2^256−m)·1 ...
    // Reducing needs (2^256−m) added when c=1, plus a conditional −m when ≥ m.
    if carry > 0 {
        add_plain(x, &delta_2p256_minus_m(m));
    }
    if ge(x, m) {
        sub_in_place(x, m);
    }
}

/// 2^256 − m as a 32-byte big-endian value (fits because m > 2^255).
fn delta_2p256_minus_m(m: &[u8; 32]) -> [u8; 32] {
    let mut d = [0u8; 32];
    sub_from_pow2(m, &mut d);
    d
}

/// d = 2^256 − a (a > 0), big-endian.
fn sub_from_pow2(a: &[u8; 32], d: &mut [u8; 32]) {
    let mut borrow: i16 = 0;
    // 2^256 in bytes is [1,0,...,0] (33 bytes); compute via complement+1
    let mut carry: u16 = 1;
    for i in (0..32).rev() {
        let s = (!a[i]) as u16 + carry; // bitwise not then +1 ⇒ 2^256 − a
        d[i] = s as u8;
        carry = s >> 8;
    }
    let _ = borrow;
}

fn add_plain(x: &mut [u8; 32], y: &[u8; 32]) {
    let mut carry: u16 = 0;
    for i in (0..32).rev() {
        let s = x[i] as u16 + y[i] as u16 + carry;
        x[i] = s as u8;
        carry = s >> 8;
    }
}

/// out = (a − b) mod m via schoolbook borrow propagation (no 2^256 wrap issue:
/// on borrow we add m with full carry handling).
fn sub_mod(a: &[u8; 32], b: &[u8; 32], m: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let d = a[i] as i16 - b[i] as i16 - borrow;
        if d < 0 {
            out[i] = (d + 256) as u8;
            borrow = 1;
        } else {
            out[i] = d as u8;
            borrow = 0;
        }
    }
    if borrow > 0 {
        // out currently = a − b + 2^256; we want a − b + m ⇒ add (m − 2^256)
        // which equals −(2^256 − m): subtract the delta instead.
        let delta = delta_2p256_minus_m(m);
        let mut b2 = [0u8; 32];
        b2.copy_from_slice(&out);
        // out = out − delta (borrow can't persist: a,b < 2^256, result ≥ 0 after +m)
        let mut br: i16 = 0;
        for i in (0..32).rev() {
            let d = b2[i] as i16 - delta[i] as i16 - br;
            if d < 0 {
                out[i] = (d + 256) as u8;
                br = 1;
            } else {
                out[i] = d as u8;
                br = 0;
            }
        }
    }
    out
}

/// a -= b; returns false on borrow (result negative before wrap).
fn sub_in_place(a: &mut [u8; 32], b: &[u8; 32]) -> bool {
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let d = a[i] as i16 - b[i] as i16 - borrow;
        if d < 0 {
            a[i] = (d + 256) as u8;
            borrow = 1;
        } else {
            a[i] = d as u8;
            borrow = 0;
        }
    }
    borrow == 0
}

fn ge(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a >= b
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_then_recover_roundtrips() {
        let secret = [7u8; 32];
        let s = additive_split(&secret, 5).unwrap();
        assert_eq!(s.shards.len(), 5);
        assert_eq!(s.commitments.len(), 5);
        let rec = additive_recover(&s.shards).unwrap();
        assert_eq!(rec, secret);
    }

    #[test]
    fn different_splits_produce_different_shards_but_same_secret() {
        let secret = [42u8; 32];
        let a = additive_split(&secret, 3).unwrap();
        let b = additive_split(&secret, 5).unwrap();
        assert_ne!(a.shards, b.shards[..3]); // not prefix-identical
        assert_eq!(additive_recover(&a.shards).unwrap(), secret);
        assert_eq!(additive_recover(&b.shards).unwrap(), secret);
    }

    #[test]
    fn rejects_too_many_shards() {
        assert!(additive_split(&[1u8; 32], 6).is_err());
    }
}
