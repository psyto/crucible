"use client";

import { MOCK_MATCHES } from "@/lib/mock-data";
import { MatchViewer } from "@/components/MatchViewer";
import Link from "next/link";

export default function MatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const matchId = parseInt(params.id, 10);
  const match = MOCK_MATCHES.find((m) => m.id === matchId);

  if (!match) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-slate-300 mb-4">
          Match not found
        </h1>
        <Link
          href="/matches"
          className="text-crucible-accent hover:text-red-300 text-sm"
        >
          Back to matches
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/matches"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          &larr; Back to matches
        </Link>
      </div>
      <MatchViewer match={match} />
    </div>
  );
}
