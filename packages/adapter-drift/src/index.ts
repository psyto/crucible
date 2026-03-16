/**
 * Drift Protocol Adapter for Crucible
 *
 * How it works:
 * 1. Each competitor gets a Drift vault (via drift-vaults program)
 * 2. Crucible is the vault manager (controls deposits/withdrawals)
 * 3. Competitor's bot wallet is set as delegate (can trade, cannot withdraw)
 * 4. Delegate trades directly on Drift v2 — not through the vault program
 * 5. Crucible reads vault equity via VaultClient.calculateVaultEquity()
 *
 * Key Drift concepts:
 * - Vault PDA: seeds = ["vault", vault_name_bytes]
 * - Vault creates a Drift User account owned by the vault PDA
 * - Delegate can place/cancel orders on Drift v2 via delegated authority
 * - Manager (Crucible) retains deposit/withdraw control
 *
 * Precision constants:
 * - QUOTE_PRECISION = 1e6 (USDC amounts)
 * - PRICE_PRECISION = 1e6
 * - BASE_PRECISION = 1e9 (perp base asset amounts)
 * - PERCENTAGE_PRECISION = 1e6
 */

import {
  ProtocolAdapter,
  CreateVaultParams,
  VaultInfo,
  VaultSnapshot,
  Position,
} from "@crucible/core";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

// Program IDs
const DRIFT_PROGRAM_ID = new PublicKey(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
);
const DRIFT_VAULTS_PROGRAM_ID = new PublicKey(
  "JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw"
);

const QUOTE_PRECISION = 1_000_000; // 1e6

// Drift perp market indices
const MARKET_NAMES: Record<number, string> = {
  0: "SOL-PERP",
  1: "BTC-PERP",
  2: "ETH-PERP",
  3: "APT-PERP",
  4: "MATIC-PERP",
  5: "ARB-PERP",
  6: "DOGE-PERP",
  7: "BNB-PERP",
  8: "SUI-PERP",
  9: "1MPEPE-PERP",
};

export class DriftAdapter implements ProtocolAdapter {
  readonly protocolId = "drift";
  readonly chainId = "solana";
  readonly displayName = "Drift Protocol";

