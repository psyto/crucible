/**
 * Read a Drift vault's equity and PnL.
 *
 * Usage: npx ts-node read-vault-equity.ts <VAULT_NAME>
 */

import { encodeName, getVaultAddressSync } from "@drift-labs/vaults-sdk";
import { DriftClient, Wallet, BulkAccountLoader, QUOTE_PRECISION, User } from "@drift-labs/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const DRIFT_PROGRAM = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
const VAULT_PROGRAM = new PublicKey("vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR");

async function main() {
  const vaultName = process.argv[2];
  if (!vaultName) {
    console.log("Usage: npx ts-node read-vault-equity.ts <VAULT_NAME>");
    process.exit(1);
  }

  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const walletData = JSON.parse(
    fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const kp = Keypair.fromSecretKey(Uint8Array.from(walletData));
  const wallet = new Wallet(kp);

  const accountLoader = new BulkAccountLoader(conn, "confirmed", 10000);
  const driftClient = new DriftClient({
    connection: conn,
    wallet,
    programID: DRIFT_PROGRAM,
    env: "devnet",
    accountSubscription: { type: "polling", accountLoader },
  });
  await driftClient.subscribe();

  const idlPath = path.join(__dirname, "../packages/adapter-drift/drift_vaults_idl.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const vaultsProgram = new Program(idl as any, VAULT_PROGRAM, provider);

  // Get vault
  const nameEncoded = encodeName(vaultName);
  const vaultPda = getVaultAddressSync(VAULT_PROGRAM, nameEncoded);
  console.log(`Vault: ${vaultName} (${vaultPda.toBase58()})`);

  const vaultData = await vaultsProgram.account.vault.fetch(vaultPda);
  const vaultUser = (vaultData as any).user;
  console.log(`Drift User: ${vaultUser.toBase58()}`);
  console.log(`Manager: ${(vaultData as any).manager.toBase58()}`);
  console.log(`Delegate: ${(vaultData as any).delegate.toBase58()}`);

  // Subscribe to the vault's Drift user to read equity
  const user = new User({
    driftClient,
    userAccountPublicKey: vaultUser,
    accountSubscription: { type: "polling", accountLoader },
  });
  await user.subscribe();

  const QP = QUOTE_PRECISION.toNumber();

  const netUsdValue = user.getNetUsdValue().toNumber() / QP;
  const unrealizedPnl = user.getUnrealizedPNL(true).toNumber() / QP;
  const netSpotValue = user.getNetSpotMarketValue().toNumber() / QP;
  const totalCollateral = user.getTotalCollateral().toNumber() / QP;
  const freeCollateral = user.getFreeCollateral().toNumber() / QP;
  const leverage = user.getLeverage().toNumber() / 10000;
  const health = user.getHealth();

  console.log("\n=== VAULT EQUITY ===");
  console.log(`  Net USD Value:     $${netUsdValue.toFixed(2)}`);
  console.log(`  Net Spot Value:    $${netSpotValue.toFixed(2)}`);
  console.log(`  Unrealized PnL:    $${unrealizedPnl.toFixed(2)}`);
  console.log(`  Total Collateral:  $${totalCollateral.toFixed(2)}`);
  console.log(`  Free Collateral:   $${freeCollateral.toFixed(2)}`);
  console.log(`  Leverage:          ${leverage.toFixed(2)}x`);
  console.log(`  Health:            ${health}`);

  // Perp positions
  const userAccount = user.getUserAccount();
  const perpPositions = userAccount.perpPositions.filter(
    (p: any) => !p.baseAssetAmount.isZero()
  );

  if (perpPositions.length > 0) {
    console.log("\n=== POSITIONS ===");
    for (const p of perpPositions) {
      const oracle = driftClient.getOracleDataForPerpMarket(p.marketIndex);
      const markPrice = oracle.price.toNumber() / 1e6;
      const side = p.baseAssetAmount.gt(new BN(0)) ? "LONG" : "SHORT";
      const baseSize = Math.abs(p.baseAssetAmount.toNumber()) / 1e9;
      const sizeUsd = baseSize * markPrice;
      console.log(
        `  [${p.marketIndex}] ${side} ${baseSize.toFixed(4)} ($${sizeUsd.toFixed(2)}) @ mark $${markPrice.toFixed(2)}`
      );
    }
  } else {
    console.log("\n  No open positions.");
  }

  await user.unsubscribe();
  await driftClient.unsubscribe();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
