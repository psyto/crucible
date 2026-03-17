"use client";

import { useState } from "react";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { MatchState } from "@/lib/types";
import { MatchCard } from "@/components/MatchCard";

type Tab = "all" | "live" | "open" | "completed";

const TAB_FILTERS: Record<Tab, (m: { state: MatchState }) => boolean> = {
  all: () => true,
  live: (m) => m.state === MatchState.Active,
  open: (m) => m.state === MatchState.Open,
  completed: (m) =>
    m.state === MatchState.Completed || m.state === MatchState.Draw,
};

const TABS: { key: Tab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "open", label: "Open" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export default function MatchesPage() {
  const [tab, setTab] = useState<Tab>("all");

  const filtered = MOCK_MATCHES.filter(TAB_FILTERS[tab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Matches</h1>

        <div className="flex items-center gap-1 bg-crucible-card border border-crucible-border rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-crucible-accent/10 text-crucible-accent"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          No matches found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
