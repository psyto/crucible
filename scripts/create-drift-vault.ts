/**
 * Create a Drift vault for Crucible competition.
 *
 * Usage: npx ts-node create-drift-vault.ts <VAULT_NAME> [DELEGATE_WALLET]
 *
 * Example:
 *   npx ts-node create-drift-vault.ts crucible-match-0-challenger
 *   npx ts-node create-drift-vault.ts crucible-match-0-opponent 8jgYRsFQ...
 */

import { encodeName, getVaultAddressSync, getTokenVaultAddressSync } from "@drift-labs/vaults-sdk";
import { DriftClient, Wallet, BulkAccountLoader, QUOTE_PRECISION } from "@drift-labs/sdk";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const DRIFT_PROGRAM = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
const VAULT_PROGRAM = new PublicKey("vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR");
const RPC = "https://api.devnet.solana.com";

async function main() {
  const vaultName = process.argv[2];
  const delegateStr = process.argv[3];

  if (!vaultName) {
    console.log("Usage: npx ts-node create-drift-vault.ts <VAULT_NAME> [DELEGATE_WALLET]");
    process.exit(1);
  }

  const conn = new Connection(RPC, "confirmed");
  const walletData = JSON.parse(
    fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const kp = Keypair.fromSecretKey(Uint8Array.from(walletData));
  const wallet = new Wallet(kp);
  console.log(`Manager: ${kp.publicKey.toBase58()}`);

  // Subscribe to Drift to get spot market data
  const accountLoader = new BulkAccountLoader(conn, "confirmed", 10000);
  const driftClient = new DriftClient({
    connection: conn,
    wallet,
    programID: DRIFT_PROGRAM,
    env: "devnet",
    accountSubscription: { type: "polling", accountLoader },
  });
  await driftClient.subscribe();

  const spotMarket = driftClient.getSpotMarketAccount(0);

  // Load vault IDL
  const idlPath = path.join(__dirname, "../packages/adapter-drift/drift_vaults_idl.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const vaultsProgram = new Program(idl as any, VAULT_PROGRAM, provider);

  // Derive PDAs
  const nameEncoded = encodeName(vaultName);
  const vault = getVaultAddressSync(VAULT_PROGRAM, nameEncoded);
  const tokenAccount = getTokenVaultAddressSync(VAULT_PROGRAM, vault);

  const [driftUserStats] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), vault.toBuffer()], DRIFT_PROGRAM
  );
  const [driftUser] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), vault.toBuffer(), new BN(0).toArrayLike(Buffer, "le", 2)], DRIFT_PROGRAM
  );
  const [driftState] = PublicKey.findProgramAddressSync(
    [Buffer.from("drift_state")], DRIFT_PROGRAM
  );
  const [driftSpotMarket] = PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market"), new BN(0).toArrayLike(Buffer, "le", 2)], DRIFT_PROGRAM
  );

  console.log(`\nCreating vault: ${vaultName}`);
  console.log(`  PDA: ${vault.toBase58()}`);

  // Create vault
  const ix = await vaultsProgram.methods
    .initializeVault({
      name: nameEncoded,
      spotMarketIndex: 0,
      redeemPeriod: new BN(0),
      maxTokens: new BN(100000 * 1e6), // 100k USDC cap
      minDepositAmount: new BN(0),
      managementFee: new BN(0),
      profitShare: 0,
      hurdleRate: 0,
      permissioned: false,
    })
    .accounts({
      vault,
      tokenAccount,
      driftUserStats,
      driftUser,
      driftState,
      driftSpotMarket,
      driftSpotMarketMint: spotMarket.mint,
      manager: kp.publicKey,
      payer: kp.publicKey,
      rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
      systemProgram: SystemProgram.programId,
      driftProgram: DRIFT_PROGRAM,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  tx.feePayer = kp.publicKey;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sig = await conn.sendTransaction(tx, [kp]);
  await conn.confirmTransaction(sig);

  console.log(`  TX: ${sig}`);

  // Set delegate if provided
  if (delegateStr) {
    const delegate = new PublicKey(delegateStr);
    console.log(`\nSetting delegate: ${delegate.toBase58()}`);

    const delegateIx = await vaultsProgram.methods
      .updateDelegate(delegate)
      .accounts({
        vault,
        manager: kp.publicKey,
        driftUser,
        driftProgram: DRIFT_PROGRAM,
      })
      .instruction();

    const tx2 = new Transaction().add(delegateIx);
    tx2.feePayer = kp.publicKey;
    const { blockhash: bh2 } = await conn.getLatestBlockhash();
    tx2.recentBlockhash = bh2;
    const sig2 = await conn.sendTransaction(tx2, [kp]);
    await conn.confirmTransaction(sig2);
    console.log(`  TX: ${sig2}`);
  }

  // Read vault
  const vaultData = await vaultsProgram.account.vault.fetch(vault);
  console.log("\n=== VAULT CREATED ===");
  console.log(`  Name:     ${vaultName}`);
  console.log(`  PDA:      ${vault.toBase58()}`);
  console.log(`  Manager:  ${(vaultData as any).manager.toBase58()}`);
  console.log(`  User:     ${(vaultData as any).user.toBase58()}`);
  console.log(`  Delegate: ${(vaultData as any).delegate.toBase58()}`);

  await driftClient.unsubscribe();
}

main().catch((e) => {
  console.error("Error:", e.message);
  if (e.logs) e.logs.slice(-5).forEach((l: string) => console.error("  ", l));
  process.exit(1);
});
