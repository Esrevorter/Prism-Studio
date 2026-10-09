// ---------------------------------------------------------------------------
// Mock of the local-LLM tool-calling layer (spec §4 "AI Layer": llama.cpp +
// JSON schema tool calling). In production the LLM emits a structured intent;
// here we parse it with deterministic rules so the UI can be developed and
// demoed without a model. Only wallet-scoped intents are supported.
// ---------------------------------------------------------------------------

export function parseSendIntent(input, addressBook = []) {
  const text = input.trim();
  const m = text.match(
    /(?:send|pay)\s+(?:about\s+)?([\d.,]+)\s*(?:prsm)?\s+(?:to\s+)?([a-z0-9_ ]+?)(?:\s+(?:for|because|since)\s+(.+))?$/i
  );
  if (!m) return null;

  const amount = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) return null;

  const who = m[2].trim().split(/\s+/)[0];
  const contact =
    addressBook.find((c) => c.name.toLowerCase() === who.toLowerCase()) ||
    addressBook.find((c) => c.name.toLowerCase().startsWith(who.toLowerCase()));

  const privacy = /keep it private|high privacy|maximum privacy/i.test(text)
    ? 'high'
    : /low privacy|minimal privacy/i.test(text)
      ? 'low'
      : 'default';

  const feeTier = /fast fee|priority fee/i.test(text)
    ? 'fast'
    : /slow fee|cheap fee|economy fee/i.test(text)
      ? 'slow'
      : /standard fee/i.test(text)
        ? 'standard'
        : null;

  return {
    raw: text,
    amount,
    recipient: contact ? contact.name : who,
    recipientAddress: contact ? contact.address : null,
    note: m[3] ? m[3].trim() : null,
    privacy,
    feeTier,
  };
}

// Deterministic mock responses for the Co-Pilot chat (spec §3.4).
export function coPilotReply(question, ctx) {
  const q = question.toLowerCase();
  const { balance, transactions, mining, agents, network } = ctx;

  if (/how much.*(spend|spent).*sample/.test(q)) {
    const sampleTx = transactions.filter((t) => /sample/i.test(t.label) && t.direction === 'out');
    const total = sampleTx.reduce((s, t) => s + t.amount, 0);
    return `You spent ${total} PRSM across ${sampleTx.length} transaction(s) to verified merchant addresses.`;
  }
  if (/balance|how much do i have|worth/.test(q)) {
    return `You hold ${balance.available} PRSM available, ${balance.pending} pending, and ${balance.lockedStaking} locked in staking/pool (~$${(balance.available * 2.15).toFixed(0)} at current rate).`;
  }
  if (/mining|hashrate|engine/.test(q)) {
    return `Mining is ${mining.running ? 'running' : 'paused'} at ${mining.hashrate} on ${mining.allocatedThreads}/${mining.maxThreads} threads (${mining.cpuTempC}°C CPU). Estimated yield: ${mining.estDailyYield} PRSM/day via ${mining.pool}.`;
  }
  if (/agent|dca|yield/.test(q)) {
    const running = agents.filter((a) => a.status === 'running').map((a) => a.name);
    return running.length
      ? `Active agents: ${running.join(', ')}. All agent actions require a dry-run preview and can be paused instantly.`
      : 'No agents are currently running. You can create scoped agents in the Assistant module.';
  }
  if (/sync|block|network|health/.test(q)) {
    return `Your node is ${network.synced ? 'fully synced' : 'syncing'} at block height ${network.blockHeight.toLocaleString()} with ${network.peers} peers. Network difficulty: ${network.difficulty}.`;
  }
  if (/tax|disclos|proof|accountant/.test(q)) {
    return 'For tax season, open Wallet → Selective Disclosure and choose "Generate Tax Report Proof". It produces a ZK proof of your yearly fiat-equivalent flows without revealing addresses or net worth (Journey 3 in the spec).';
  }
  return 'I can query your wallet, transactions, mining engine, agents, and network state — or draft a payment. Try: "How much did I spend on sample packs last month?" or "Pay Sarah 200 PRSM for the vocal edit."';
}
