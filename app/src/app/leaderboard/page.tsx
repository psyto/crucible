"use client";

import { useState } from "react";
import { MOCK_LEADERBOARD } from "@/lib/mock-data";

type SortKey =
  | "rank"
  | "winRate"
  | "avgPnlPercent"
  | "avgSharpe"
  | "matchesPlayed"
  | "totalPnlPercent";

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>("rank");

  const sorted = [...MOCK_LEADERBOARD].sort((a, b) => {
    if (sortBy === "rank") return a.rank - b.rank;
    return (b[sortBy] as number) - (a[sortBy] as number);
  });

  function SortHeader({
    label,
    field,
  }: {
    label: string;
    field: SortKey;
  }) {
    return (
      <th
        className="text-right py-4 px-4 cursor-pointer hover:text-slate-300 select-none"
        onClick={() => setSortBy(field)}
      >
        {label} {sortBy === field && "v"}
      </th>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <div className="text-xs text-slate-500">
          Ranked by composite score. Click columns to sort.
        </div>
      </div>

      <div className="bg-crucible-card border border-crucible-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-crucible-border">
              <th className="text-left py-4 px-4">#</th>
              <th className="text-left py-4 px-4">Strategist</th>
              <SortHeader label="Matches" field="matchesPlayed" />
              <SortHeader label="Win Rate" field="winRate" />
              <SortHeader label="Avg PnL" field="avgPnlPercent" />
              <SortHeader label="Total PnL" field="totalPnlPercent" />
              <SortHeader label="Avg Sharpe" field="avgSharpe" />
              <th className="text-right py-4 px-4">Best Sharpe</th>
              <th className="text-right py-4 px-4">Max DD</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr
                key={t.wallet}
                className={`border-b border-crucible-border/50 hover:bg-white/[0.02] transition-colors ${
                  i < 3 ? "bg-white/[0.01]" : ""
                }`}
              >
                <td className="py-4 px-4">
                  <span
                    className={`text-sm font-bold ${
                      t.rank === 1
                        ? "text-crucible-gold"
                        : t.rank === 2
                        ? "text-crucible-silver"
                        : t.rank === 3
                        ? "text-crucible-bronze"
                        : "text-slate-600"
                    }`}
                  >
                    {t.rank}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="font-mono text-sm text-slate-300">
                    {t.wallet}
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm text-slate-300">
                    {t.matchesWon}/{t.matchesPlayed}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span
                    className={`text-sm font-medium ${
                      t.winRate >= 60
                        ? "text-crucible-green"
                        : t.winRate >= 50
                        ? "text-slate-300"
                        : "text-crucible-accent"
                    }`}
                  >
                    {t.winRate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-mono text-crucible-green">
                    +{t.avgPnlPercent.toFixed(2)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-mono text-crucible-green">
                    +{t.totalPnlPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-mono text-slate-300">
                    {t.avgSharpe.toFixed(2)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-mono text-slate-300">
                    {t.bestSharpe.toFixed(2)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-mono text-crucible-accent">
                    {t.maxDrawdown.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
