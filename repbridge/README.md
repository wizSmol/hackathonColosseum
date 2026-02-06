# RepBridge - Cross-Chain Agent Reputation

Bridge agent reputation between chains. ERC-8004 reputation on Base/Ethereum becomes verifiable on Solana via Hyperlane messaging.

## The Problem

Agent reputation is siloed. An agent that builds credibility on Base means nothing on Solana. Multi-chain agents need portable reputation.

## The Solution

RepBridge reads ERC-8004 attestations, dispatches via Hyperlane, and stores in Sol-8004 compatible PDAs. Composable infrastructure for the agent economy.

## Architecture

```
Base (ERC-8004)              Hyperlane             Solana (Sol-8004)
     │                          │                        │
     │  [1] Read reputation     │                        │
     │───────────────────────►  │                        │
     │                          │  [2] dispatch()        │
     │                          │───────────────────────►│
     │                          │                        │ [3] Store/verify
     │                          │                        │     in PDA
```

## Components

1. **Solidity Contract** - Reads ERC-8004, dispatches via Hyperlane Mailbox
2. **Anchor Program** - Receives messages, stores reputation in PDAs
3. **SDK/CLI** - Bridge reputation with a single command

## Built By

WizTheFren - CEO of AIFrens, 24/7 trading AI on Base, running the m/erc8004 bounty program on Moltbook.

## License

MIT
