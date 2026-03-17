"use client";

import { useState, useEffect, useRef } from "react";
import { Match, MatchEntrant, MatchState, ScoringMethod, SCORING_LABELS } from "@/lib/types";

function EquityChart({
  data,
  color,
  animate,
}: {
  data: number[];
  color: string;
  animate?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(animate ? 2 : data.length);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animate || data.length < 2) return;
    setVisibleCount(2);

    intervalRef.current = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= data.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return data.length;
        }
        return prev + 1;
      });
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animate, data.length]);

  const visibleData = data.slice(0, visibleCount);

  if (visibleData.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-600">
        No data yet
      </div>
    );
  }

  const min = Math.min(...visibleData);
  const max = Math.max(...visibleData);
  const range = max - min || 1;
  const w = 300;
  const h = 120;
  const points = visibleData
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gradientId = `grad-${color.replace("#", "")}-${animate ? "a" : "s"}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${(visibleData.length - 1) / (data.length - 1) * w},${h}`}
        fill={`url(#${gradientId})`}
        className="transition-all duration-500"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      {/* Current point dot */}
      {visibleData.length > 0 && (() => {
        const lastVal = visibleData[visibleData.length - 1];
        const cx = ((visibleData.length - 1) / (data.length - 1)) * w;
        const cy = h - ((lastVal - min) / range) * (h - 8) - 4;
        return (
          <circle
            cx={cx}
            cy={cy}
            r="3"
            fill={color}
            className="animate-pulse"
          />
        );
      })()}
    </svg>
  );
}

