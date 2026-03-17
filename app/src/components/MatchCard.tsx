"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Match, MatchState, SCORING_LABELS, PROTOCOL_LABELS } from "@/lib/types";

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
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
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

export function MatchCard({ match }: { match: Match }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (match.state !== MatchState.Active) return;

    function update() {
      const remaining = match.endsAt - Date.now() / 1000;
      setTimeLeft(formatTimeRemaining(remaining));
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [match.state, match.endsAt]);

  const progress =
    match.state === MatchState.Active && match.startedAt > 0
      ? Math.min(
          100,
          ((Date.now() / 1000 - match.startedAt) / match.duration) * 100
        )
      : match.state === MatchState.Completed || match.state === MatchState.Draw
      ? 100
      : 0;

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="bg-crucible-card border border-crucible-border rounded-xl p-5 hover:border-crucible-accent/30 transition-all cursor-pointer group">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StateChip state={match.state} />
            <span className="text-xs text-slate-500">
              {PROTOCOL_LABELS[match.protocol]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{SCORING_LABELS[match.scoringMethod]}</span>
            <span>{formatDuration(match.duration)}</span>
          </div>
        </div>

        {/* Entrants */}
        <div className="flex items-center justify-between mb-4">
          {/* Challenger */}
          <div className="flex-1">
            <div className="text-xs text-slate-500 mb-1">Challenger</div>
            <div className="font-mono text-sm text-slate-200">
              {match.challenger.wallet}
            </div>
            {match.state === MatchState.Active && (
              <div className="mt-1">
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
                <span className="text-xs text-slate-500 ml-2">
                  SR: {match.challenger.stats.sharpeRatio.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* VS */}
          <div className="mx-4 text-xs font-bold text-slate-600">VS</div>

          {/* Opponent */}
          <div className="flex-1 text-right">
            {match.opponent ? (
              <>
                <div className="text-xs text-slate-500 mb-1">Opponent</div>
                <div className="font-mono text-sm text-slate-200">
                  {match.opponent.wallet}
                </div>
                {match.state === MatchState.Active && (
                  <div className="mt-1">
                    <span className="text-xs text-slate-500 mr-2">
                      SR: {match.opponent.stats.sharpeRatio.toFixed(2)}
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

        {/* Progress bar (active matches) */}
        {match.state === MatchState.Active && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span>
              <span>{timeLeft}</span>
            </div>
            <div className="h-1.5 bg-crucible-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-crucible-accent to-orange-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
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
