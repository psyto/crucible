/**
 * Core types for Crucible — the universal strategy competition platform.
 */

// ─── Adapter Interface ───────────────────────────────────────────────────────

/**
 * Every protocol adapter implements this interface.
 * This is the only contract between Crucible and the DeFi protocols it supports.
 */
export interface ProtocolAdapter {
  /** Unique identifier (e.g., "drift", "jupiter-perps", "hyperliquid") */
  readonly protocolId: string;

  /** Chain identifier (e.g., "solana", "arbitrum", "sui") */
  readonly chainId: string;

  /** Human-readable name */
  readonly displayName: string;

  /**
   * Create an isolated vault/account for a competition entrant.
   * The vault should be controlled by the entrant but observable by Crucible.
   */
  createVault(params: CreateVaultParams): Promise<VaultInfo>;

  /**
   * Get current vault snapshot for scoring.
   * This is the primary data source for the scoring engine.
   */
  getSnapshot(vaultId: string): Promise<VaultSnapshot>;

  /**
   * Get vault metadata and status.
   */
  getVaultInfo(vaultId: string): Promise<VaultInfo>;

  /**
   * Check if the adapter can connect to the protocol.
   */
  healthCheck(): Promise<boolean>;
}

export interface CreateVaultParams {
  /** Vault owner/manager wallet address */
  owner: string;
  /** Initial capital in USD-equivalent */
  initialCapitalUsd: number;
  /** Optional: restrict to specific markets */
  allowedMarkets?: string[];
  /** Optional: max leverage allowed */
  maxLeverage?: number;
}

// ─── Vault Data ──────────────────────────────────────────────────────────────

export interface VaultInfo {
  /** Unique vault identifier (on-chain address or API ID) */
  vaultId: string;
  /** Protocol this vault is on */
  protocolId: string;
  /** Chain this vault is on */
  chainId: string;
  /** Vault owner/manager */
  owner: string;
  /** When the vault was created */
  createdAt: number;
  /** Whether the vault is active and trading */
  active: boolean;
}

export interface VaultSnapshot {
  /** Vault identifier */
  vaultId: string;
  /** Snapshot timestamp (unix seconds) */
  timestamp: number;
  /** Current total equity in USD */
  equityUsd: number;
  /** Original capital deposited in USD */
  depositedUsd: number;
  /** Realized PnL from closed positions */
  realizedPnlUsd: number;
  /** Unrealized PnL from open positions */
  unrealizedPnlUsd: number;
  /** Total PnL (realized + unrealized) */
  totalPnlUsd: number;
  /** Current open positions */
  positions: Position[];
  /** Total number of trades executed */
  tradeCount: number;
  /** Peak equity during the competition */
  peakEquityUsd: number;
  /** Maximum drawdown percentage (0-100) */
  maxDrawdownPct: number;
}

export interface Position {
  /** Market/symbol (e.g., "SOL-PERP", "ETH-PERP") */
  market: string;
  /** Long or short */
  side: "long" | "short";
  /** Position size in USD */
  sizeUsd: number;
  /** Entry price */
  entryPrice: number;
  /** Current mark price */
  markPrice: number;
  /** Current leverage */
  leverage: number;
  /** Unrealized PnL for this position */
  pnlUsd: number;
}

// ─── Competition ─────────────────────────────────────────────────────────────

export enum MatchState {
  /** Waiting for opponent */
  Created = "created",
  /** Both sides deposited, waiting for start */
  Accepted = "accepted",
  /** Competition is live */
  Active = "active",
  /** Time expired, computing scores */
  Settling = "settling",
  /** Settled, winner determined */
  Completed = "completed",
  /** Cancelled before start */
  Cancelled = "cancelled",
  /** Tied scores */
  Draw = "draw",
}

export enum MatchFormat {
  /** 1v1 duel */
  Duel = "duel",
  /** Bracket tournament */
  Tournament = "tournament",
}

