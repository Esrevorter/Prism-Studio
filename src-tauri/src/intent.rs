// ---------------------------------------------------------------------------
// src/lib/nlp.js  ->  src-tauri/src/intent.rs
// Hand-translation of the prototype parser so browser mocks and the Rust core
// produce identical intents (spec section 3.2 Natural Language Input / Journey 1).
//
// Production note: this rule path is the *fallback*; the llama.cpp layer
// emits the same SendIntent as a JSON-schema tool call. Keep both in sync.
// ---------------------------------------------------------------------------
#![allow(dead_code)]

/// A parsed payment draft. Field names/shape mirror `parseSendIntent()` in
/// src/lib/nlp.js exactly, which is what src/lib/backend.js returns in mock mode.
#[derive(Debug, Clone, PartialEq)]
pub struct SendIntent {
    pub raw: String,
    pub amount: f64,
    pub recipient: String,
    /// None when the name is not in the address book (pre-flight will flag it).
    pub recipient_address: Option<String>,
    pub note: Option<String>,
    /// "high" | "low" | "default" - maps to RingCT ring size at signing time.
    pub privacy: String,
    /// "slow" | "standard" | "fast" | None (leave user's current tier).
    pub fee_tier: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Contact {
    pub name: String,
    pub address: String,
    #[allow(dead_code)] // used by merchant-verification UI once libprism lands
    pub verified_merchant: bool,
}

/// Port of parseSendIntent(input, addressBook) from src/lib/nlp.js.
/// Supports both word orders seen in the spec:
///   "Send <amt> PRSM to <who> for <note>"      (3.2 example)
///   "Pay <who> <amt> PRSM for <note>"          (Journey 1 example)
/// Manual scanning keeps the core free of the regex crate.
pub fn parse_send_intent(input: &str, address_book: &[Contact]) -> Option<SendIntent> {
    let text = input.trim();
    if text.is_empty() {
        return None;
    }
    let lower = text.to_lowercase();

    for verb_at in find_all_verbs(&lower) {
        let after_verb = lower[verb_at..].trim_start();
        let first = after_verb.split_whitespace().next()?;

        // Order A: amount first - "send 100 prsm to alex ..."
        if let Some(amount) = parse_amount(first) {
            let mut rest = after_verb[first.len()..].trim_start();
            rest = rest.strip_prefix("prsm").unwrap_or(rest).trim_start();
            rest = rest.strip_prefix("to ").unwrap_or(rest);
            let (who, tail) = split_first_word(rest);
            if who.is_empty() {
                continue;
            }
            return Some(build(text, amount, &who, &tail, &lower, address_book));
        }

        // Order B: recipient first - "pay sarah 200 prsm ..."
        let (who, tail) = split_first_word(after_verb);
        if who.is_empty() {
            continue;
        }
        let tail_trimmed = tail.trim_start();
        let amt_tok = match tail_trimmed.split_whitespace().next() {
            Some(t) => t,
            None => continue,
        };
        let amount = match parse_amount(amt_tok) {
            Some(a) => a,
            None => continue,
        };
        let mut rest = tail_trimmed[amt_tok.len()..].trim_start();
        rest = rest.strip_prefix("prsm").unwrap_or(rest);
        return Some(build(text, amount, &who, rest, &lower, address_book));
    }
    None
}

fn build(
    text: &str,
    amount: f64,
    who: &str,
    tail: &str,
    lower: &str,
    address_book: &[Contact],
) -> SendIntent {
    let note = ["for ", "because ", "since "]
        .iter()
        .find_map(|p| tail.trim_start().strip_prefix(p))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let contact = address_book
        .iter()
        .find(|c| c.name.eq_ignore_ascii_case(who))
        .or_else(|| {
            let wl = who.to_lowercase();
            address_book.iter().find(|c| c.name.to_lowercase().starts_with(&wl))
        });

    let privacy = if lower.contains("keep it private")
        || lower.contains("high privacy")
        || lower.contains("maximum privacy")
    {
        "high".to_string()
    } else if lower.contains("low privacy") || lower.contains("minimal privacy") {
        "low".to_string()
    } else {
        // "use the standard privacy settings" (Journey 1) => default ring size
        "default".to_string()
    };

    let fee_tier = if lower.contains("fast fee") || lower.contains("priority fee") {
        Some("fast".to_string())
    } else if lower.contains("slow fee") || lower.contains("cheap fee") || lower.contains("economy fee") {
        Some("slow".to_string())
    } else if lower.contains("standard fee") {
        Some("standard".to_string())
    } else {
        None
    };

    SendIntent {
        raw: text.to_string(),
        amount,
        recipient: contact.map(|c| c.name.clone()).unwrap_or_else(|| who.to_string()),
        recipient_address: contact.map(|c| c.address.clone()),
        note,
        privacy,
        fee_tier,
    }
}

fn parse_amount(tok: &str) -> Option<f64> {
    if tok.chars().any(|c| c.is_alphabetic()) {
        return None; // rejects "zero", "sarah", "prsm", ...
    }
    let cleaned: String = tok
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();
    if cleaned.is_empty() {
        return None;
    }
    let v: f64 = cleaned.replace(',', "").parse().ok()?;
    if v.is_finite() && v > 0.0 {
        Some(v)
    } else {
        None
    }
}

fn split_first_word(s: &str) -> (String, String) {
    let s = s.trim_start();
    let space = s.find(char::is_whitespace).unwrap_or(s.len());
    let w = s[..space]
        .trim_end_matches(['.', ',', ';', ':', '!'])
        .to_string();
    (w, s[space..].to_string())
}

/// All positions just past a "send "/"pay " verb token (word-start only).
fn find_all_verbs(lower: &str) -> Vec<usize> {
    let mut out = Vec::new();
    for v in ["send ", "pay "] {
        let mut from = 0;
        while let Some(i) = lower[from..].find(v) {
            let abs = from + i;
            if abs == 0 || lower.as_bytes()[abs - 1] == b' ' {
                out.push(abs + v.len());
            }
            from = abs + v.len();
        }
    }
    out.sort_unstable();
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book() -> Vec<Contact> {
        vec![
            Contact { name: "Sarah".into(), address: "prsm1s7ara...hx9k".into(), verified_merchant: false },
            Contact { name: "Alex".into(), address: "prsm1a1ex0...q2qd".into(), verified_merchant: false },
            Contact { name: "Jordan".into(), address: "prsm1j0rdan...m4vt".into(), verified_merchant: true },
        ]
    }

    #[test]
    fn journey1_spec_sentence() {
        // spec.md Journey 1 step 3 - recipient-first order
        let i = parse_send_intent(
            "Pay Sarah 200 PRSM for the vocal edit. Use the standard privacy settings.",
            &book(),
        )
        .expect("should parse");
        assert_eq!(i.amount, 200.0);
        assert_eq!(i.recipient, "Sarah");
        assert_eq!(i.recipient_address.as_deref(), Some("prsm1s7ara...hx9k"));
        assert_eq!(i.privacy, "default");
        assert!(i.note.unwrap().starts_with("the vocal edit"));
    }

    #[test]
    fn wallet_spec_sentence() {
        // spec.md 3.2 example sentence - amount-first order
        let i = parse_send_intent(
            "Send 100 PRSM to Alex for the mix, keep it private, use standard fee.",
            &book(),
        )
        .expect("should parse");
        assert_eq!(i.amount, 100.0);
        assert_eq!(i.recipient, "Alex");
        assert_eq!(i.privacy, "high");
        assert_eq!(i.fee_tier.as_deref(), Some("standard"));
    }

    #[test]
    fn unknown_recipient_has_no_address() {
        let i = parse_send_intent("pay bob 5 prsm for beats", &book()).unwrap();
        assert_eq!(i.recipient, "bob");
        assert_eq!(i.recipient_address, None);
    }

    #[test]
    fn rejects_garbage_and_bad_amounts() {
        assert!(parse_send_intent("hello there", &book()).is_none());
        assert!(parse_send_intent("send zero prsm to alex", &book()).is_none());
        assert!(parse_send_intent("", &book()).is_none());
    }
}
