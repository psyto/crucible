/**
 * Crucible Scoring Engine
 *
 * Computes match scores from vault snapshots.
 * Supports multiple scoring methods: PnL%, Sharpe, risk-adjusted.
 */

import {
  VaultSnapshot,
  EquityPoint,
  MatchScore,
  ScoringMethod,
} from "./types";

/**
 * Compute the final score for a match entrant.
 */
export function computeScore(
  startSnapshot: VaultSnapshot,
  endSnapshot: VaultSnapshot,
  equityCurve: EquityPoint[],
  method: ScoringMethod
): MatchScore {
  const pnlPercent = computePnlPercent(startSnapshot, endSnapshot);
  const sharpeRatio = computeSharpe(equityCurve);
  const maxDrawdownPct = computeMaxDrawdown(equityCurve);
  const avgLeverage = computeAvgLeverage(endSnapshot);

  const compositeScore = computeComposite(
    pnlPercent,
    sharpeRatio,
    maxDrawdownPct,
    method
  );

  return {
    pnlPercent,
    sharpeRatio,
    maxDrawdownPct,
    tradeCount: endSnapshot.tradeCount,
    avgLeverage,
    finalEquityUsd: endSnapshot.equityUsd,
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
 * We use hourly returns and annualize with sqrt(8760).
 */
export function computeSharpe(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 3) return 0;

  // Compute period returns
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

  // Estimate periods per year based on actual time span
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
      // Pure PnL — sprint format
      return pnlPercent;

    case ScoringMethod.Sharpe:
      // Pure Sharpe — marathon format
      return sharpeRatio;

    case ScoringMethod.RiskAdjusted:
      // Sharpe with drawdown penalty
      // Penalty: lose 1 point of Sharpe for every 10% drawdown
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
 * 2. If within epsilon: lower max drawdown wins
 * 3. If still tied: fewer trades wins (conviction)
 * 4. If still tied: draw
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

  // Tiebreaker 1: lower drawdown
  if (
    Math.abs(challengerScore.maxDrawdownPct - opponentScore.maxDrawdownPct) > 0.1
  ) {
    return challengerScore.maxDrawdownPct < opponentScore.maxDrawdownPct
      ? "challenger"
      : "opponent";
  }

  // Tiebreaker 2: fewer trades (conviction over churn)
  if (challengerScore.tradeCount !== opponentScore.tradeCount) {
    return challengerScore.tradeCount < opponentScore.tradeCount
      ? "challenger"
      : "opponent";
  }

  return "draw";
}
