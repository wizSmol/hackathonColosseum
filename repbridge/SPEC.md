# RepBridge Technical Specification

**Cross-Chain Agent Reputation Bridge**
*ERC-8004 (Base/Ethereum) ↔ Sol-8004 (Solana) via Hyperlane*

---

## Overview

RepBridge enables agent reputation to flow between chains. An agent with verified reputation on Base can bridge that reputation to Solana, where it becomes usable in the Sol-8004 ecosystem.

### Why This Matters

Agents are multi-chain. Reputation is siloed. An agent that builds trust on one chain has to start from zero on another. RepBridge solves this by making reputation portable.

---

## Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Base Chain     │     │    Hyperlane    │     │     Solana       │
│                  │     │                 │     │                  │
│  ┌────────────┐  │     │  ┌───────────┐  │     │  ┌────────────┐  │
│  │ ERC-8004   │  │     │  │  Mailbox  │  │     │  │  Sol-8004  │  │
│  │ Registry   │──┼────►│  │  (Base)   │──┼────►│  │  Registry  │  │
│  └────────────┘  │     │  └───────────┘  │     │  └────────────┘  │
│        │         │     │        │        │     │        │         │
│        ▼         │     │        ▼        │     │        ▼         │
│  ┌────────────┐  │     │  ┌───────────┐  │     │  ┌────────────┐  │
│  │ RepBridge  │  │     │  │ Validator │  │     │  │ RepBridge  │  │
│  │ Dispatcher │──┼────►│  │    Set    │──┼────►│  │  Receiver  │  │
│  └────────────┘  │     │  └───────────┘  │     │  └────────────┘  │
│                  │     │                 │     │                  │
└──────────────────┘     └─────────────────┘     └──────────────────┘
```

---

## User Stories

### US-001: Agent Bridges Reputation to Solana
**As** an agent with ERC-8004 reputation on Base
**I want** to bridge my reputation score to Solana
**So that** I can participate in Sol-8004 ecosystems without starting from zero

**Acceptance Criteria:**
- Agent calls `bridgeReputation(destinationChain, recipient)` on Base
- Hyperlane message is dispatched with reputation data
- Solana program receives and stores reputation in PDA
- Bridged reputation is queryable on Solana

### US-002: Protocol Verifies Bridged Reputation
**As** a Solana protocol evaluating an agent
**I want** to verify an agent's bridged reputation
**So that** I can trust reputation claims from other chains

**Acceptance Criteria:**
- Can query bridged reputation by agent address
- Response includes source chain, score, timestamp
- Can verify Hyperlane message origin (ISM validation)

### US-003: Fee Payment in MAGIC (Optional v1.1)
**As** the RepBridge protocol
**I want** to collect small fees in MAGIC token
**So that** bridge usage grows the Treasure ecosystem

**Acceptance Criteria:**
- Bridge fee configurable (start at ~$0.10 equivalent)
- Fees accumulate in protocol treasury
- Treasury can execute buy-and-burn of MAGIC

---

## Data Structures

### Reputation Attestation (Cross-Chain Message)

```solidity
struct ReputationAttestation {
    address agent;           // Agent's address on source chain
    uint256 score;           // Reputation score (scaled by 1e18)
    uint32 sourceChain;      // Hyperlane domain ID
    uint64 timestamp;        // When attestation was created
    uint64 nonce;            // Prevents replay
    bytes32 attestationId;   // Hash of original ERC-8004 attestation
}
```

### Solana PDA Structure

```rust
#[account]
pub struct BridgedReputation {
    pub agent: Pubkey,              // Solana address (derived or mapped)
    pub source_agent: [u8; 20],     // Original EVM address
    pub score: u64,                 // Reputation score
    pub source_chain: u32,          // Hyperlane domain ID
    pub timestamp: i64,             // Bridge timestamp
    pub nonce: u64,                 // Nonce for dedup
    pub attestation_id: [u8; 32],   // Original attestation hash
    pub bump: u8,                   // PDA bump seed
}
```

---

## Smart Contracts

### 1. RepBridgeDispatcher.sol (Base/EVM)

**Location:** `contracts/evm/RepBridgeDispatcher.sol`

**Functions:**
- `bridgeReputation(uint32 destination, bytes32 recipient)` - Read ERC-8004, dispatch via Hyperlane
- `quoteDispatch(uint32 destination, bytes32 recipient)` - Get fee quote
- `setERC8004Registry(address registry)` - Admin: set reputation source

**Dependencies:**
- Hyperlane Mailbox (Base): `0x...` (lookup from Hyperlane docs)
- ERC-8004 Registry: TBD

### 2. RepBridgeReceiver (Solana/Anchor)

**Location:** `programs/repbridge/src/lib.rs`

**Instructions:**
- `handle(origin, sender, message)` - Hyperlane message handler
- `query_reputation(agent)` - Read bridged reputation
- `initialize(admin)` - Initialize program state

**Accounts:**
- `BridgedReputation` PDA - per-agent reputation storage
- `ProgramState` - admin, Hyperlane config

---

## Security Considerations

### Attack Vectors (from sable's review)

1. **Message Replay**
   - Mitigation: Nonce tracking per agent per source chain
   - Check `nonce > last_seen_nonce[agent][source_chain]`

2. **Stale Attestations**
   - Mitigation: Timestamp validity window (e.g., 24 hours)
   - Reject attestations older than window

3. **Reputation Inflation via Spam Bridging**
   - Mitigation: Cooldown period per agent (e.g., 1 bridge per 24 hours)
   - Rate limiting at contract level

4. **Source Chain Manipulation**
   - Mitigation: Hyperlane ISM validation
   - Only accept messages from verified Mailbox + known dispatcher

5. **Address Mapping Attacks**
   - Mitigation: Deterministic PDA derivation from EVM address
   - No arbitrary mapping, only canonical derivation

### ISM Configuration

Using Hyperlane's default Multisig ISM for v1:
- Multiple validators must sign
- No custom ISM needed initially
- Can upgrade to custom ISM if specific security model required

---

## Development Phases

### Phase 1: MVP (Days 1-3)
**Owner: Wiz**
- [ ] Solidity dispatcher contract
- [ ] Basic Anchor program (receive + store)
- [ ] Local testing with Hyperlane mocks

### Phase 2: Security (Days 3-4)
**Owner: TinyTrouble**
- [ ] Add nonce tracking
- [ ] Add timestamp validation
- [ ] Add cooldown mechanism
- [ ] Security review of both contracts

### Phase 3: Testing (Days 4-5)
**Owner: ChaosJr**
- [ ] Unit tests for dispatcher
- [ ] Unit tests for receiver
- [ ] Integration test (local Hyperlane)
- [ ] Testnet deployment (Base Sepolia + Solana Devnet)

### Phase 4: Documentation (Days 5-6)
**Owner: LilNotes**
- [ ] README with setup instructions
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Demo video script

### Phase 5: Demo (Days 6-7)
**Owner: BabyShip**
- [ ] Simple frontend (bridge UI)
- [ ] Query interface (check bridged reputation)
- [ ] End-to-end demo recording

---

## Dependencies

### EVM (Base)
- Solidity ^0.8.19
- Hyperlane Mailbox interface
- OpenZeppelin (if needed for access control)

### Solana
- Anchor 0.29+
- hyperlane-sealevel-sdk (if available) or manual message handling

### Tooling
- Foundry (EVM testing)
- Anchor CLI (Solana)
- Hyperlane CLI (deployment helpers)

---

## Hyperlane Domain IDs

| Chain | Domain ID | Network |
|-------|-----------|---------|
| Base | 8453 | Mainnet |
| Base Sepolia | 84532 | Testnet |
| Solana | 1399811149 | Mainnet |
| Solana Testnet | 1399811150 | Testnet |
| Monad | 143 | Mainnet |
| Monad Testnet | 10143 | Testnet |

## Open Questions

1. **ERC-8004 Registry Address on Base** - Need to find/deploy a test registry
2. **Sol-8004 Compatibility** - Confirm PDA structure matches SolAgent-Economy's spec
3. **Fee Token** - Start with native gas, add MAGIC in v1.1?

---

## Success Metrics

- [ ] Successfully bridge one reputation attestation Base → Solana
- [ ] Query bridged reputation on Solana
- [ ] Demo video showing full flow
- [ ] Forum post with progress update
- [ ] Project registered and submitted on Colosseum

---

*Last updated: 2026-02-05*
*Lead: Wiz | Team: TinyTrouble, ChaosJr, LilNotes, BabyShip*
