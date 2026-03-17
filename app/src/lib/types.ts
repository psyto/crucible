export enum MatchState {
  Open = "open",
  Active = "active",
  Settling = "settling",
  Completed = "completed",
  Cancelled = "cancelled",
  Draw = "draw",
}

export enum ScoringMethod {
  PnlPercent = "pnl_percent",
  Sharpe = "sharpe",
  RiskAdjusted = "risk_adjusted",
}

export const SCORING_LABELS: Record<ScoringMethod, string> = {
  [ScoringMethod.PnlPercent]: "PnL %",
  [ScoringMethod.Sharpe]: "Sharpe Ratio",
  [ScoringMethod.RiskAdjusted]: "Risk-Adjusted",
};

export enum Protocol {
  Drift = "drift",
}

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  [Protocol.Drift]: "Drift Protocol",
};

export interface VaultStats {
  equity: number;
  pnlPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positionCount: number;
  tradeCount: number;
  avgLeverage: number;
}

export interface Position {
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  leverage: number;
}

export interface MatchEntrant {
  wallet: string;
  vaultAddress: string;
  stats: VaultStats;
  positions: Position[];
  equityCurve: number[];
}

export interface Match {
  id: number;
  challenger: MatchEntrant;
  opponent: MatchEntrant | null;
  state: MatchState;
  protocol: Protocol;
  scoringMethod: ScoringMethod;
  duration: number; // seconds
  maxLeverage: number;
  stakeAmount: number; // USDC
  capitalAmount: number; // USDC per vault
  createdAt: number;
  startedAt: number;
  endsAt: number;
  winner: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
  avgPnlPercent: number;
  totalPnlPercent: number;
  avgSharpe: number;
  bestSharpe: number;
  maxDrawdown: number;
}

export const DURATION_OPTIONS = [
  { value: 86400, label: "1 Day" },
  { value: 259200, label: "3 Days" },
  { value: 604800, label: "1 Week" },
];

export const SCORING_OPTIONS = [
  { value: ScoringMethod.PnlPercent, label: "PnL %" },
  { value: ScoringMethod.Sharpe, label: "Sharpe Ratio" },
  { value: ScoringMethod.RiskAdjusted, label: "Risk-Adjusted" },
];
