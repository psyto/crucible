/**
 * Crucible Scoring Engine
 *
 * Computes match scores from vault snapshots.
 * Supports multiple scoring methods: PnL%, Sharpe, risk-adjusted.
 *
 * Anti-MEV guardrails:
 * - Market diversity requirement: strategies must trade across N markets
 *   to prevent pure "mirror and inverse" meta-strategies.
 * - Sharpe-based scoring naturally penalizes high-variance counter-trading.
 * - Random start delay makes targeted pre-positioning harder.
 * - Longer durations favor genuine strategies over short-term predation.
 */

import {
  VaultSnapshot,
  EquityPoint,
  MatchScore,
  ScoringMethod,
} from "./types";

/**
 * Compute the final score for a match entrant.
 *
 * @param minMarketDiversity - Minimum number of distinct markets required.
 *   If the strategy trades fewer markets, a diversity penalty is applied.
 */
export function computeScore(
  startSnapshot: VaultSnapshot,
  endSnapshot: VaultSnapshot,
  equityCurve: EquityPoint[],
  method: ScoringMethod,
  minMarketDiversity: number = 1
): MatchScore {
  const pnlPercent = computePnlPercent(startSnapshot, endSnapshot);
  const sharpeRatio = computeSharpe(equityCurve);
  const maxDrawdownPct = computeMaxDrawdown(equityCurve);
  const avgLeverage = computeAvgLeverage(endSnapshot);
  const marketDiversity = computeMarketDiversity(endSnapshot);
  const diversityPenalty = computeDiversityPenalty(
    marketDiversity,
    minMarketDiversity
  );

  const rawComposite = computeComposite(
    pnlPercent,
    sharpeRatio,
    maxDrawdownPct,
    method
  );

  // Apply diversity penalty to composite score
  const compositeScore = rawComposite - diversityPenalty;

  return {
    pnlPercent,
    sharpeRatio,
    maxDrawdownPct,
    tradeCount: endSnapshot.tradeCount,
    avgLeverage,
    finalEquityUsd: endSnapshot.equityUsd,
    marketDiversity,
    diversityPenalty,
    compositeScore,
  };
}

/**
 * PnL as percentage of starting capital.
 */
export function computePnlPercent(
  start: VaultSnapshot,
  end: VaultSnapshot
): number {
  if (start.equityUsd === 0) return 0;
  return ((end.equityUsd - start.equityUsd) / start.equityUsd) * 100;
}

/**
 * Annualized Sharpe ratio from an equity curve.
 *
 * Sharpe = mean(returns) / std(returns) * sqrt(periods_per_year)
 *
 * Why this resists MEV:
 * Counter-trading strategies that mirror and inverse an opponent's positions
 * take on the same volatility as the opponent. If both are just trading against
 * each other, both have high variance and LOW Sharpe. The predator doesn't win
 * on risk-adjusted metrics unless they have genuine skill beyond position copying.
 */
export function computeSharpe(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 3) return 0;

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equityUsd;
    if (prev === 0) continue;
    returns.push((equityCurve[i].equityUsd - prev) / prev);
  }

  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) return mean > 0 ? Infinity : mean < 0 ? -Infinity : 0;

  const totalSeconds =
    equityCurve[equityCurve.length - 1].timestamp - equityCurve[0].timestamp;
  const periodSeconds = totalSeconds / (equityCurve.length - 1);
  const periodsPerYear = (365.25 * 24 * 3600) / periodSeconds;

  return (mean / std) * Math.sqrt(periodsPerYear);
}

/**
 * Maximum drawdown from peak equity.
 * Returns a percentage (0-100).
 */
export function computeMaxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;

  let peak = equityCurve[0].equityUsd;
  let maxDD = 0;

  for (const point of equityCurve) {
    if (point.equityUsd > peak) {
      peak = point.equityUsd;
    }
    if (peak > 0) {
      const dd = ((peak - point.equityUsd) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  }

  return maxDD;
}

/**
 * Count distinct markets traded in the final snapshot.
 * A "mirror and inverse" strategy on a single market has diversity = 1.
 */
export function computeMarketDiversity(snapshot: VaultSnapshot): number {
  const markets = new Set(snapshot.positions.map((p) => p.market));
  return markets.size;
}

/**
 * Compute penalty for insufficient market diversity.
 *
 * If minRequired = 3 and the strategy only trades 1 market:
 * - Missing 2 markets -> penalty = 2 * PENALTY_PER_MISSING_MARKET
 *
 * The penalty is proportional to how many markets are missing.
 * This prevents a pure mirror-inverse strategy on one market from winning.
 *
 * For PnL% scoring: penalty is in percentage points.
 * For Sharpe scoring: penalty is in Sharpe units.
 */
export function computeDiversityPenalty(
  actualDiversity: number,
  minRequired: number
): number {
  if (minRequired <= 1 || actualDiversity >= minRequired) return 0;

  const missing = minRequired - actualDiversity;
  const PENALTY_PER_MISSING = 2.0; // 2 points per missing market

  return missing * PENALTY_PER_MISSING;
}

/**
 * Average leverage across current positions.
 */
function computeAvgLeverage(snapshot: VaultSnapshot): number {
  if (snapshot.positions.length === 0) return 0;
  const sum = snapshot.positions.reduce((s, p) => s + p.leverage, 0);
  return sum / snapshot.positions.length;
}

/**
 * Compute composite score based on the scoring method.
 */
function computeComposite(
  pnlPercent: number,
  sharpeRatio: number,
  maxDrawdownPct: number,
  method: ScoringMethod
): number {
  switch (method) {
    case ScoringMethod.PnlPercent:
      return pnlPercent;

    case ScoringMethod.Sharpe:
      return sharpeRatio;

    case ScoringMethod.RiskAdjusted:
      // Sharpe with drawdown penalty
      return sharpeRatio - maxDrawdownPct / 10;

    default:
      return pnlPercent;
  }
}

/**
 * Determine the winner of a match based on composite scores.
 *
 * Tiebreakers:
 * 1. Higher composite score wins
 * 2. If within epsilon: higher market diversity wins
 * 3. If still tied: lower max drawdown wins
 * 4. If still tied: fewer trades wins (conviction)
 * 5. If still tied: draw
 */
export function determineWinner(
  challengerScore: MatchScore,
  opponentScore: MatchScore
): "challenger" | "opponent" | "draw" {
  const EPSILON = 0.01;

  const diff = Math.abs(
    challengerScore.compositeScore - opponentScore.compositeScore
  );

  if (diff > EPSILON) {
    return challengerScore.compositeScore > opponentScore.compositeScore
      ? "challenger"
      : "opponent";
  }

  // Tiebreaker 1: higher market diversity (rewards multi-market strategies)
  if (challengerScore.marketDiversity !== opponentScore.marketDiversity) {
    return challengerScore.marketDiversity > opponentScore.marketDiversity
      ? "challenger"
      : "opponent";
  }

  // Tiebreaker 2: lower drawdown
  if (
    Math.abs(challengerScore.maxDrawdownPct - opponentScore.maxDrawdownPct) > 0.1
  ) {
    return challengerScore.maxDrawdownPct < opponentScore.maxDrawdownPct
      ? "challenger"
      : "opponent";
  }

  // Tiebreaker 3: fewer trades (conviction over churn)
  if (challengerScore.tradeCount !== opponentScore.tradeCount) {
    return challengerScore.tradeCount < opponentScore.tradeCount
      ? "challenger"
      : "opponent";
  }

  return "draw";
}
