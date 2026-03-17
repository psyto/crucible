/**
 * Match Engine — manages the lifecycle of competitions.
 *
 * Responsibilities:
 * 1. Create matches and register entrants
 * 2. Track match state transitions
 * 3. Poll vault snapshots during active matches
 * 4. Build equity curves for scoring
 * 5. Compute final scores and determine winners
 * 6. Trigger on-chain settlement
 */

import {
  ProtocolAdapter,
  Match,
  MatchConfig,
  MatchState,
  MatchEntrant,
  MatchScore,
  VaultSnapshot,
  EquityPoint,
  ScoringMethod,
  CrucibleEvent,
} from "@crucible/core";
import { computeScore, determineWinner } from "@crucible/core";

export class MatchEngine {
  private matches: Map<string, MatchRecord> = new Map();
  private adapters: Map<string, ProtocolAdapter> = new Map();
  private eventHandlers: ((event: CrucibleEvent) => void)[] = [];
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private nextMatchId = 0;

  /** Register a protocol adapter. */
  registerAdapter(adapter: ProtocolAdapter): void {
    this.adapters.set(adapter.protocolId, adapter);
    console.log(
      `[MatchEngine] Registered adapter: ${adapter.displayName} (${adapter.protocolId}/${adapter.chainId})`
    );
  }

