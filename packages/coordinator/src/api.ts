/**
 * REST API for the Crucible coordinator.
 */

import express, { Request, Response } from "express";
import { MatchEngine } from "./match-engine";
import {
  MatchState,
  MatchFormat,
  ScoringMethod,
  MatchConfig,
} from "@crucible/core";

export function createApi(engine: MatchEngine): express.Application {
  const app = express();
  app.use(express.json());

  // Health
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // List all matches
  app.get("/matches", (req: Request, res: Response) => {
    const state = req.query.state as string | undefined;
    const matches = state
      ? engine.getMatchesByState(state as MatchState)
      : engine.getAllMatches();
    res.json({ matches });
  });

  // Get match by ID
  app.get("/matches/:id", (req: Request, res: Response) => {
    const match = engine.getMatch(req.params.id);
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    res.json({ match });
  });

  // Create a match
  app.post("/matches", async (req: Request, res: Response) => {
    try {
      const {
        protocolId,
        challengerOwner,
        scoring = "pnl_percent",
        duration = 86400,
        stakeUsd = 100,
        capitalUsd = 1000,
        maxLeverage = 10,
        allowedMarkets,
      } = req.body;

      if (!protocolId || !challengerOwner) {
        res
          .status(400)
          .json({ error: "protocolId and challengerOwner are required" });
        return;
      }

      const config: MatchConfig = {
        format: MatchFormat.Duel,
        scoring: scoring as ScoringMethod,
        duration,
        stakeUsd,
        capitalUsd,
        protocolId,
        chainId: "solana",
        allowedMarkets,
        maxLeverage,
      };

      const match = await engine.createMatch(config, challengerOwner);
      res.status(201).json({ match });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Accept a match
  app.post("/matches/:id/accept", async (req: Request, res: Response) => {
    try {
      const { opponentOwner } = req.body;
      if (!opponentOwner) {
        res.status(400).json({ error: "opponentOwner is required" });
        return;
      }
      const match = await engine.acceptMatch(req.params.id, opponentOwner);
      res.json({ match });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settle a match (admin/coordinator only in production)
  app.post("/matches/:id/settle", async (req: Request, res: Response) => {
    try {
      const match = await engine.settleMatch(req.params.id);
      res.json({ match });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
