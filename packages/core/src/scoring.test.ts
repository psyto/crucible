import { describe, it, expect } from "vitest";
import {
  computePnlPercent,
  computeSharpe,
  computeMaxDrawdown,
  computeMarketDiversity,
  computeDiversityPenalty,
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

const baseScore = {
  pnlPercent: 10,
  sharpeRatio: 2.0,
  maxDrawdownPct: 5,
  tradeCount: 20,
  avgLeverage: 3,
  finalEquityUsd: 11000,
  marketDiversity: 3,
  diversityPenalty: 0,
  compositeScore: 10,
};

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
    const curve: EquityPoint[] = Array.from({ length: 11 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 + i * 100,
    }));
    expect(computeSharpe(curve)).toBeGreaterThan(0);
  });

  it("returns negative Sharpe for consistently losing curve", () => {
    const curve: EquityPoint[] = Array.from({ length: 11 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 - i * 100,
    }));
    expect(computeSharpe(curve)).toBeLessThan(0);
  });

  it("smooth curve has higher Sharpe than volatile curve with same return", () => {
    const smooth: EquityPoint[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 * (1.01 ** i),
    }));
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
      { timestamp: 1, equityUsd: 120 },
      { timestamp: 2, equityUsd: 90 },
      { timestamp: 3, equityUsd: 110 },
    ];
    expect(computeMaxDrawdown(curve)).toBeCloseTo(25.0);
  });

  it("finds the worst drawdown across multiple dips", () => {
    const curve: EquityPoint[] = [
      { timestamp: 0, equityUsd: 100 },
      { timestamp: 1, equityUsd: 110 },
      { timestamp: 2, equityUsd: 100 },
      { timestamp: 3, equityUsd: 130 },
      { timestamp: 4, equityUsd: 91 },
      { timestamp: 5, equityUsd: 120 },
    ];
    expect(computeMaxDrawdown(curve)).toBeCloseTo(30.0);
  });
});

// ─── Anti-MEV Guardrails ─────────────────────────────────────────────────────

describe("computeMarketDiversity", () => {
  it("returns 0 for no positions", () => {
    expect(computeMarketDiversity(makeSnapshot({ positions: [] }))).toBe(0);
  });

  it("returns 1 for single-market positions", () => {
    const snapshot = makeSnapshot({
      positions: [
        { market: "SOL-PERP", side: "long", sizeUsd: 1000, entryPrice: 100, markPrice: 105, leverage: 5, pnlUsd: 50 },
        { market: "SOL-PERP", side: "short", sizeUsd: 500, entryPrice: 105, markPrice: 103, leverage: 3, pnlUsd: 10 },
      ],
    });
    expect(computeMarketDiversity(snapshot)).toBe(1);
  });

  it("counts distinct markets", () => {
    const snapshot = makeSnapshot({
      positions: [
        { market: "SOL-PERP", side: "long", sizeUsd: 1000, entryPrice: 100, markPrice: 105, leverage: 5, pnlUsd: 50 },
        { market: "ETH-PERP", side: "short", sizeUsd: 500, entryPrice: 2000, markPrice: 1950, leverage: 3, pnlUsd: 25 },
        { market: "BTC-PERP", side: "long", sizeUsd: 800, entryPrice: 60000, markPrice: 61000, leverage: 2, pnlUsd: 13 },
      ],
    });
    expect(computeMarketDiversity(snapshot)).toBe(3);
  });
});

describe("computeDiversityPenalty", () => {
  it("no penalty when diversity meets minimum", () => {
    expect(computeDiversityPenalty(3, 3)).toBe(0);
    expect(computeDiversityPenalty(5, 3)).toBe(0);
  });

  it("no penalty when minimum is 1", () => {
    expect(computeDiversityPenalty(1, 1)).toBe(0);
  });

  it("penalty for insufficient diversity", () => {
    // Need 3 markets, have 1 -> missing 2 -> penalty = 4.0
    expect(computeDiversityPenalty(1, 3)).toBe(4.0);
  });

  it("penalty proportional to missing markets", () => {
    expect(computeDiversityPenalty(0, 3)).toBe(6.0); // missing 3
    expect(computeDiversityPenalty(2, 3)).toBe(2.0); // missing 1
  });
});

