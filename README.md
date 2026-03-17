# Crucible

Where automated DeFi strategies prove themselves. Head-to-head competitions with real capital on Drift Protocol.

**Live on Drift devnet** — two vaults, $1,000 USDC each, bots trading SOL-PERP, scored by PnL%.

---

## What is Crucible?

Crucible is a competition platform where automated trading strategies compete head-to-head with real capital. Strategies are isolated in Drift vaults, bots trade as delegates, and a scoring engine determines the winner based on risk-adjusted returns.

No one else builds this. Drift runs volume-weighted raffles. Other DEXs run manual leaderboards. Crucible is skill-based, automated, vault-isolated, and protocol-agnostic by design.

### Proven on Drift Devnet

```
Vault A: $999.90 | LONG 0.5 SOL-PERP | PnL: -0.0099%
Vault B: $999.96 | SHORT 0.5 SOL-PERP | PnL: -0.0038%
Winner:  Vault B (SHORT)
```

Both vaults created, funded with real USDC, delegates set, bots traded, equity read, winner scored — all on-chain.

---

## Architecture

```
+----------------------------------------------------------+
|                       Crucible                            |
|                                                          |
|  +-----------+  +----------+  +-----------+  +--------+  |
|  | Match     |  | Scoring  |  | Escrow    |  | Next.js|  |
|  | Engine    |  | Engine   |  | Program   |  | UI     |  |
|  | (coord.)  |  | (PnL%,  |  | (USDC     |  |        |  |
|  |           |  |  Sharpe) |  |  custody)  |  |        |  |
|  +-----------+  +----------+  +-----------+  +--------+  |
|                                                          |
+----------------------------+-----------------------------+
                             |
                    Adapter Interface
                             |
               +-------------+-------------+
               |                           |
        +------+------+            +-------+------+
        | Drift       |            | Future       |
        | Adapter     |            | Adapters     |
        |             |            |              |
        | - Vaults    |            | - Jupiter    |
        | - Equity    |            | - Hyperliquid|
        | - Delegate  |            | - dYdX       |
        +-------------+            +--------------+
```

### Components

| Package | Description | Status |
|---------|-------------|--------|
| `@crucible/core` | Adapter interface, scoring engine (PnL%, Sharpe, drawdown) | Done, 15 tests |
| `@crucible/adapter-drift` | Drift vault creation, equity reading, delegate management | Working on devnet |
| `@crucible/coordinator` | Match lifecycle, snapshot polling, REST API, WebSocket | Done |
| `@crucible/bot-simple` | Momentum trading bot on Drift SDK | Done |
| `crucible-escrow` | On-chain USDC escrow for match stakes (Anchor/Solana) | Deployed on devnet |
| `app` | Next.js 14 frontend with wallet adapter | Running |

---

## What Works End-to-End

Verified on Drift devnet with real USDC:

1. **Create Drift vaults** — `initializeVault` via drift-vaults program
2. **Deposit USDC** — `initializeVaultDepositor` + `deposit` with oracle remaining accounts
3. **Set delegates** — `updateDelegate` so bot wallets can trade
4. **Bots trade** — `placePerpOrder` as delegate on the vault's Drift user
5. **Read equity** — `User.getNetUsdValue()`, `getUnrealizedPNL()`, `getLeverage()`
6. **Score** — PnL%, Sharpe ratio, max drawdown, composite scoring
7. **Settle** — Crucible escrow pays winner minus 5% protocol fee

---

## Devnet Addresses

| Resource | Address |
|----------|---------|
| Crucible Escrow Program | `Guq3DZZQ1PfAU49TG7WuEweSp6bjko8yVMdH3a3Hszfb` |
| Crucible Config PDA | `B5kUvDR1GNzshbJWnhCxA9mzdKr3ZeEbMxkqkjs2KLqD` |
| Crucible Mock USDC | `GAV4FB6iiyHvTQt6gqFsjD2kg57oyc8ZLmdicsMwxugP` |
| Drift Program | `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH` |
| Drift Vaults Program | `vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR` |
| Drift Devnet USDC | `8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2` |
| Competition Vault A | `ANvDq7ZDHyMtycWMgBinZET37vWXv6x5azDbfhe3ESZR` |
| Competition Vault B | `Gji6RwVAM8aqMkUgGQxfUwn7iEsgD8jnLTUmPQwACUWc` |

---

## Quick Start

### Prerequisites

- Rust + Solana CLI + Anchor CLI 0.31.1
- Node.js 18+
- Solana devnet wallet with SOL
- Drift devnet USDC (get from Drift app or team)

### Build and Deploy

```bash
# Build escrow program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Initialize escrow
cd scripts && npm install
npx ts-node initialize.ts
```