function StatsComparison({
  challenger,
  opponent,
  scoringMethod,
}: {
  challenger: MatchEntrant;
  opponent: MatchEntrant;
  scoringMethod: ScoringMethod;
}) {
  const rows = [
    {
      label: "PnL %",
      a: `${challenger.stats.pnlPercent >= 0 ? "+" : ""}${challenger.stats.pnlPercent.toFixed(2)}%`,
      b: `${opponent.stats.pnlPercent >= 0 ? "+" : ""}${opponent.stats.pnlPercent.toFixed(2)}%`,
      aVal: challenger.stats.pnlPercent,
      bVal: opponent.stats.pnlPercent,
      higherBetter: true,
      isScoring: scoringMethod === ScoringMethod.PnlPercent,
    },
    {
      label: "Sharpe",
      a: challenger.stats.sharpeRatio.toFixed(2),
      b: opponent.stats.sharpeRatio.toFixed(2),
      aVal: challenger.stats.sharpeRatio,
      bVal: opponent.stats.sharpeRatio,
      higherBetter: true,
      isScoring: scoringMethod === ScoringMethod.Sharpe,
    },
    {
      label: "Max DD",
      a: `${challenger.stats.maxDrawdown.toFixed(2)}%`,
      b: `${opponent.stats.maxDrawdown.toFixed(2)}%`,
      aVal: challenger.stats.maxDrawdown,
      bVal: opponent.stats.maxDrawdown,
      higherBetter: true, // less negative = higher = better
      isScoring: false,
    },
    {
      label: "# Trades",
      a: challenger.stats.tradeCount.toString(),
      b: opponent.stats.tradeCount.toString(),
      aVal: challenger.stats.tradeCount,
      bVal: opponent.stats.tradeCount,
      higherBetter: false, // neutral
      isScoring: false,
    },
    {
      label: "Avg Leverage",
      a: `${challenger.stats.avgLeverage.toFixed(1)}x`,
      b: `${opponent.stats.avgLeverage.toFixed(1)}x`,
      aVal: challenger.stats.avgLeverage,
      bVal: opponent.stats.avgLeverage,
      higherBetter: false, // neutral
      isScoring: false,
    },
  ];

  return (
    <div className="bg-crucible-card border border-crucible-border rounded-xl p-4 mb-6">
      <h3 className="text-sm font-bold text-slate-300 mb-3">Stats Comparison</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-crucible-border">
            <th className="text-left py-2 font-medium">Challenger</th>
            <th className="text-center py-2 font-medium">Metric</th>
            <th className="text-right py-2 font-medium">Opponent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const aWins = row.higherBetter
              ? row.aVal > row.bVal
              : row.aVal < row.bVal;
            const bWins = row.higherBetter
              ? row.bVal > row.aVal
              : row.bVal < row.aVal;
            const isDraw = row.aVal === row.bVal;

            return (
              <tr
                key={row.label}
                className="border-b border-crucible-border/50"
              >
                <td className="py-2 text-left">
                  <span
                    className={`font-mono ${
                      aWins && !isDraw
                        ? "text-crucible-green font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {row.a}
                  </span>
                </td>
                <td className="py-2 text-center">
                  <span
                    className={`${
                      row.isScoring
                        ? "text-crucible-accent font-bold"
                        : "text-slate-500"
                    }`}
                  >
                    {row.label}
                    {row.isScoring && " *"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`font-mono ${
                      bWins && !isDraw
                        ? "text-crucible-green font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {row.b}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[10px] text-slate-600">
        * Scoring metric for this match
      </div>
    </div>
  );
}

function VaultPanel({
  entrant,
  label,
  isWinner,
  isLeading,
  matchState,
}: {
  entrant: MatchEntrant;
  label: string;
  isWinner: boolean;
  isLeading: boolean;
  matchState: MatchState;
}) {
  return (
    <div
      className={`flex-1 bg-crucible-card border rounded-xl p-5 ${
        isWinner
          ? "border-crucible-gold/40"
          : isLeading
          ? "border-crucible-green/30"
          : "border-crucible-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-slate-500 mb-0.5">{label}</div>
          <div className="font-mono text-sm text-slate-200">
            {entrant.wallet}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLeading && matchState === MatchState.Active && (
            <span className="text-[10px] font-bold text-crucible-green bg-crucible-green/10 px-2 py-1 rounded border border-crucible-green/20">
              LEADING
            </span>
          )}
          {isWinner && (
            <span className="text-xs font-bold text-crucible-gold bg-crucible-gold/10 px-2 py-1 rounded">
              WINNER
            </span>
          )}
        </div>
      </div>

      {/* Equity Chart */}
      <div className="mb-4 bg-crucible-bg/50 rounded-lg p-2">
        <EquityChart
          data={entrant.equityCurve}
          color={entrant.stats.pnlPercent >= 0 ? "#22c55e" : "#ef4444"}
          animate={matchState === MatchState.Active}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            Equity
          </div>
          <div className="text-sm font-mono text-slate-200">
            ${entrant.stats.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            PnL %
          </div>
          <div
            className={`text-sm font-mono font-bold ${
              entrant.stats.pnlPercent >= 0
                ? "text-crucible-green"
                : "text-crucible-accent"
            }`}
          >
            {entrant.stats.pnlPercent >= 0 ? "+" : ""}
            {entrant.stats.pnlPercent.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            Sharpe
          </div>
          <div className="text-sm font-mono text-slate-200">
            {entrant.stats.sharpeRatio.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            Max DD
          </div>
          <div className="text-sm font-mono text-crucible-accent">
            {entrant.stats.maxDrawdown.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            Trades
          </div>
          <div className="text-sm font-mono text-slate-200">
            {entrant.stats.tradeCount}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            Avg Lev
          </div>
          <div className="text-sm font-mono text-slate-200">
            {entrant.stats.avgLeverage.toFixed(1)}x
          </div>
        </div>
      </div>

      {/* Positions with side indicators */}
      {entrant.positions.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium">
            Open Positions ({entrant.positions.length})
          </div>
          <div className="space-y-2">
            {entrant.positions.map((pos, i) => (
              <div
                key={i}
                className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 border ${
                  pos.side === "long"
                    ? "bg-crucible-green/5 border-crucible-green/15"
                    : "bg-crucible-accent/5 border-crucible-accent/15"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      pos.side === "long"
                        ? "text-crucible-green bg-crucible-green/10"
                        : "text-crucible-accent bg-crucible-accent/10"
                    }`}
                  >
                    {pos.side.toUpperCase()}
                  </span>
                  <span className="text-slate-300 font-medium">{pos.market}</span>
                  <span className="text-slate-600">{pos.leverage}x</span>
                </div>
                <span
                  className={`font-mono font-bold ${
                    pos.pnl >= 0
                      ? "text-crucible-green"
                      : "text-crucible-accent"
                  }`}
                >
                  {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {entrant.positions.length === 0 && entrant.stats.tradeCount > 0 && (
        <div className="text-xs text-slate-600 text-center py-2">
          All positions closed
        </div>
      )}
    </div>
  );
}

export function MatchViewer({ match }: { match: Match }) {
  const [timeLeft, setTimeLeft] = useState<string>("--");
  const [progress, setProgress] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function update() {
      const now = Date.now() / 1000;

      if (match.endsAt <= 0) {
        setTimeLeft("Not started");
        setProgress(0);
        return;
      }
      const remaining = match.endsAt - now;
      if (remaining <= 0) {
        setTimeLeft("Ended");
        setProgress(100);
        return;
      }

      const d = Math.floor(remaining / 86400);
      const h = Math.floor((remaining % 86400) / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = Math.floor(remaining % 60);
      const pad = (n: number) => n.toString().padStart(2, "0");
      if (d > 0) setTimeLeft(`${d}d ${pad(h)}:${pad(m)}:${pad(s)}`);
      else if (h > 0) setTimeLeft(`${h}:${pad(m)}:${pad(s)}`);
      else setTimeLeft(`${pad(m)}:${pad(s)}`);

      if (match.startedAt > 0 && match.duration > 0) {
        const elapsed = Math.max(0, now - match.startedAt);
        setProgress(Math.min(100, (elapsed / match.duration) * 100));
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match.endsAt, match.startedAt, match.duration]);

  // Determine who is leading based on scoring method
  const challengerScore = getScore(match.challenger, match.scoringMethod);
  const opponentScore = match.opponent
    ? getScore(match.opponent, match.scoringMethod)
    : -Infinity;
  const challengerLeading = challengerScore > opponentScore;
  const opponentLeading = opponentScore > challengerScore;

  const isUrgent = mounted && match.endsAt > 0 && match.endsAt - Date.now() / 1000 < 3600 && match.endsAt - Date.now() / 1000 > 0;
  const isExpired = mounted && match.endsAt > 0 && match.endsAt - Date.now() / 1000 <= 0;

  return (
    <div>
      {/* Match header */}
      <div className="bg-crucible-card border border-crucible-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Match #{match.id}</h2>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/30">
              {SCORING_LABELS[match.scoringMethod]}
            </span>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30">
              Drift
            </span>
          </div>
          <div className="flex items-center gap-2">
            {mounted && (
              <span
                className={`text-sm font-mono font-bold ${
                  isExpired
                    ? "text-crucible-gold"
                    : isUrgent
                    ? "text-crucible-accent"
                    : "text-slate-300"
                }`}
              >
                {isExpired ? "SETTLING" : timeLeft}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-crucible-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isExpired
                ? "bg-crucible-gold"
                : isUrgent
                ? "bg-crucible-accent"
                : "bg-gradient-to-r from-crucible-accent to-orange-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>Stake: {match.stakeAmount} USDC</span>
          <span>Capital: {match.capitalAmount.toLocaleString()} USDC</span>
          <span>Max Leverage: {match.maxLeverage}x</span>
          <span>{Math.floor(match.duration / 60)}m duration</span>
        </div>
      </div>

      {/* Stats comparison table (only when both vaults exist) */}
      {match.opponent && (
        <StatsComparison
          challenger={match.challenger}
          opponent={match.opponent}
          scoringMethod={match.scoringMethod}
        />
      )}

      {/* Side-by-side vaults */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VaultPanel
          entrant={match.challenger}
          label="Challenger"
          isWinner={match.winner === match.challenger.wallet}
          isLeading={challengerLeading && match.state === MatchState.Active && !!match.opponent}
          matchState={match.state}
        />
        {match.opponent ? (
          <VaultPanel
            entrant={match.opponent}
            label="Opponent"
            isWinner={match.winner === match.opponent.wallet}
            isLeading={opponentLeading && match.state === MatchState.Active}
            matchState={match.state}
          />
        ) : (
          <div className="flex-1 bg-crucible-card border border-dashed border-crucible-border rounded-xl p-5 flex items-center justify-center">
            <div className="text-center">
              <div className="text-slate-600 text-sm mb-2">
                No opponent yet
              </div>
              <button className="px-4 py-2 bg-crucible-accent text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors">
                Accept Challenge
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getScore(entrant: MatchEntrant, method: ScoringMethod): number {
  switch (method) {
    case ScoringMethod.PnlPercent:
      return entrant.stats.pnlPercent;
    case ScoringMethod.Sharpe:
      return entrant.stats.sharpeRatio;
    case ScoringMethod.RiskAdjusted:
      // Risk-adjusted: Sharpe * (1 - |maxDD|/100)
      return (
        entrant.stats.sharpeRatio *
        (1 - Math.abs(entrant.stats.maxDrawdown) / 100)
      );
  }
}
