/**
 * Simple Momentum Bot for Crucible Competitions
 *
 * Strategy:
 * - Monitors SOL-PERP price on Drift
 * - Goes long when price is above short-term MA
 * - Goes short when price is below short-term MA
 * - Uses fixed position size and leverage
 * - Designed to demonstrate Crucible's competition flow
 *
 * This is a deliberately simple strategy — the point is to show
 * that bots can compete on Drift via Crucible, not to be profitable.
 *
 * Usage:
 *   WALLET_PATH=./bot-keypair.json npx ts-node src/index.ts
 *
 * In a real competition:
 * 1. Crucible creates a Drift vault and sets this bot as delegate
 * 2. Bot connects to Drift and trades within the vault
 * 3. Crucible reads vault equity for scoring
 */

import {
  DriftClient,
  User,
  BulkAccountLoader,
  PositionDirection,
  OrderType,
  MarketType,
  BASE_PRECISION,
  QUOTE_PRECISION,
  PRICE_PRECISION,
  getMarketOrderParams,
  Wallet,
} from "@drift-labs/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// Config
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
const MARKET_INDEX = 0; // SOL-PERP
const POSITION_SIZE_USD = 100; // $100 per position
const MAX_LEVERAGE = 5;
const TRADE_INTERVAL_MS = 60_000; // Check every 60 seconds
const MA_PERIODS = 5; // 5-period moving average

interface PricePoint {
  price: number;
  timestamp: number;
}

class MomentumBot {
  private driftClient: DriftClient | null = null;
  private user: User | null = null;
  private priceHistory: PricePoint[] = [];
  private running = false;

  constructor(
    private connection: Connection,
    private wallet: Keypair
  ) {}

  async initialize(): Promise<void> {
    console.log("[Bot] Initializing Drift client...");
    console.log(`[Bot] Wallet: ${this.wallet.publicKey.toBase58()}`);

    const sdkWallet = new Wallet(this.wallet);
    const accountLoader = new BulkAccountLoader(this.connection, "confirmed", 5000);

    this.driftClient = new DriftClient({
      connection: this.connection,
      wallet: sdkWallet,
      programID: new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"),
      env: "devnet",
      accountSubscription: {
        type: "polling",
        accountLoader,
      },
    });

    await this.driftClient.subscribe();

    // Check if user account exists
    try {
      this.user = this.driftClient.getUser();
      console.log("[Bot] Drift user found.");
    } catch {
      console.log("[Bot] No Drift user account. Initializing...");
      await this.driftClient.initializeUserAccount();
      this.user = this.driftClient.getUser();
      console.log("[Bot] Drift user initialized.");
    }

    // Log initial state
    const equity = this.user.getNetUsdValue();
    console.log(`[Bot] Equity: $${equity.toNumber() / QUOTE_PRECISION.toNumber()}`);
  }

  /**
   * Get current SOL-PERP oracle price.
   */
  private getCurrentPrice(): number {
    if (!this.driftClient) return 0;
    try {
      const oracleData = this.driftClient.getOracleDataForPerpMarket(MARKET_INDEX);
      return oracleData.price.toNumber() / PRICE_PRECISION.toNumber();
    } catch {
      return 0;
    }
  }

  /**
   * Compute simple moving average of recent prices.
   */
  private getMA(): number {
    if (this.priceHistory.length < MA_PERIODS) return 0;
    const recent = this.priceHistory.slice(-MA_PERIODS);
    return recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
  }

  /**
   * Get current perp position for SOL-PERP.
   */
  private getCurrentPosition(): { side: "long" | "short" | "none"; size: number } {
    if (!this.user) return { side: "none", size: 0 };
    try {
      const pos = this.user.getPerpPosition(MARKET_INDEX);
      if (!pos || pos.baseAssetAmount.isZero()) {
        return { side: "none", size: 0 };
      }
      return {
        side: pos.baseAssetAmount.gt(new BN(0)) ? "long" : "short",
        size: pos.baseAssetAmount.abs().toNumber() / BASE_PRECISION.toNumber(),
      };
    } catch {
      return { side: "none", size: 0 };
    }
  }