### Run the Frontend

```bash
cd app
npm install
npm run dev
```

### Run a Competition

```bash
# From /tmp/crucible-drift-test (isolated from monorepo for BN compatibility)
npm install @drift-labs/sdk @drift-labs/vaults-sdk @coral-xyz/anchor @solana/web3.js bn.js bs58

# Create vaults, deposit, set delegates, trade, score
node run-live-competition.ts
```

### Utility Scripts

```bash
cd scripts

# Create a Drift vault
npx ts-node create-drift-vault.ts <VAULT_NAME> [DELEGATE_WALLET]

# Read vault equity
npx ts-node read-vault-equity.ts <VAULT_NAME>

# Mint test USDC (for Crucible escrow)
npx ts-node mint-test-usdc.ts <WALLET> <AMOUNT>

# Test escrow lifecycle
npx ts-node test-match.ts
```

---

## Project Structure

```
crucible/
  packages/
    core/                        # Adapter interface + scoring engine
      src/
        types.ts                 # ProtocolAdapter, VaultSnapshot, Match, Score
        scoring.ts               # PnL%, Sharpe, drawdown, composite
        scoring.test.ts          # 15 unit tests
    adapter-drift/               # Drift Protocol integration
      src/index.ts               # DriftAdapter, vault creation, equity reading
      drift_vaults_idl.json      # Drift Vaults program IDL
    coordinator/                 # Match orchestration service
      src/
        match-engine.ts          # Match lifecycle, snapshot polling
        api.ts                   # REST API endpoints
        index.ts                 # Service entrypoint + WebSocket
    bot-simple/                  # Demo trading bot
      src/index.ts               # Momentum strategy on Drift SDK
  programs/
    crucible-escrow/             # On-chain USDC escrow (Anchor)
      src/
        lib.rs                   # Program entrypoint
        state.rs                 # CrucibleConfig, MatchEscrow
        instructions/            # initialize, create/accept/settle/cancel match
  app/                           # Next.js 14 frontend
    src/
      app/                       # Pages: home, matches, leaderboard
      components/                # MatchCard, MatchViewer, CreateMatchModal
      hooks/                     # useCrucibleProgram, useMatches
      lib/                       # Types, mock data, IDL
  scripts/                       # Deployment and testing scripts
  CONCEPT.md                     # Product design document
```

---

## Scoring

Three scoring methods, configurable per match:

| Method | Formula | Best For |
|--------|---------|----------|
| PnL % | `(equity_end - equity_start) / equity_start * 100` | Short sprints (1 day) |
| Sharpe Ratio | `mean(returns) / std(returns) * sqrt(periods_per_year)` | Longer matches (1 week) |
| Risk-Adjusted | `Sharpe - maxDrawdown / 10` | Discipline-focused |

Tiebreakers: lower drawdown > fewer trades > draw.

---

## Adapter Interface

Any DeFi protocol can be integrated by implementing:

```typescript
interface ProtocolAdapter {
  protocolId: string;
  chainId: string;
  createVault(params: CreateVaultParams): Promise<VaultInfo>;
  getSnapshot(vaultId: string): Promise<VaultSnapshot>;
  healthCheck(): Promise<boolean>;
}
```

The Drift adapter is the first implementation. Jupiter Perps and Hyperliquid are planned.

---

## How Crucible Complements Drift

Drift's existing competition (`DraWMeQX9LfzQQSYoeBwHAgM5JcqFkgrX7GbTfjzVMVL`) is a volume-weighted raffle — random draws based on taker fees. It is not skill-based, has no head-to-head, and does not use vaults.

Crucible fills the gap:

| | Drift Sweepstakes | Crucible |
|---|---|---|
| Format | Random raffle | Head-to-head duels |
| Scoring | Volume (fees = tickets) | PnL%, Sharpe, drawdown |
| Skill-based | No | Yes |
| Uses vaults | No | Yes (drift-vaults) |
| Prize source | Insurance Fund | Player stakes (escrow) |

Crucible drives Drift volume: each match creates 2 vaults, and bots actively trade during competitions.

---

## Roadmap

**Phase 1 (current): Drift on Solana**
- Vault creation, deposit, delegate trading, equity scoring
- Escrow program for stakes
- Frontend with match management

**Phase 2: Multi-venue Solana**
- Jupiter Perps adapter
- Cross-venue strategy competitions

**Phase 3: Cross-chain**
- Hyperliquid adapter (first non-Solana)
- dYdX v4, GMX v2
- Cross-chain settlement

---

## Links

- [Product Concept](./CONCEPT.md)
- [Drift Vaults Program](https://github.com/drift-labs/drift-vaults)
- [Drift Protocol v2](https://github.com/drift-labs/protocol-v2)
