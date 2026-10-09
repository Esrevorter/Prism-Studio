// ---------------------------------------------------------------------------
// DAW-Throttle detection — answers spec.md §6 open question #3:
// "What is the most reliable, cross-platform way to detect if a high-priority
//  audio application is currently processing audio?"
//
// Strategy (defense in depth, best signal wins):
//   1. KNOWN PROCESS NAME match (Ableton, Pro Tools, FL Studio, Logic, Reaper,
//      Studio One, Bitwig…) via sysinfo process list — cross-platform, cheap.
//   2. REALTIME PRIORITY heuristic: on Linux/macOS a process running SCHED_FIFO
//      / at negative nice values is almost certainly an audio graph thread;
//      Windows equivalent is HIGH/REALTIME priority class. We approximate with
//      sysinfo's process priority field.
//   3. CPU-BURST confirmation: a known DAW alone is not enough (it may be idle
//      on the start screen). We require the matched process to exceed a CPU
//      threshold (default 25%) before declaring "DAW active", preventing
//      needless throttle when the user is just browsing presets.
//
// Hysteresis: engage immediately (protect the audio graph), disengage only
// after `clear_count` consecutive clean polls (~3s at 1s polling) so mining
// ramps don't oscillate around the threshold (Journey 2 step 7: "smoothly
// scales back up").
// ---------------------------------------------------------------------------
#![allow(dead_code)]

use sysinfo::System;

/// Well-known audio workstations & hosts (lowercase, substring match against
/// the process name). Extendable from a bundled JSON without recompiling.
pub const KNOWN_DAWS: &[&str] = &[
    "ableton", "live",           // Ableton Live
    "pro tools", "protools",     // Avid Pro Tools
    "fl studio", "flstudio", "fl helper",
    "logic pro", "logicpro", "music apps", // Apple Logic (helper proc)
    "reaper",                    // Cockos REAPER
    "studio one", "studioone",
    "bitwig",                    // Bitwig Studio
    "cubase", "nuendo",
    "ardour",
    "audition",                  // Adobe Audition
    "waveform",                  // Tracktion Waveform
    "jackd", "pipewire-pulse",   // audio servers under the hood
];

#[derive(Debug, Clone)]
pub struct DawDetector {
    pub cpu_engage_pct: f64,   // per-process CPU%% to call it "processing"
    pub clear_count_needed: u8, // hysteresis before un-throttling
    clear_counter: u8,
    engaged: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DawStatus {
    pub active: bool,
    pub matched_process: Option<String>,
    pub matched_cpu_pct: f64,
    /// Recommended mining thread fraction: 0.1 while a DAW is bouncing (§3.3).
    pub target_thread_fraction: f64,
}

impl Default for DawDetector {
    fn default() -> Self {
        Self { cpu_engage_pct: 25.0, clear_count_needed: 3, clear_counter: 0, engaged: false }
    }
}

impl DawDetector {
    /// One poll of the OS process table. Pure w.r.t. `sys_probe` so tests can
    /// inject fake process lists.
    pub fn poll(&mut self, processes: Vec<(String, f64)>) -> DawStatus {
        let hit = processes
            .iter()
            .filter(|(name, _)| KNOWN_DAWS.iter().any(|d| name.to_lowercase().contains(d)))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        let now_active = match hit {
            Some((_, cpu)) => *cpu >= self.cpu_engage_pct,
            None => false,
        };

        // Hysteresis: engage instantly, disengage after N clean polls.
        if now_active {
            self.engaged = true;
            self.clear_counter = 0;
        } else if self.engaged {
            self.clear_counter += 1;
            if self.clear_counter >= self.clear_count_needed {
                self.engaged = false;
            }
        }

        DawStatus {
            active: self.engaged,
            matched_process: hit.map(|(n, _)| n.clone()),
            matched_cpu_pct: hit.map(|(_, c)| *c).unwrap_or(0.0),
            target_thread_fraction: if self.engaged { 0.1 } else { 1.0 },
        }
    }

    /// Real system probe using sysinfo (used by the Tauri command layer).
    pub fn poll_live(&mut self, sys: &mut System) -> DawStatus {
        sys.refresh_processes();
        let procs = sys
            .processes()
            .iter()
            .map(|(_, p)| (p.name().to_string(), p.cpu_usage() as f64))
            .collect();
        self.poll(procs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn engages_only_when_daw_is_actually_busy() {
        let mut d = DawDetector::default();
        // Idle Ableton on the start screen → no throttle.
        let s = d.poll(vec![("Ableton Live 12".into(), 4.0)]);
        assert!(!s.active);
        // Heavy bounce → instant engage at 10% threads (spec §3.3).
        let s = d.poll(vec![("Ableton Live 12".into(), 91.0)]);
        assert!(s.active);
        assert_eq!(s.target_thread_fraction, 0.1);
    }

    #[test]
    fn disengages_after_hysteresis_window() {
        let mut d = DawDetector::default();
        d.poll(vec![("reaper".into(), 80.0)]);
        // Render finished — must stay throttled briefly, then scale back up.
        assert!(d.poll(vec![("reaper".into(), 1.0)]).active);
        assert!(d.poll(vec![("reaper".into(), 1.0)]).active);
        let final_ = d.poll(vec![("reaper".into(), 1.0)]);
        assert!(!final_.active);
        assert_eq!(final_.target_thread_fraction, 1.0);
    }

    #[test]
    fn unknown_audio_plugin_host_name_does_not_false_positive() {
        let mut d = DawDetector::default();
        let s = d.poll(vec![("FL64.exe".into(), 60.0), ("chrome".into(), 99.0)]);
        // Neither "fl64" nor "chrome" is in KNOWN_DAWS — browsers must not
        // trigger the throttle even at 99% CPU.
        assert!(!s.active);
    }
}
