```markdown
# Prism Studio: GUI Client Specification

**Project:** Prism (PRSM)  
**Component:** Prism Studio (Desktop GUI Client)  
**Version:** 0.1.0 (Draft)  
**Status:** Conceptual / Pre-Development  

---

## 1. Introduction

**Prism Studio** is the primary desktop graphical user interface for the Prism network. It serves as a full node, wallet, CPU miner, and AI assistant. 

Designed with a "Producer Ethos," Prism Studio treats financial management like a Digital Audio Workstation (DAW): incredibly powerful under the hood, but with a streamlined, intuitive interface that keeps the user in their creative flow. It is explicitly designed with neuro-inclusive principles (ADHD-friendly) to reduce cognitive load, decision fatigue, and anxiety.

---

## 2. Design Philosophy & UX Guidelines

### 2.1 The "Producer" Ethos
*   **Signal over Noise:** Hide complex cryptographic operations by default. Surface only what the user needs at that exact moment.
*   **Progressive Disclosure:** A "Simple" view for daily use, and an "Advanced" view for power users (accessible via a single toggle, not buried in menus).
*   **Forgiving by Design:** No action is irreversible without a clear, plain-English confirmation. "Undo" or "Delay" options are provided where technically feasible.

### 2.2 Neuro-Inclusive (ADHD-Friendly) UI
*   **Visual Hierarchy:** High contrast, muted background colors, and clear typography. No flashy, overstimulating animations.
*   **Contextual Reminders:** Gentle, non-intrusive nudges for security checks or pending tasks, rather than aggressive pop-ups.
*   **Focus Modes:** Ability to collapse all non-essential UI elements into a single "Action Bar" to prevent distraction.

---

## 3. Core Modules & Features

### 3.1 Dashboard (The "Mix Console")
The central hub providing a high-level overview of the user's state.
*   **Total Balance:** Clear display of available, pending, and locked (staking/pool) PRSM.
*   **Quick Actions:** 3 large, distinct buttons: *Send*, *Receive*, *Ask AI*.
*   **Network Health:** Node sync status, current block height, and network difficulty.
*   **AI Daily Briefing:** A 2-sentence plain-English summary of wallet activity (e.g., *"You received 3 payments yesterday. Your auto-DCA agent bought 50 PRSM this morning."*).

### 3.2 Wallet & Transactions (The "Signal Flow")
#### Sending
*   **Natural Language Input:** A text box where users can type: *"Send 100 PRSM to Alex for the mix, keep it private, use standard fee."* The AI parses this and generates a preview.
*   **Manual Form:** Traditional address/amount input with auto-fill from the address book.
*   **Privacy Slider:** Adjust the RingCT ring size (default: 16) and fee tier. Visual indicator shows the privacy/fee trade-off.
*   **Pre-Flight Simulator:** Before signing, the AI simulates the transaction and displays a green/red status: *"✅ Funds are clean. Recipient address is verified. Fee is $0.002."*

#### Receiving & Selective Disclosure (The Prism Protocol)
*   **Standard Receive:** Generates a one-time stealth address and QR code.
*   **Selective Disclosure Portal:** 
    *   *Generate Proof:* "Prove my balance is > 10,000 PRSM" (for collateral).
    *   *Generate Proof:* "Prove these funds did not originate from Mixer X" (for compliance).
    *   *Auditor View-Key:* Generate a time-bound, read-only view key for tax accountants.

### 3.3 Mining (The "Engine Room")
Prism uses RandomX (CPU-friendly PoW). The mining module is optimized to run alongside heavy workloads (like audio production).
*   **Thread Allocator:** Visual slider to allocate CPU threads. 
*   **DAW-Throttle Mode:** A specific toggle that instantly drops mining intensity to 10% if it detects high CPU usage from other applications (e.g., Ableton, Pro Tools, FL Studio) to prevent audio dropouts/latency.
*   **Thermal Management:** Real-time CPU temp monitoring with auto-throttling to prevent hardware damage.
*   **Pool Management:** Easy setup for public pools or solo mining. Visualizes estimated daily yield.

### 3.4 AI Assistant (The "Co-Pilot")
Powered by a **locally hosted** LLM (e.g., Llama-3-8B or Mistral via `llama.cpp`) to ensure zero data leakage to external servers.
*   **Chat Interface:** Conversational UI for querying the blockchain and wallet.
    *   *User:* "How much did I spend on sample packs last month?"
    *   *AI:* "You spent 450 PRSM across 4 transactions to verified merchant addresses."
*   **Autonomous Agents Dashboard:**
    *   Create and manage scoped AI agents.
    *   *Example Agent:* "DCA Agent" - Buys 50 PRSM every Friday at 5 PM.
    *   *Example Agent:* "Yield Agent" - Moves idle PRSM to a privacy-preserving liquidity pool.
    *   *Safety:* All agent actions require a "dry run" preview and can be paused instantly.
*   **Security Guardian:** Passively monitors clipboard and active window. If a user copies a wallet address, the AI checks it against known scam databases and warns if it's a match.

### 3.5 Security & Recovery (The "Backup Tape")
*   **MPC Setup Wizard:** Step-by-step guide to splitting the private key into 3-5 shards.
*   **Social Recovery UI:** Invite trusted contacts (via encrypted QR or secure link) to hold a shard. Visualizes the recovery threshold (e.g., "Need 3 of 5 to recover").
*   **Biometric Gate:** Integrates with OS-level FaceID/TouchID for quick, secure unlocking of the wallet for transactions, bypassing the need to type a password every time.

---

## 4. Technical Stack (Proposed)

To ensure high performance, strong security, and cross-platform compatibility (Windows, macOS, Linux):

*   **Frontend (UI):** 
    *   **Framework:** Tauri (Rust backend, Web frontend) for low memory footprint and high security.
    *   **UI Library:** React + TailwindCSS + Radix UI (for accessible, neuro-inclusive components).
    *   **State Management:** Zustand (lightweight, easy to manage complex wallet states).
*   **Backend (Core):**
    *   **Language:** Rust.
    *   **Node Integration:** Libprism (Rust implementation of the Prism node, consensus, and RandomX miner).
    *   **Cryptography:** `curve25519-dalek` (for RingCT), `arkworks` (for ZKPs).
*   **AI Layer:**
    *   **Inference:** `llama.cpp` (GGUF models) running locally via Rust bindings.
    *   **Tool Calling:** Custom JSON schema for the LLM to interact with the wallet RPC securely.

---

## 5. User Journeys (Examples)

### Journey 1: Paying a Collaborator (Low Friction)
1. User opens Prism Studio.
2. Clicks the "Ask AI" bar at the top.
3. Types: *"Pay Sarah 200 PRSM for the vocal edit. Use the standard privacy settings."*
4. AI parses the request, finds Sarah in the address book, calculates the fee, and generates a **Pre-Flight Preview**.
5. User reviews the plain-English summary: *"Sending 200 PRSM to Sarah. Fee: $0.001. Privacy: High."*
6. User clicks "Confirm & Sign" (authenticates via TouchID).
7. Transaction broadcasts. AI sends a gentle notification: *"Payment sent. Sarah has been notified."*

### Journey 2: Mining While Mixing (Context-Aware)
1. User is running a heavy DAW session (high CPU).
2. Prism Studio is running in the background, mining at 100% capacity.
3. User starts rendering a massive audio bounce. CPU spikes.
4. Prism Studio detects the system load via OS APIs.
5. "DAW-Throttle Mode" automatically engages. Mining threads drop from 12 to 2.
6. Audio render completes without a single dropout or latency spike.
7. Once the render finishes, Prism Studio smoothly scales mining back up to 12 threads.

### Journey 3: Tax Season (Selective Disclosure)
1. User needs to report crypto gains to their accountant.
2. Navigates to the "Selective Disclosure" tab.
3. Selects "Generate Tax Report Proof".
4. The wallet generates a Zero-Knowledge Proof that mathematically verifies all incoming and outgoing fiat-equivalent values for the year, *without* revealing the actual addresses or the total net worth.
5. User exports the proof as a secure PDF/JSON file and sends it to their accountant.
6. The accountant's software verifies the ZKP against the Prism blockchain and confirms the tax data is 100% accurate and untampered.

---

## 6. Open Questions for Development

1. **Local LLM Hardware Requirements:** What is the minimum RAM/VRAM required to run the local AI assistant smoothly without bogging down the host machine? (Target: < 8GB RAM footprint).
2. **ZKP Generation Time:** How long does it take to generate a selective disclosure proof on a standard laptop? Can we optimize this to be under 5 seconds?
3. **DAW Detection API:** What is the most reliable, cross-platform way to detect if a high-priority audio application is currently processing audio?

---
*End of Specification*
```
