# Crucible -- Product Design

A decentralized platform where automated DeFi strategies compete head-to-head with real capital. Protocol-agnostic, chain-agnostic.

> **Status:** MVP complete. Escrow deployed on Solana devnet. Live competition ran on Drift with two funded vaults ($1,000 USDC each), bots trading SOL-PERP, scored by PnL%. Drift's existing competition is a volume-weighted raffle — Crucible fills the skill-based gap.

## The Problem

1. **No way to prove strategy quality.** Anyone can claim their bot makes money. There's no transparent, verifiable competition to separate real edge from noise.

2. **Strategy discovery is broken.** Copy trading platforms show past PnL, which is easily gamed. Live head-to-head competition is the only honest signal.

3. **Competitions are primitive.** Every perp DEX runs volume leaderboards. These reward size, not skill. Manual trading over short windows is mostly luck.

## The Product

Automated strategies compete in structured matches — duels (1v1) and tournaments (brackets) — with real capital at stake. Performance is measured by risk-adjusted returns over meaningful timeframes. Strategies can execute on any supported protocol and chain.

### How It Works

1. **Deploy** — Strategy operator deploys a vault with seed capital
2. **Match** — Enter a duel or tournament at a stake tier
3. **Compete** — Strategy executes trades automatically during the match window
4. **Score** — Scoring engine evaluates PnL%, Sharpe ratio, max drawdown
5. **Settle** — Winner receives both stakes minus protocol fee

### What Makes This Different

| Feature | Volume Leaderboards | Copy Trading | Crucible |
|---------|-------------------|--------------|----------------|
| Automated | No | Partial | Yes |
| Verifiable | Somewhat | No (past PnL) | Yes (live, on-chain) |
| Head-to-head | No | No | Yes |
| Risk-adjusted | No | No | Yes (Sharpe) |
| Multi-protocol | No | No | Yes |
| Multi-chain | No | No | Yes (planned) |
| Real stakes | Sometimes | No | Always |

---

## Architecture

### Layer Model

```
+----------------------------------------------------------+
|                    Crucible                          |
|                                                          |
|  +-----------+  +----------+  +-----------+  +--------+  |
|  | Matchmaker|  | Scoring  |  | Escrow    |  | UI /   |  |
|  | (duels,   |  | Engine   |  | (USDC     |  | API    |  |
|  |  brackets)|  | (PnL,   |  |  custody)  |  |        |  |
|  |           |  |  Sharpe) |  |           |  |        |  |
|  +-----------+  +----------+  +-----------+  +--------+  |
|                                                          |
+----------------------------+-----------------------------+
                             |
                      Adapter Interface
                             |
            +----------------+----------------+
            |                |                |
     +------+------+  +-----+------+  +------+------+
     | Solana      |  | EVM        |  | Other       |
     | Adapters    |  | Adapters   |  | Adapters    |
     |             |  |            |  |             |
     | - Drift     |  | - dYdX v4  |  | - Bluefin   |
     | - Jupiter   |  | - Hyperliq.|  |   (Sui)     |
     | - Adrena    |  | - GMX v2   |  | - Merkle    |
     |             |  | - Vertex   |  |   (Aptos)   |
     +-------------+  +------------+  +-------------+
```

### Adapter Interface

Every protocol adapter implements one simple interface:

```typescript
interface ProtocolAdapter {
  // Unique identifier for this protocol
  protocolId: string;
  chainId: string;

  // Create an isolated vault/account for a competition entrant
  createVault(owner: string, initialCapital: number): Promise<VaultId>;

  // Get current vault state
  getVaultState(vaultId: VaultId): Promise<VaultState>;

  // Snapshot for scoring
  getSnapshot(vaultId: VaultId): Promise<VaultSnapshot>;
}

interface VaultSnapshot {
  timestamp: number;
  equityUsd: number;          // Current total value in USD
  depositedUsd: number;       // Original capital deposited
  realizedPnlUsd: number;     // Closed position PnL
  unrealizedPnlUsd: number;   // Open position PnL
  positions: Position[];       // Current open positions
  tradeCount: number;          // Total trades executed
  maxDrawdownPct: number;      // Worst peak-to-trough
}
```

