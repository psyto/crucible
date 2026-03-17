"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Match, MatchState, ScoringMethod, SCORING_LABELS, PROTOCOL_LABELS } from "@/lib/types";

function formatDuration(seconds: number): string {
  if (seconds >= 604800) return `${Math.round(seconds / 604800)}w`;
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 60)}m`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ended";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function StateChip({ state }: { state: MatchState }) {
  const styles: Record<MatchState, string> = {
    [MatchState.Open]: "bg-crucible-gold/10 text-crucible-gold border-crucible-gold/30",
    [MatchState.Active]: "bg-crucible-green/10 text-crucible-green border-crucible-green/30",
    [MatchState.Settling]: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    [MatchState.Completed]: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    [MatchState.Cancelled]: "bg-slate-500/10 text-slate-600 border-slate-500/30",
    [MatchState.Draw]: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  };

  const labels: Record<MatchState, string> = {
    [MatchState.Open]: "OPEN",
    [MatchState.Active]: "LIVE",
    [MatchState.Settling]: "SETTLING",
    [MatchState.Completed]: "COMPLETED",
    [MatchState.Cancelled]: "CANCELLED",
    [MatchState.Draw]: "DRAW",
  };

  return (
    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

function ScoringBadge({ method }: { method: ScoringMethod }) {
  const colors: Record<ScoringMethod, string> = {
    [ScoringMethod.PnlPercent]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    [ScoringMethod.Sharpe]: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    [ScoringMethod.RiskAdjusted]: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  };

  return (
    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${colors[method]}`}>
      {SCORING_LABELS[method]}
    </span>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  return (
    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30">
      {protocol}
    </span>
  );
}

/** Compact SVG sparkline showing equity curve */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 120;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gradientId = `spark-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function update() {
      const now = Date.now() / 1000;

      if (match.state === MatchState.Active) {
        const remaining = match.endsAt - now;
        setTimeLeft(formatTimeRemaining(remaining));

        if (match.startedAt > 0 && match.duration > 0) {
          const elapsed = Math.max(0, now - match.startedAt);
          setProgress(Math.min(100, (elapsed / match.duration) * 100));
        }
      } else if (
        match.state === MatchState.Completed ||
        match.state === MatchState.Draw
      ) {
        setTimeLeft("Ended");
        setProgress(100);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match.state, match.endsAt, match.startedAt, match.duration]);

  const isUrgent = mounted && match.state === MatchState.Active && match.endsAt - Date.now() / 1000 < 3600;
  const isExpired = mounted && match.state === MatchState.Active && match.endsAt - Date.now() / 1000 <= 0;

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="bg-crucible-card border border-crucible-border rounded-xl p-5 hover:border-crucible-accent/30 transition-all cursor-pointer group">
        {/* Header: state + badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StateChip state={match.state} />
            <ProtocolBadge protocol={PROTOCOL_LABELS[match.protocol].replace(" Protocol", "")} />
          </div>
          <div className="flex items-center gap-2">
            <ScoringBadge method={match.scoringMethod} />
            <span className="text-xs text-slate-500">{formatDuration(match.duration)}</span>
          </div>
        </div>

        {/* Entrants with sparklines */}
        <div className="flex items-stretch justify-between mb-3 gap-3">
          {/* Challenger */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-1">Challenger</div>
            <div className="font-mono text-sm text-slate-200 truncate">
              {match.challenger.wallet}
            </div>
            {match.state === MatchState.Active && (
              <>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-sm font-bold ${
                      match.challenger.stats.pnlPercent >= 0
                        ? "text-crucible-green"
                        : "text-crucible-accent"
                    }`}
                  >
                    {match.challenger.stats.pnlPercent >= 0 ? "+" : ""}
                    {match.challenger.stats.pnlPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500">
                    SR {match.challenger.stats.sharpeRatio.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    DD {match.challenger.stats.maxDrawdown.toFixed(1)}%
                  </span>
                </div>
                {match.challenger.equityCurve.length >= 2 && (
                  <div className="mt-1.5">
                    <Sparkline
                      data={match.challenger.equityCurve}
                      color={match.challenger.stats.pnlPercent >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* VS */}
          <div className="flex items-center px-2">
            <span className="text-xs font-bold text-slate-600">VS</span>
          </div>

          {/* Opponent */}
          <div className="flex-1 min-w-0 text-right">
            {match.opponent ? (
              <>
                <div className="text-xs text-slate-500 mb-1">Opponent</div>
                <div className="font-mono text-sm text-slate-200 truncate">
                  {match.opponent.wallet}
                </div>
                {match.state === MatchState.Active && (
                  <>
                    <div className="mt-1 flex items-center gap-2 justify-end flex-wrap">
                      <span className="text-[10px] text-slate-600">
                        DD {match.opponent.stats.maxDrawdown.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500">
                        SR {match.opponent.stats.sharpeRatio.toFixed(2)}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          match.opponent.stats.pnlPercent >= 0
                            ? "text-crucible-green"
                            : "text-crucible-accent"
                        }`}
                      >
                        {match.opponent.stats.pnlPercent >= 0 ? "+" : ""}
                        {match.opponent.stats.pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                    {match.opponent.equityCurve.length >= 2 && (
                      <div className="mt-1.5">
                        <Sparkline
                          data={match.opponent.equityCurve}
                          color={match.opponent.stats.pnlPercent >= 0 ? "#22c55e" : "#ef4444"}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div>
                <div className="text-xs text-slate-500 mb-1">Opponent</div>
                <div className="text-sm text-crucible-gold font-medium">
                  Awaiting challenger...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timer with progress bar (DuelTimer pattern) */}
        {match.state === MatchState.Active && mounted && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500">
                {Math.floor(match.duration / 60)}m total
              </span>
              <span
                className={`font-mono font-bold ${
                  isExpired
                    ? "text-crucible-gold"
                    : isUrgent
                    ? "text-crucible-accent"
                    : "text-slate-300"
                }`}
              >
                {isExpired ? "SETTLING" : timeLeft}
              </span>
            </div>
            <div className="h-2 bg-crucible-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExpired
                    ? "bg-crucible-gold"
                    : isUrgent
                    ? "bg-crucible-accent"
                    : "bg-gradient-to-r from-crucible-accent to-orange-500"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1">
              <span>Start</span>
              <span>End</span>
            </div>
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-3 border-t border-crucible-border">
          <div className="text-xs text-slate-500">
            Stake: <span className="text-slate-300">{match.stakeAmount} USDC</span>
          </div>
          <div className="text-xs text-slate-500">
            Capital: <span className="text-slate-300">{match.capitalAmount.toLocaleString()} USDC</span>
          </div>
          <div className="text-xs text-slate-500">
            Max Lev: <span className="text-slate-300">{match.maxLeverage}x</span>
          </div>
        </div>

        {/* Winner banner */}
        {match.state === MatchState.Completed && match.winner && (
          <div className="mt-3 py-2 px-3 bg-crucible-gold/10 border border-crucible-gold/20 rounded-lg">
            <span className="text-xs text-crucible-gold font-medium">
              Winner: {match.winner}
            </span>
          </div>
        )}
        {match.state === MatchState.Draw && (
          <div className="mt-3 py-2 px-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
            <span className="text-xs text-slate-400 font-medium">
              Match ended in a draw
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