  private connection: Connection;
  // In production, these would be DriftClient and VaultClient instances
  // private driftClient: DriftClient;
  // private vaultClient: VaultClient;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot();
      return slot > 0;
    } catch {
      return false;
    }
  }

  /**
   * Create a Drift vault for a competition entrant.
   *
   * Production flow:
   * 1. Generate unique vault name: "crucible-{matchId}-{side}"
   * 2. VaultClient.initializeVault({
   *      name: encodedName,
   *      spotMarketIndex: 0,          // USDC
   *      redeemPeriod: new BN(0),     // instant (managed by Crucible)
   *      maxTokens: new BN(capitalUsd * 1e6),
   *      minDepositAmount: new BN(0),
   *      managementFee: new BN(0),    // no fees for competition
   *      profitShare: 0,
   *      hurdleRate: 0,
   *      permissioned: true,          // only Crucible can add depositors
   *    })
   * 3. VaultClient.updateDelegate(vault, new PublicKey(params.owner))
   * 4. VaultClient.managerDeposit(vault, new BN(capitalUsd * 1e6))
   * 5. VaultClient.updateMarginTradingEnabled(vault, true)
   *
   * Cost: ~0.02-0.05 SOL rent for vault + Drift user accounts
   */
  async createVault(params: CreateVaultParams): Promise<VaultInfo> {
    // const vaultName = `crucible-${Date.now()}-${params.owner.slice(0, 8)}`;
    // const encodedName = new TextEncoder().encode(vaultName);
    //
    // // Derive vault PDA
    // const [vaultPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("vault"), encodedName],
    //   DRIFT_VAULTS_PROGRAM_ID
    // );
    //
    // // Initialize vault — Crucible wallet is manager
    // await this.vaultClient.initializeVault({
    //   name: Array.from(encodedName),
    //   spotMarketIndex: 0,
    //   redeemPeriod: new BN(0),
    //   maxTokens: new BN(params.initialCapitalUsd * QUOTE_PRECISION),
    //   minDepositAmount: new BN(0),
    //   managementFee: new BN(0),
    //   profitShare: 0,
    //   hurdleRate: 0,
    //   permissioned: true,
    // });
    //
    // // Set competitor's bot wallet as delegate
    // await this.vaultClient.updateDelegate(vaultPda, new PublicKey(params.owner));
    //
    // // Enable margin trading (leveraged perps)
    // await this.vaultClient.updateMarginTradingEnabled(vaultPda, true);
    //
    // // Deposit competition capital
    // await this.vaultClient.managerDeposit(
    //   vaultPda,
    //   new BN(params.initialCapitalUsd * QUOTE_PRECISION)
    // );

    const vaultId = PublicKey.unique().toBase58();

    return {
      vaultId,
      protocolId: this.protocolId,
      chainId: this.chainId,
      owner: params.owner,
      createdAt: Math.floor(Date.now() / 1000),
      active: true,
    };
  }

  /**
   * Get a snapshot of a Drift vault's current state for scoring.
   *
   * Production flow:
   * 1. Fetch vault account to get the Drift user pubkey
   * 2. Get subscribed Drift User for the vault
   * 3. Read equity, PnL, and positions
   *
   * Key methods:
   * - vaultClient.calculateVaultEquity({ address }) -> BN (QUOTE_PRECISION)
   * - vaultClient.calculateVaultAllTimeNotionalPnl({ address }) -> BN
   *   Formula: netUsdValue + totalWithdraws - totalDeposits
   * - user.getNetUsdValue() -> BN
   * - user.getUnrealizedPNL(withFunding) -> BN
   * - user.getLeverage() -> BN
   * - user.getPerpPosition(marketIndex) -> PerpPosition
   */
  async getSnapshot(vaultId: string): Promise<VaultSnapshot> {
    const now = Math.floor(Date.now() / 1000);

    // const vaultPubkey = new PublicKey(vaultId);
    //
    // // Get vault account
    // const vault = await this.vaultClient.getVault(vaultPubkey);
    //
    // // Get the vault's Drift user
    // const user = await this.vaultClient.getSubscribedVaultUser(vault.user);
    //
    // // Calculate equity (in QUOTE_PRECISION = 1e6)
    // const equityBN = await this.vaultClient.calculateVaultEquity({
    //   address: vaultPubkey,
    // });
    // const equityUsd = equityBN.toNumber() / QUOTE_PRECISION;
    //
    // // Calculate all-time PnL
    // const pnlBN = await this.vaultClient.calculateVaultAllTimeNotionalPnl({
    //   address: vaultPubkey,
    // });
    // const totalPnlUsd = pnlBN.toNumber() / QUOTE_PRECISION;
    //
    // // Deposited capital
    // const depositedUsd = vault.totalDeposits.toNumber() / QUOTE_PRECISION;
    //
    // // Unrealized PnL
    // const unrealizedPnlBN = user.getUnrealizedPNL(true);
    // const unrealizedPnlUsd = unrealizedPnlBN.toNumber() / QUOTE_PRECISION;
    //
    // // Realized = total - unrealized
    // const realizedPnlUsd = totalPnlUsd - unrealizedPnlUsd;
    //
    // // Read all perp positions
    // const userAccount = user.getUserAccount();
    // const positions: Position[] = userAccount.perpPositions
    //   .filter((p: any) => !p.baseAssetAmount.isZero())
    //   .map((p: any) => {
    //     const oracleData = this.driftClient.getOracleDataForPerpMarket(p.marketIndex);
    //     const markPrice = oracleData.price.toNumber() / QUOTE_PRECISION;
    //     const baseSize = p.baseAssetAmount.abs().toNumber() / 1e9; // BASE_PRECISION
    //     const sizeUsd = baseSize * markPrice;
    //     const entryPrice = p.quoteEntryAmount.abs().toNumber() /
    //       (QUOTE_PRECISION * (p.baseAssetAmount.abs().toNumber() / 1e9));
    //
    //     return {
    //       market: MARKET_NAMES[p.marketIndex] || `PERP-${p.marketIndex}`,
    //       side: p.baseAssetAmount.gt(new BN(0)) ? "long" as const : "short" as const,
    //       sizeUsd,
    //       entryPrice,
    //       markPrice,
    //       leverage: sizeUsd / Math.max(equityUsd, 1),
    //       pnlUsd: calculatePositionUnrealizedPnl(p, oracleData),
    //     };
    //   });
    //
    // // Trade count from user stats
    // const userStats = await this.driftClient.getUserStats().getAccount();
    // const tradeCount = userStats.numberOfSubAccountsFilled; // approximate

    return {
      vaultId,
      timestamp: now,
      equityUsd: 0,
      depositedUsd: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      totalPnlUsd: 0,
      positions: [],
      tradeCount: 0,
      peakEquityUsd: 0,
      maxDrawdownPct: 0,
    };
  }

  async getVaultInfo(vaultId: string): Promise<VaultInfo> {
    // const vaultPubkey = new PublicKey(vaultId);
    // const vault = await this.vaultClient.getVault(vaultPubkey);
    //
    // return {
    //   vaultId,
    //   protocolId: this.protocolId,
    //   chainId: this.chainId,
    //   owner: vault.manager.toBase58(),
    //   createdAt: 0, // vault account doesn't store creation time
    //   active: !vault.delegate.equals(PublicKey.default),
    // };

    return {
      vaultId,
      protocolId: this.protocolId,
      chainId: this.chainId,
      owner: "",
      createdAt: 0,
      active: true,
    };
  }

  /**
   * Helper: derive vault PDA from name.
   */
  static deriveVaultPda(name: string): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(name)],
      DRIFT_VAULTS_PROGRAM_ID
    );
    return pda;
  }

  /**
   * Helper: derive vault depositor PDA.
   */
  static deriveVaultDepositorPda(
    vault: PublicKey,
    authority: PublicKey
  ): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_depositor"), vault.toBuffer(), authority.toBuffer()],
      DRIFT_VAULTS_PROGRAM_ID
    );
    return pda;
  }
}