That's it. Any protocol that can report these fields can participate.

### Scoring Engine

Primary metrics (configurable per competition):

| Metric | Formula | Why |
|--------|---------|-----|
| PnL % | `(equity - deposited) / deposited * 100` | Raw performance |
| Sharpe Ratio | `mean(returns) / std(returns) * sqrt(periods)` | Risk-adjusted (default for tournaments) |
| Max Drawdown | `max(peak - trough) / peak` | Risk discipline |
| Win Rate | `profitable_trades / total_trades` | Consistency |

Competition types can weight these differently:
- **Sprint** (1 day): Pure PnL% — reward aggressive alpha
- **Marathon** (1 week): Sharpe ratio — reward consistency
- **Ironman** (1 month): Sharpe + drawdown cap — reward discipline

### Escrow

Two models depending on chain:

**Single-chain (MVP):**
- All stakes deposited in USDC on one chain (Solana for v1)
- Strategies execute anywhere — adapters report PnL back
- Settlement on the escrow chain
- Trust assumption: the adapter/oracle reports honest PnL

**Cross-chain (v2):**
- Stakes deposited on the strategy's native chain
- Cross-chain messaging (Wormhole/LayerZero) for settlement
- Each chain has its own escrow program
- Coordinator aggregates results

---

## MVP Scope: Drift on Solana

### Why Drift First

1. `drift-vaults` program already exists — isolated capital, delegated trading authority
2. Best Solana perp SDK — TypeScript + Rust, well-documented
3. Highest Solana perp liquidity
4. Open-source — can inspect everything
5. Keeper network for order execution

### MVP Features

1. **Vault creation** — Deploy a Drift vault with competition capital
2. **Duel matching** — Challenge another vault to a timed match
3. **Automated execution** — Strategy bots trade through Drift SDK during match
4. **Live scoring** — Real-time PnL tracking via Drift account state
5. **Settlement** — Winner's vault receives stakes
6. **UI** — Challenge board, live match viewer, leaderboard

### What the MVP Proves (Verified on Devnet)

- Automated strategies can compete head-to-head with real capital -- DONE
- Drift vault creation, deposit, delegate trading -- DONE
- PnL reading via Drift SDK (User.getNetUsdValue) -- DONE
- The scoring engine produces meaningful, verifiable results -- DONE (15 tests)
- Crucible escrow holds and distributes stakes -- DONE
- Frontend with wallet integration -- DONE

Live competition result:
```
Vault A: $999.90 | LONG 0.5 SOL | PnL: -0.0099%
Vault B: $999.96 | SHORT 0.5 SOL | PnL: -0.0038%
Winner: Vault B
```

### MVP Does NOT Include

- Cross-chain anything
- Multiple protocol adapters
- Spectator predictions
- Tournament brackets (duels only)
- Strategy marketplace / following

---

## Protocol Adapter Roadmap

### Phase 1: Drift (Solana)
- Vault via `drift-vaults` program
- PnL from Drift user account state
- Keeper execution for limit orders

---

## Adversarial Robustness: Why MEV Is a Feature

### The Problem

On-chain positions are visible. A "meta-strategy" that monitors an opponent's orders and counter-trades them could dominate pure algorithmic skill. This is the primary objection to transparent strategy competitions.

### The Reframe

A strategy that only works when no one is watching isn't a good strategy. In real DeFi markets:
- Your orders ARE visible on-chain
- Other participants DO counter-trade you
- MEV bots DO front-run you
- Liquidity conditions change based on your own market impact

A competition that includes these pressures is **more realistic, not less**. Crucible tests battle-hardened strategies — the kind that survive adversarial environments.

