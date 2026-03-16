import { describe, it, expect } from "vitest";
import {
  computePnlPercent,
  computeSharpe,
  computeMaxDrawdown,
  computeScore,
  determineWinner,
} from "./scoring";
import { VaultSnapshot, EquityPoint, ScoringMethod } from "./types";

function makeSnapshot(overrides: Partial<VaultSnapshot> = {}): VaultSnapshot {
  return {
    vaultId: "test-vault",
    timestamp: 0,
    equityUsd: 10000,
    depositedUsd: 10000,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    totalPnlUsd: 0,
    positions: [],
    tradeCount: 0,
    peakEquityUsd: 10000,
    maxDrawdownPct: 0,
    ...overrides,
  };
}

describe("computePnlPercent", () => {
  it("computes positive PnL", () => {
    const start = makeSnapshot({ equityUsd: 10000 });
    const end = makeSnapshot({ equityUsd: 11500 });
    expect(computePnlPercent(start, end)).toBeCloseTo(15.0);
  });

  it("computes negative PnL", () => {
    const start = makeSnapshot({ equityUsd: 10000 });
    const end = makeSnapshot({ equityUsd: 8000 });
    expect(computePnlPercent(start, end)).toBeCloseTo(-20.0);
  });

  it("returns 0 for zero starting equity", () => {
    const start = makeSnapshot({ equityUsd: 0 });
    const end = makeSnapshot({ equityUsd: 1000 });
    expect(computePnlPercent(start, end)).toBe(0);
  });
});

describe("computeSharpe", () => {
  it("returns 0 for insufficient data", () => {
    expect(computeSharpe([])).toBe(0);
    expect(computeSharpe([{ timestamp: 0, equityUsd: 100 }])).toBe(0);
  });

  it("returns positive Sharpe for consistently profitable curve", () => {
    // Steadily increasing equity: 100 -> 101 -> 102 -> ... -> 110
    const curve: EquityPoint[] = Array.from({ length: 11 }, (_, i) => ({
      timestamp: i * 3600, // hourly
      equityUsd: 10000 + i * 100,
    }));
    const sharpe = computeSharpe(curve);
    expect(sharpe).toBeGreaterThan(0);
  });

  it("returns negative Sharpe for consistently losing curve", () => {
    const curve: EquityPoint[] = Array.from({ length: 11 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 - i * 100,
    }));
    const sharpe = computeSharpe(curve);
    expect(sharpe).toBeLessThan(0);
  });

  it("high-variance curve has lower Sharpe than smooth curve", () => {
    // Smooth: steady 1% per period
    const smooth: EquityPoint[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 * (1.01 ** i),
    }));

    // Volatile: same total return but with swings
    const volatile: EquityPoint[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 * (1.01 ** i) + (i % 2 === 0 ? 200 : -200),
    }));

    expect(computeSharpe(smooth)).toBeGreaterThan(computeSharpe(volatile));
  });
});

describe("computeMaxDrawdown", () => {
  it("returns 0 for monotonically increasing curve", () => {
    const curve: EquityPoint[] = [
      { timestamp: 0, equityUsd: 100 },
      { timestamp: 1, equityUsd: 110 },
      { timestamp: 2, equityUsd: 120 },
    ];
    expect(computeMaxDrawdown(curve)).toBe(0);
  });

  it("computes correct drawdown", () => {
    const curve: EquityPoint[] = [
      { timestamp: 0, equityUsd: 100 },
      { timestamp: 1, equityUsd: 120 }, // peak
      { timestamp: 2, equityUsd: 90 },  // 25% drawdown from 120
      { timestamp: 3, equityUsd: 110 },
    ];
    expect(computeMaxDrawdown(curve)).toBeCloseTo(25.0);
  });

  it("finds the worst drawdown across multiple dips", () => {
    const curve: EquityPoint[] = [
      { timestamp: 0, equityUsd: 100 },
      { timestamp: 1, equityUsd: 110 },
      { timestamp: 2, equityUsd: 100 }, // 9.09% dd
      { timestamp: 3, equityUsd: 130 },
      { timestamp: 4, equityUsd: 91 },  // 30% dd from 130
      { timestamp: 5, equityUsd: 120 },
    ];
    expect(computeMaxDrawdown(curve)).toBeCloseTo(30.0);
  });
});

describe("determineWinner", () => {
  const baseScore = {
    pnlPercent: 10,
    sharpeRatio: 2.0,
    maxDrawdownPct: 5,
    tradeCount: 20,
    avgLeverage: 3,
    finalEquityUsd: 11000,
    compositeScore: 10,
  };

  it("higher composite score wins", () => {
    const challenger = { ...baseScore, compositeScore: 12 };
    const opponent = { ...baseScore, compositeScore: 8 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("tiebreaker: lower drawdown wins", () => {
    const challenger = { ...baseScore, compositeScore: 10, maxDrawdownPct: 3 };
    const opponent = { ...baseScore, compositeScore: 10, maxDrawdownPct: 8 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("tiebreaker: fewer trades wins", () => {
    const challenger = { ...baseScore, compositeScore: 10, maxDrawdownPct: 5, tradeCount: 10 };
    const opponent = { ...baseScore, compositeScore: 10, maxDrawdownPct: 5, tradeCount: 30 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("returns draw when all tiebreakers equal", () => {
    expect(determineWinner(baseScore, baseScore)).toBe("draw");
  });
});

describe("computeScore", () => {
  it("produces a valid score with PnlPercent method", () => {
    const start = makeSnapshot({ equityUsd: 10000, timestamp: 0 });
    const end = makeSnapshot({
      equityUsd: 11500,
      timestamp: 86400,
      tradeCount: 15,
      positions: [
        { market: "SOL-PERP", side: "long", sizeUsd: 5000, entryPrice: 150, markPrice: 160, leverage: 5, pnlUsd: 333 },
      ],
    });
    const curve: EquityPoint[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 + (1500 * i) / 24,
    }));

    const score = computeScore(start, end, curve, ScoringMethod.PnlPercent);

    expect(score.pnlPercent).toBeCloseTo(15.0);
    expect(score.compositeScore).toBeCloseTo(15.0); // PnlPercent method
    expect(score.tradeCount).toBe(15);
    expect(score.avgLeverage).toBe(5);
    expect(score.sharpeRatio).toBeGreaterThan(0);
  });
});