  /**
   * Execute one trading decision.
   */
  async tick(): Promise<void> {
    if (!this.driftClient || !this.user) return;

    const price = this.getCurrentPrice();
    if (price === 0) {
      console.log("[Bot] No price data yet.");
      return;
    }

    // Record price
    this.priceHistory.push({ price, timestamp: Date.now() });
    if (this.priceHistory.length > 100) this.priceHistory.shift();

    const ma = this.getMA();
    const position = this.getCurrentPosition();

    console.log(
      `[Bot] Price: $${price.toFixed(2)} | MA(${MA_PERIODS}): $${ma.toFixed(2)} | ` +
        `Position: ${position.side} ${position.size.toFixed(4)} SOL`
    );

    // Not enough data for MA
    if (ma === 0) return;

    // Signal: price above MA = bullish, below = bearish
    const signal = price > ma ? "long" : "short";

    // If already in the right direction, hold
    if (position.side === signal) return;

    // Close existing position if in wrong direction
    if (position.side !== "none" && position.side !== signal) {
      console.log(`[Bot] Closing ${position.side} position...`);
      try {
        await this.driftClient.closePosition(MARKET_INDEX);
        console.log("[Bot] Position closed.");
      } catch (err: any) {
        console.error("[Bot] Close failed:", err.message);
        return;
      }
    }

    // Open new position
    const baseSize = (POSITION_SIZE_USD / price) * MAX_LEVERAGE;
    const direction = signal === "long" ? PositionDirection.LONG : PositionDirection.SHORT;

    console.log(
      `[Bot] Opening ${signal} position: ${baseSize.toFixed(4)} SOL at $${price.toFixed(2)}`
    );

    try {
      const orderParams = getMarketOrderParams({
        marketIndex: MARKET_INDEX,
        direction,
        baseAssetAmount: new BN(baseSize * BASE_PRECISION.toNumber()),
        marketType: MarketType.PERP,
      });

      await this.driftClient.placePerpOrder(orderParams);
      console.log("[Bot] Order placed.");
    } catch (err: any) {
      console.error("[Bot] Order failed:", err.message);
    }
  }

  /**
   * Run the bot in a loop.
   */
  async run(): Promise<void> {
    await this.initialize();
    this.running = true;

    console.log("\n[Bot] Starting trading loop...");
    console.log(`[Bot] Market: SOL-PERP | Size: $${POSITION_SIZE_USD} | Leverage: ${MAX_LEVERAGE}x`);
    console.log(`[Bot] Interval: ${TRADE_INTERVAL_MS / 1000}s | MA Period: ${MA_PERIODS}`);
    console.log("---");

    while (this.running) {
      try {
        await this.tick();
      } catch (err: any) {
        console.error("[Bot] Tick error:", err.message);
      }
      await new Promise((r) => setTimeout(r, TRADE_INTERVAL_MS));
    }
  }

  stop(): void {
    this.running = false;
    console.log("[Bot] Stopping...");
  }
}

async function main() {
  console.log("=========================================");
  console.log("     CRUCIBLE MOMENTUM BOT");
  console.log("=========================================");

  const connection = new Connection(RPC_URL, "confirmed");

  let wallet: Keypair;
  try {
    const data = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
    wallet = Keypair.fromSecretKey(Uint8Array.from(data));
  } catch {
    console.log("No wallet found. Generating new keypair...");
    wallet = Keypair.generate();
    fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(wallet.secretKey)));
    console.log(`Generated: ${wallet.publicKey.toBase58()}`);
    console.log("Fund this wallet with SOL and USDC before running the bot.");
    return;
  }

  const bot = new MomentumBot(connection, wallet);

  process.on("SIGINT", () => {
    bot.stop();
    process.exit(0);
  });

  await bot.run();
}

main().catch(console.error);