### Guardrails That Make It Fair

**1. Sharpe-based scoring naturally penalizes counter-trading.**

A meta-strategy that mirrors and inverses an opponent's positions takes on the same volatility. If both sides are just counter-trading, both have high variance and LOW Sharpe. The predator doesn't win on risk-adjusted metrics unless they have genuine skill beyond position copying.

Implemented: `computeSharpe()` in the scoring engine. Verified by test: "counter-trading strategy has lower Sharpe than smooth strategy."

**2. Market diversity requirement prevents single-market exploitation.**

Matches can require strategies to trade across N distinct markets (e.g., SOL-PERP + ETH-PERP + BTC-PERP). A pure "mirror and inverse" strategy on one market gets a diversity penalty that reduces its composite score.

Implemented: `computeMarketDiversity()` and `computeDiversityPenalty()`. Configurable via `MatchConfig.minMarketDiversity`. Default: 1 (no restriction). Recommended: 3 for serious competitions.

Verified by test: "single-market predator loses to diverse strategy at same PnL."

**3. Random start delay prevents targeted pre-positioning.**

Matches start at a random time within a configurable window (e.g., +0 to +60 minutes). Harder to prepare a counter-strategy if you don't know exactly when position scoring begins.

Implemented: `MatchConfig.startDelayWindow`. Applied by the match coordinator.

**4. Longer durations favor genuine strategies.**

In a 1-week Sharpe competition, a counter-trading meta-strategy gets wiped by market moves it didn't anticipate. Short-term counter-trading works for minutes, not days. Crucible's recommended competition format is 3-7 days with Sharpe scoring.

### Scoring Tiebreakers Reward Robustness

When composite scores are close:
1. Higher market diversity wins (multi-market > single-market)
2. Lower max drawdown wins (discipline)
3. Fewer trades wins (conviction over churn)

This creates a clear hierarchy: diverse, disciplined, convicted strategies beat narrow, volatile, churning ones — even if raw PnL is similar.

---

### Phase 2: Multi-Venue Solana
- Jupiter Perps adapter (JLP positions)
- Combined vault that trades across Drift + Jupiter
- Cross-venue PnL aggregation

### Phase 3: EVM
- Hyperliquid adapter (REST API, no on-chain program needed)
- dYdX v4 adapter (Cosmos chain, API-based)
- GMX v2 adapter (Arbitrum)

### Phase 4: Cross-Chain
- Escrow on multiple chains
- Wormhole/LayerZero settlement messaging
- Unified leaderboard across all chains

---

## Business Model

1. **Protocol fee** — 5% of competition stakes (same as Adrena Arena)
2. **Premium tiers** — Higher stake brackets with lower fees
3. **Strategy showcase** — Featured strategies pay for visibility
4. **Data** — Competition analytics as a product (strategy performance data)
5. **Protocol partnerships** — DEXs pay for integration (drives their volume)

---

## Competitive Moat

1. **Adapter ecosystem** — each new protocol adapter increases the platform's value for all participants
2. **Track records** — verifiable competition history becomes a strategy's reputation. Hard to replicate.
3. **Network effects** — more strategies competing = more spectators = more strategies entering
4. **Cross-chain** — once established, the universal competition layer is hard to displace

---

## Open Questions

1. **MEV protection** — How do we prevent competitors from front-running each other's strategies during a match?
2. **Strategy privacy** — Can strategies compete without revealing their logic? (Execution is on-chain, so positions are visible)
3. **Capital efficiency** — Locking capital in a vault during competition is expensive. Can we use margin or leverage on the stake itself?
4. **Regulatory** — Is a strategy competition with real stakes a regulated activity? Likely depends on jurisdiction.
5. **Fair start** — How do we ensure both strategies start at exactly the same time with the same market conditions?
6. **Adapter trust** — In cross-chain mode, who verifies the adapter is reporting honest PnL? Oracle problem.
