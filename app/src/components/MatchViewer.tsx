"use client";

import { useState, useEffect } from "react";
import { Match, MatchEntrant, SCORING_LABELS } from "@/lib/types";

function EquityChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-600">
        No data yet
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 300;
  const h = 120;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#grad-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VaultPanel({
  entrant,
  label,
  isWinner,
}: {
  entrant: MatchEntrant;
  label: string;
  isWinner: boolean;
}) {
  return (
    <div
      className={`flex-1 bg-crucible-card border rounded-xl p-5 ${
        isWinner
          ? "border-crucible-gold/40"
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
        {isWinner && (
          <span className="text-xs font-bold text-crucible-gold bg-crucible-gold/10 px-2 py-1 rounded">
            WINNER
          </span>
        )}
      </div>

      {/* Equity Chart */}
      <div className="mb-4 bg-crucible-bg/50 rounded-lg p-2">
        <EquityChart
          data={entrant.equityCurve}
          color={entrant.stats.pnlPercent >= 0 ? "#22c55e" : "#ef4444"}
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

      {/* Positions */}
      {entrant.positions.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium">
            Open Positions ({entrant.positions.length})
          </div>
          <div className="space-y-2">
            {entrant.positions.map((pos, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-crucible-bg/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      pos.side === "long"
                        ? "text-crucible-green"
                        : "text-crucible-accent"
                    }`}
                  >
                    {pos.side.toUpperCase()}
                  </span>
                  <span className="text-slate-300">{pos.market}</span>
                  <span className="text-slate-600">{pos.leverage}x</span>
                </div>
                <span
                  className={`font-mono ${
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

  useEffect(() => {
    function update() {
      if (match.endsAt <= 0) {
        setTimeLeft("Not started");
        return;
      }
      const remaining = match.endsAt - Date.now() / 1000;
      if (remaining <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const d = Math.floor(remaining / 86400);
      const h = Math.floor((remaining % 86400) / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = Math.floor(remaining % 60);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match.endsAt]);

  const elapsed =
    match.startedAt > 0
      ? Math.max(0, Date.now() / 1000 - match.startedAt)
      : 0;
  const progress = match.duration > 0 ? Math.min(100, (elapsed / match.duration) * 100) : 0;

  return (
    <div>
      {/* Match header */}
      <div className="bg-crucible-card border border-crucible-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Match #{match.id}</h2>
            <span className="text-xs text-slate-500">
              {SCORING_LABELS[match.scoringMethod]} scoring
            </span>
          </div>
          <div className="text-sm font-mono text-slate-300">
            {timeLeft}
          </div>
        </div>

        {/* Progress */}
        <div className="h-2 bg-crucible-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-crucible-accent to-orange-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>Stake: {match.stakeAmount} USDC</span>
          <span>Capital: {match.capitalAmount.toLocaleString()} USDC</span>
          <span>Max Leverage: {match.maxLeverage}x</span>
          <span>Drift Protocol</span>
        </div>
      </div>

      {/* Side-by-side vaults */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VaultPanel
          entrant={match.challenger}
          label="Challenger"
          isWinner={match.winner === match.challenger.wallet}
        />
        {match.opponent ? (
          <VaultPanel
            entrant={match.opponent}
            label="Opponent"
            isWinner={match.winner === match.opponent.wallet}
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