  /** Subscribe to match events. */
  onEvent(handler: (event: CrucibleEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: CrucibleEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[MatchEngine] Event handler error:", err);
      }
    }
  }

  /**
   * Create a new match.
   * The challenger's vault is created on the target protocol.
   */
  async createMatch(
    config: MatchConfig,
    challengerOwner: string
  ): Promise<Match> {
    const adapter = this.adapters.get(config.protocolId);
    if (!adapter) {
      throw new Error(`No adapter registered for protocol: ${config.protocolId}`);
    }

    // Create vault for challenger
    const challengerVault = await adapter.createVault({
      owner: challengerOwner,
      initialCapitalUsd: config.capitalUsd,
      allowedMarkets: config.allowedMarkets,
      maxLeverage: config.maxLeverage,
    });

    const matchId = `match-${this.nextMatchId++}`;

    const match: Match = {
      id: matchId,
      config,
      state: MatchState.Created,
      challenger: {
        owner: challengerOwner,
        vaultId: challengerVault.vaultId,
        snapshot: null,
        score: null,
      },
      opponent: null,
      createdAt: Math.floor(Date.now() / 1000),
      startedAt: 0,
      endsAt: 0,
      winner: null,
    };

    this.matches.set(matchId, {
      match,
      challengerCurve: [],
      opponentCurve: [],
      startSnapshot: { challenger: null, opponent: null },
    });

    this.emit({ type: "match_created", matchId, config });
    console.log(
      `[MatchEngine] Match ${matchId} created. Challenger vault: ${challengerVault.vaultId}`
    );

    return match;
  }

  /**
   * Accept a match — opponent joins with their own vault.
   * This transitions the match to Active and starts the clock.
   */
  async acceptMatch(matchId: string, opponentOwner: string): Promise<Match> {
    const record = this.matches.get(matchId);
    if (!record) throw new Error(`Match not found: ${matchId}`);
    if (record.match.state !== MatchState.Created) {
      throw new Error(`Match ${matchId} is not in Created state`);
    }

    const adapter = this.adapters.get(record.match.config.protocolId);
    if (!adapter) throw new Error("Adapter not found");

    // Create vault for opponent
    const opponentVault = await adapter.createVault({
      owner: opponentOwner,
      initialCapitalUsd: record.match.config.capitalUsd,
      allowedMarkets: record.match.config.allowedMarkets,
      maxLeverage: record.match.config.maxLeverage,
    });

    const now = Math.floor(Date.now() / 1000);
    record.match.opponent = {
      owner: opponentOwner,
      vaultId: opponentVault.vaultId,
      snapshot: null,
      score: null,
    };
    record.match.state = MatchState.Active;
    record.match.startedAt = now;
    record.match.endsAt = now + record.match.config.duration;

    // Take start snapshots
    const challengerStart = await adapter.getSnapshot(
      record.match.challenger.vaultId
    );
    const opponentStart = await adapter.getSnapshot(opponentVault.vaultId);
    record.startSnapshot = {
      challenger: challengerStart,
      opponent: opponentStart,
    };

    // Start polling snapshots
    this.startPolling(matchId);

    this.emit({ type: "match_accepted", matchId, opponent: opponentOwner });
    this.emit({
      type: "match_started",
      matchId,
      startedAt: record.match.startedAt,
    });

    console.log(
      `[MatchEngine] Match ${matchId} started. ` +
        `${record.match.challenger.owner} vs ${opponentOwner}. ` +
        `Ends at ${new Date(record.match.endsAt * 1000).toISOString()}`
    );

    return record.match;
  }

  /**
   * Poll vault snapshots at regular intervals during active matches.
   */
  private startPolling(matchId: string): void {
    const POLL_INTERVAL = 30_000; // 30 seconds

    const poll = async () => {
      const record = this.matches.get(matchId);
      if (!record || record.match.state !== MatchState.Active) {
        this.stopPolling(matchId);
        return;
      }

      const now = Math.floor(Date.now() / 1000);

      // Check if match has expired
      if (now >= record.match.endsAt) {
        await this.settleMatch(matchId);
        return;
      }

      // Get adapter and poll snapshots
      const adapter = this.adapters.get(record.match.config.protocolId);
      if (!adapter) return;

      try {
        const challengerSnap = await adapter.getSnapshot(
          record.match.challenger.vaultId
        );
        record.match.challenger.snapshot = challengerSnap;
        record.challengerCurve.push({
          timestamp: challengerSnap.timestamp,
          equityUsd: challengerSnap.equityUsd,
        });

        this.emit({
          type: "snapshot_update",
          matchId,
          entrant: "challenger",
          snapshot: challengerSnap,
        });

        if (record.match.opponent) {
          const opponentSnap = await adapter.getSnapshot(
            record.match.opponent.vaultId
          );
          record.match.opponent.snapshot = opponentSnap;
          record.opponentCurve.push({
            timestamp: opponentSnap.timestamp,
            equityUsd: opponentSnap.equityUsd,
          });

          this.emit({
            type: "snapshot_update",
            matchId,
            entrant: "opponent",
            snapshot: opponentSnap,
          });
        }
      } catch (err) {
        console.error(`[MatchEngine] Snapshot poll error for ${matchId}:`, err);
      }
    };

    // Immediate first poll
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    this.pollIntervals.set(matchId, interval);
  }

  private stopPolling(matchId: string): void {
    const interval = this.pollIntervals.get(matchId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(matchId);
    }
  }

  /**
   * Settle a match — compute final scores and determine winner.
   */
  async settleMatch(matchId: string): Promise<Match> {
    const record = this.matches.get(matchId);
    if (!record) throw new Error(`Match not found: ${matchId}`);
    if (record.match.state !== MatchState.Active) {
      throw new Error(`Match ${matchId} is not Active`);
    }

    this.stopPolling(matchId);
    record.match.state = MatchState.Settling;

    const adapter = this.adapters.get(record.match.config.protocolId);
    if (!adapter || !record.match.opponent) {
      throw new Error("Cannot settle: missing adapter or opponent");
    }

    // Get final snapshots
    const challengerEnd = await adapter.getSnapshot(
      record.match.challenger.vaultId
    );
    const opponentEnd = await adapter.getSnapshot(
      record.match.opponent.vaultId
    );

    // Add final points to equity curves
    record.challengerCurve.push({
      timestamp: challengerEnd.timestamp,
      equityUsd: challengerEnd.equityUsd,
    });
    record.opponentCurve.push({
      timestamp: opponentEnd.timestamp,
      equityUsd: opponentEnd.equityUsd,
    });

    // Compute scores
    const challengerScore = computeScore(
      record.startSnapshot.challenger!,
      challengerEnd,
      record.challengerCurve,
      record.match.config.scoring
    );
    const opponentScore = computeScore(
      record.startSnapshot.opponent!,
      opponentEnd,
      record.opponentCurve,
      record.match.config.scoring
    );

    record.match.challenger.score = challengerScore;
    record.match.opponent.score = opponentScore;
    record.match.challenger.snapshot = challengerEnd;
    record.match.opponent.snapshot = opponentEnd;

    // Determine winner
    const result = determineWinner(challengerScore, opponentScore);

    if (result === "draw") {
      record.match.state = MatchState.Draw;
      record.match.winner = null;
    } else {
      record.match.state = MatchState.Completed;
      record.match.winner =
        result === "challenger"
          ? record.match.challenger.vaultId
          : record.match.opponent.vaultId;
    }

    this.emit({
      type: "match_settled",
      matchId,
      winner: record.match.winner,
      scores: {
        challenger: challengerScore,
        opponent: opponentScore,
      },
    });

    console.log(
      `[MatchEngine] Match ${matchId} settled. ` +
        `Result: ${result}. ` +
        `Challenger: ${challengerScore.compositeScore.toFixed(2)} | ` +
        `Opponent: ${opponentScore.compositeScore.toFixed(2)}`
    );

    // TODO: Trigger on-chain escrow settlement
    // await this.settleEscrow(matchId, result);

    return record.match;
  }

  /** Get a match by ID. */
  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId)?.match;
  }

  /** Get all matches. */
  getAllMatches(): Match[] {
    return Array.from(this.matches.values()).map((r) => r.match);
  }

  /** Get matches filtered by state. */
  getMatchesByState(state: MatchState): Match[] {
    return this.getAllMatches().filter((m) => m.state === state);
  }

  /** Graceful shutdown. */
  shutdown(): void {
    for (const matchId of this.pollIntervals.keys()) {
      this.stopPolling(matchId);
    }
    console.log("[MatchEngine] Shut down.");
  }
}

/** Internal record combining match data with equity curves. */
interface MatchRecord {
  match: Match;
  challengerCurve: EquityPoint[];
  opponentCurve: EquityPoint[];
  startSnapshot: {
    challenger: VaultSnapshot | null;
    opponent: VaultSnapshot | null;
  };
}
