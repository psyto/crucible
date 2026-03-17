import { MatchEngine } from "./match-engine";
import { DriftAdapter } from "@crucible/adapter-drift";
import { createApi } from "./api";
import { WebSocketServer, WebSocket } from "ws";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const API_PORT = parseInt(process.env.API_PORT || "4000");
const WS_PORT = parseInt(process.env.WS_PORT || "4001");

async function main() {
  console.log("=========================================");
  console.log("        CRUCIBLE COORDINATOR");
  console.log("=========================================");

  // Initialize match engine
  const engine = new MatchEngine();

  // Register protocol adapters
  const driftAdapter = new DriftAdapter(RPC_URL);
  const healthy = await driftAdapter.healthCheck();
  console.log(`Drift adapter: ${healthy ? "connected" : "OFFLINE"}`);
  engine.registerAdapter(driftAdapter);

  // WebSocket server for live match updates
  const wss = new WebSocketServer({ port: WS_PORT });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));

    // Send current matches on connect
    ws.send(
      JSON.stringify({
        type: "snapshot",
        matches: engine.getAllMatches(),
      })
    );
  });

  // Forward match events to WebSocket clients
  engine.onEvent((event) => {
    const msg = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  // REST API
  const api = createApi(engine);
  api.listen(API_PORT, () => {
    console.log(`REST API:    http://localhost:${API_PORT}`);
    console.log(`WebSocket:   ws://localhost:${WS_PORT}`);
    console.log("-----------------------------------------");
    console.log("Endpoints:");
    console.log(`  GET    /health`);
    console.log(`  GET    /matches`);
    console.log(`  GET    /matches/:id`);
    console.log(`  POST   /matches          { protocolId, challengerOwner, ... }`);
    console.log(`  POST   /matches/:id/accept  { opponentOwner }`);
    console.log(`  POST   /matches/:id/settle`);
    console.log("-----------------------------------------");
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    engine.shutdown();
    wss.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