export enum ScoringMethod {
  /** Raw PnL percentage — best for short sprints */
  PnlPercent = "pnl_percent",
  /** Sharpe ratio — best for longer competitions */
  Sharpe = "sharpe",
  /** Combined: Sharpe with drawdown penalty */
  RiskAdjusted = "risk_adjusted",
}

export interface MatchConfig {
  /** Competition format */
  format: MatchFormat;
  /** How results are scored */
  scoring: ScoringMethod;
  /** Duration in seconds */
  duration: number;
  /** Stake amount per side in USDC */
  stakeUsd: number;
  /** Starting capital per side in USDC (may differ from stake) */
  capitalUsd: number;
  /** Protocol to compete on */
  protocolId: string;
  /** Chain */
  chainId: string;
  /** Optional: restrict to specific markets */
  allowedMarkets?: string[];
  /** Maximum leverage allowed */
  maxLeverage: number;

  // ─── Anti-MEV Guardrails ───────────────────────────────────────────────────
  // These prevent meta-strategies (counter-trading opponents' visible positions)
  // from dominating over genuine algorithmic skill.

  /**
   * Minimum number of distinct markets a strategy must trade.
   * Prevents pure "mirror and inverse" strategies on a single market.
   * Default: 1 (no restriction). Recommended: 3 for serious competitions.
   */
  minMarketDiversity: number;

  /**
   * Random delay window in seconds added to the match start.
   * Actual start = scheduled start + random(0, startDelayWindow).
   * Makes it harder to prepare targeted counter-strategies.
   * Default: 0. Recommended: 3600 (1 hour) for longer matches.
   */
  startDelayWindow: number;
}

export interface Match {
  /** Unique match ID */
  id: string;
  /** Match configuration */
  config: MatchConfig;
  /** Current state */
  state: MatchState;
  /** Challenger vault */
  challenger: MatchEntrant;
  /** Opponent vault (null if open challenge) */
  opponent: MatchEntrant | null;
  /** When the match was created */
  createdAt: number;
  /** When the match started (both accepted) */
  startedAt: number;
  /** When the match ends */
  endsAt: number;
  /** Winner vault ID (null if not settled or draw) */
  winner: string | null;
}

export interface MatchEntrant {
  /** Wallet address of the strategy operator */
  owner: string;
  /** Vault ID on the target protocol */
  vaultId: string;
  /** Latest snapshot */
  snapshot: VaultSnapshot | null;
  /** Final score (set at settlement) */
  score: MatchScore | null;
}

export interface MatchScore {
  /** PnL as percentage of capital */
  pnlPercent: number;
  /** Annualized Sharpe ratio */
  sharpeRatio: number;
  /** Max drawdown percentage */
  maxDrawdownPct: number;
  /** Number of trades */
  tradeCount: number;
  /** Average leverage used */
  avgLeverage: number;
  /** Final equity */
  finalEquityUsd: number;
  /** Number of distinct markets traded */
  marketDiversity: number;
  /**
   * Penalty applied for insufficient market diversity.
   * 0 = no penalty. Positive value = score reduction.
   */
  diversityPenalty: number;
  /** Composite score (method-dependent, after penalties) */
  compositeScore: number;
}

// ─── Time Series (for Sharpe calculation) ────────────────────────────────────

export interface EquityPoint {
  timestamp: number;
  equityUsd: number;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type CrucibleEvent =
  | { type: "match_created"; matchId: string; config: MatchConfig }
  | { type: "match_accepted"; matchId: string; opponent: string }
  | { type: "match_started"; matchId: string; startedAt: number }
  | { type: "snapshot_update"; matchId: string; entrant: "challenger" | "opponent"; snapshot: VaultSnapshot }
  | { type: "match_settled"; matchId: string; winner: string | null; scores: { challenger: MatchScore; opponent: MatchScore } }
  | { type: "match_cancelled"; matchId: string };
