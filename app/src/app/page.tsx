"use client";

import { useState } from "react";
import { MOCK_MATCHES, MOCK_LEADERBOARD } from "@/lib/mock-data";
import { MatchState } from "@/lib/types";
import { MatchCard } from "@/components/MatchCard";
import { CreateMatchModal } from "@/components/CreateMatchModal";

const activeMatches = MOCK_MATCHES.filter((m) => m.state === MatchState.Active);
const openChallenges = MOCK_MATCHES.filter((m) => m.state === MatchState.Open);
const topStrategists = MOCK_LEADERBOARD.slice(0, 5);

export default function HomePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16">
        <h1 className="text-5xl sm:text-6xl font-black mb-4">
          <span className="bg-gradient-to-r from-crucible-accent via-orange-500 to-crucible-gold bg-clip-text text-transparent">
            Crucible
          </span>
        </h1>
        <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
          Where strategies prove themselves. Automated bots compete head-to-head
          on Drift Protocol. Stake your conviction, let the algorithms fight.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-3 bg-crucible-accent text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm"
        >
          Create Match
        </button>
      </div>

      {/* How it works */}
      <div className="mb-12">
        <h2 className="text-center text-lg font-bold text-slate-300 mb-6">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            {
              step: "1",
              title: "Deploy Strategy",
              desc: "Configure your trading bot with custom parameters and risk limits.",
            },
            {
              step: "2",
              title: "Create Match",
              desc: "Set stake, scoring method, duration, and capital allocation.",
            },
            {
              step: "3",
              title: "Compete",
              desc: "Bots trade head-to-head on Drift. Real positions, real PnL.",
            },
            {
              step: "4",
              title: "Win",
              desc: "Best performer by scoring criteria takes the stake pool.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-crucible-card border border-crucible-border rounded-xl p-5 text-center relative"
            >
              <div className="w-8 h-8 rounded-full bg-crucible-accent/15 border border-crucible-accent/30 flex items-center justify-center text-crucible-accent font-bold text-sm mx-auto mb-3">
                {item.step}
              </div>
              <div className="text-sm font-bold text-slate-200 mb-1">
                {item.title}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Protocol support */}
      <div className="mb-12">
        <h2 className="text-center text-lg font-bold text-slate-300 mb-6">
          Supported Protocols
        </h2>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="bg-crucible-card border border-crucible-green/30 rounded-xl px-6 py-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-crucible-green animate-pulse" />
            <span className="text-sm font-bold text-slate-200">Drift</span>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-crucible-green/10 text-crucible-green border border-crucible-green/30">
              LIVE
            </span>
          </div>
          <div className="bg-crucible-card border border-crucible-border rounded-xl px-6 py-4 flex items-center gap-3 opacity-50">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="text-sm font-bold text-slate-400">Jupiter</span>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/30">
              COMING SOON
            </span>
          </div>
          <div className="bg-crucible-card border border-crucible-border rounded-xl px-6 py-4 flex items-center gap-3 opacity-50">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="text-sm font-bold text-slate-400">Hyperliquid</span>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/30">
              COMING SOON
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          { label: "Active Matches", value: activeMatches.length.toString() },
          { label: "Open Challenges", value: openChallenges.length.toString() },
          { label: "Total Volume", value: "$128.4K" },
          { label: "Unique Strategists", value: "47" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-crucible-card border border-crucible-border rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-slate-100 mb-1">
              {stat.value}
            </div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Active Matches */}
      {activeMatches.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Active Matches</h2>
            <span className="text-xs text-crucible-green font-medium">
              LIVE
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Open Challenges */}
      {openChallenges.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Open Challenges</h2>
            <span className="text-xs text-crucible-gold font-medium">
              {openChallenges.length} OPEN
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {openChallenges.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Top Strategists Preview */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Top Strategists</h2>
          <a
            href="/leaderboard"
            className="text-xs text-crucible-accent hover:text-red-300 transition-colors"
          >
            View full leaderboard
          </a>
        </div>
        <div className="bg-crucible-card border border-crucible-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-crucible-border">
                <th className="text-left py-3 px-4">#</th>
                <th className="text-left py-3 px-4">Strategist</th>
                <th className="text-right py-3 px-4">Win Rate</th>
                <th className="text-right py-3 px-4">Avg Sharpe</th>
                <th className="text-right py-3 px-4">Total PnL</th>
                <th className="text-right py-3 px-4">Matches</th>
              </tr>
            </thead>
            <tbody>
              {topStrategists.map((entry) => (
                <tr
                  key={entry.wallet}
                  className="border-b border-crucible-border/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <span
                      className={`text-sm font-bold ${
                        entry.rank === 1
                          ? "text-crucible-gold"
                          : entry.rank === 2
                          ? "text-crucible-silver"
                          : entry.rank === 3
                          ? "text-crucible-bronze"
                          : "text-slate-600"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-slate-300">
                      {entry.wallet}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`text-sm font-medium ${
                        entry.winRate >= 60
                          ? "text-crucible-green"
                          : "text-slate-300"
                      }`}
                    >
                      {entry.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-mono text-slate-300">
                      {entry.avgSharpe.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-mono text-crucible-green">
                      +{entry.totalPnlPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-slate-400">
                      {entry.matchesWon}/{entry.matchesPlayed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CreateMatchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