describe("computeScore with diversity", () => {
  it("applies diversity penalty to composite score", () => {
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

    // Without diversity requirement
    const scoreNoDiversity = computeScore(start, end, curve, ScoringMethod.PnlPercent, 1);
    expect(scoreNoDiversity.diversityPenalty).toBe(0);
    expect(scoreNoDiversity.marketDiversity).toBe(1);

    // With diversity requirement of 3 (only trading 1 market -> penalty)
    const scoreWithDiversity = computeScore(start, end, curve, ScoringMethod.PnlPercent, 3);
    expect(scoreWithDiversity.diversityPenalty).toBe(4.0); // missing 2 markets
    expect(scoreWithDiversity.compositeScore).toBeLessThan(scoreNoDiversity.compositeScore);
  });

  it("no penalty when trading enough markets", () => {
    const start = makeSnapshot({ equityUsd: 10000, timestamp: 0 });
    const end = makeSnapshot({
      equityUsd: 11000,
      timestamp: 86400,
      tradeCount: 10,
      positions: [
        { market: "SOL-PERP", side: "long", sizeUsd: 2000, entryPrice: 100, markPrice: 105, leverage: 3, pnlUsd: 100 },
        { market: "ETH-PERP", side: "short", sizeUsd: 1500, entryPrice: 2000, markPrice: 1950, leverage: 2, pnlUsd: 37 },
        { market: "BTC-PERP", side: "long", sizeUsd: 1000, entryPrice: 60000, markPrice: 61000, leverage: 2, pnlUsd: 17 },
      ],
    });
    const curve: EquityPoint[] = Array.from({ length: 25 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 + (1000 * i) / 24,
    }));

    const score = computeScore(start, end, curve, ScoringMethod.PnlPercent, 3);
    expect(score.diversityPenalty).toBe(0);
    expect(score.marketDiversity).toBe(3);
  });
});

describe("determineWinner", () => {
  it("higher composite score wins", () => {
    const challenger = { ...baseScore, compositeScore: 12 };
    const opponent = { ...baseScore, compositeScore: 8 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("tiebreaker: higher market diversity wins", () => {
    const challenger = { ...baseScore, compositeScore: 10, marketDiversity: 4 };
    const opponent = { ...baseScore, compositeScore: 10, marketDiversity: 2 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("tiebreaker: lower drawdown wins", () => {
    const challenger = { ...baseScore, compositeScore: 10, marketDiversity: 3, maxDrawdownPct: 3 };
    const opponent = { ...baseScore, compositeScore: 10, marketDiversity: 3, maxDrawdownPct: 8 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("tiebreaker: fewer trades wins", () => {
    const challenger = { ...baseScore, compositeScore: 10, marketDiversity: 3, maxDrawdownPct: 5, tradeCount: 10 };
    const opponent = { ...baseScore, compositeScore: 10, marketDiversity: 3, maxDrawdownPct: 5, tradeCount: 30 };
    expect(determineWinner(challenger, opponent)).toBe("challenger");
  });

  it("returns draw when all tiebreakers equal", () => {
    expect(determineWinner(baseScore, baseScore)).toBe("draw");
  });

  it("single-market predator loses to diverse strategy at same PnL", () => {
    // Predator: high PnL on one market (mirror-inverse), gets diversity penalty
    const predator = {
      ...baseScore,
      pnlPercent: 15,
      marketDiversity: 1,
      diversityPenalty: 4.0,
      compositeScore: 15 - 4.0, // = 11
    };
    // Diverse strategy: lower PnL but trades 3 markets, no penalty
    const diverse = {
      ...baseScore,
      pnlPercent: 12,
      marketDiversity: 3,
      diversityPenalty: 0,
      compositeScore: 12,
    };
    expect(determineWinner(diverse, predator)).toBe("challenger");
  });
});

describe("Sharpe resists counter-trading", () => {
  it("counter-trading strategy has lower Sharpe than smooth strategy", () => {
    // Smooth strategy: steady gains
    const smoothCurve: EquityPoint[] = Array.from({ length: 50 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 * (1.002 ** i), // 0.2% per period
    }));

    // Counter-trading: volatile (mirroring opponent, some wins some losses)
    const counterCurve: EquityPoint[] = Array.from({ length: 50 }, (_, i) => ({
      timestamp: i * 3600,
      equityUsd: 10000 + (i % 2 === 0 ? 300 : -250) + i * 10,
    }));

    const smoothSharpe = computeSharpe(smoothCurve);
    const counterSharpe = computeSharpe(counterCurve);

    // Smooth strategy should have much higher Sharpe
    expect(smoothSharpe).toBeGreaterThan(counterSharpe);
  });
});
