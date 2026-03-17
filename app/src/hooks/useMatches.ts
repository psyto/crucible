"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCrucibleProgram } from "./useCrucibleProgram";
import { Match, MatchState, ScoringMethod, Protocol } from "@/lib/types";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { PublicKey } from "@solana/web3.js";

function shortAddr(addr: string): string {
  return addr.length > 12 ? addr.slice(0, 4) + "..." + addr.slice(-4) : addr;
}

function parseMatchAccount(pubkey: PublicKey, account: any): Match {
  const stateMap: Record<string, MatchState> = {
    created: MatchState.Open,
    active: MatchState.Active,
    settling: MatchState.Settling,
    completed: MatchState.Completed,
    cancelled: MatchState.Cancelled,
    draw: MatchState.Draw,
  };
  const scoringMap: Record<string, ScoringMethod> = {
    pnlPercent: ScoringMethod.PnlPercent,
    sharpe: ScoringMethod.Sharpe,
    riskAdjusted: ScoringMethod.RiskAdjusted,
  };

  const stateKey = Object.keys(account.state)[0];
  const scoringKey = Object.keys(account.scoring)[0];
  const hasOpponent = !account.opponent.equals(PublicKey.default);

  return {
    id: account.id.toNumber(),
    protocol: Protocol.Drift,
    scoringMethod: scoringMap[scoringKey] || ScoringMethod.PnlPercent,
    state: stateMap[stateKey] || MatchState.Open,
    duration: account.duration,
    stakeAmount: account.stakeAmount.toNumber() / 1e6,
    capitalAmount: account.capitalAmount.toNumber() / 1e6,
    maxLeverage: account.maxLeverage,
    createdAt: account.createdAt.toNumber(),
    startedAt: account.startedAt.toNumber(),
    endsAt: account.endsAt.toNumber(),
    challenger: {
      wallet: account.challenger.toBase58(),
      vaultAddress: "vault-" + account.id.toNumber() + "-challenger",
      stats: {
        equity: 0,
        pnlPercent: account.challengerScore.toNumber() / 100,
        sharpeRatio: 0,
        maxDrawdown: 0,
        positionCount: 0,
        tradeCount: 0,
        avgLeverage: 0,
      },
      positions: [],
      equityCurve: [],
    },
    opponent: hasOpponent
      ? {
          wallet: account.opponent.toBase58(),
          vaultAddress: "vault-" + account.id.toNumber() + "-opponent",
          stats: {
            equity: 0,
            pnlPercent: account.opponentScore.toNumber() / 100,
            sharpeRatio: 0,
            maxDrawdown: 0,
            positionCount: 0,
            tradeCount: 0,
            avgLeverage: 0,
          },
          positions: [],
          equityCurve: [],
        }
      : null,
    winner: account.winner.equals(PublicKey.default)
      ? null
      : account.winner.toBase58(),
  };
}

export function useMatches() {
  const { program, connected } = useCrucibleProgram();
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [loading, setLoading] = useState(false);
  const [onChain, setOnChain] = useState(false);
  const hasFetched = useRef(false);
  const programRef = useRef(program);
  programRef.current = program;

  const refresh = useCallback(async () => {
    const prog = programRef.current;
    if (!prog) {
      setMatches(MOCK_MATCHES);
      setOnChain(false);
      return;
    }

    setLoading(true);
    try {
      const accounts = await (prog.account as any).matchEscrow.all();
      console.log(`[useMatches] Fetched ${accounts.length} matches from chain`);
      if (accounts.length > 0) {
        const parsed = accounts.map((a: any) =>
          parseMatchAccount(a.publicKey, a.account)
        );
        setMatches(parsed);
        setOnChain(true);
      } else {
        setMatches(MOCK_MATCHES);
        setOnChain(false);
      }
    } catch (err) {
      console.error("[useMatches] Fetch failed:", err);
      setMatches(MOCK_MATCHES);
      setOnChain(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && program && !hasFetched.current) {
      hasFetched.current = true;
      refresh();
    }
    if (!connected) {
      hasFetched.current = false;
      setMatches(MOCK_MATCHES);
      setOnChain(false);
    }
  }, [connected, program, refresh]);

  return { matches, loading, onChain, refresh };
}
