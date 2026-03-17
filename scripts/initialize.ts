/**
 * Initialize Crucible escrow on devnet.
 * Creates config account and mock USDC mint.
 *
 * Usage: npx ts-node initialize.ts
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("Guq3DZZQ1PfAU49TG7WuEweSp6bjko8yVMdH3a3Hszfb");
const RPC = "https://delicate-broken-bridge.solana-devnet.quiknode.pro/605a81f50b0aa55a229cbb85042b7563e44e00d2/";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const walletData = JSON.parse(
    fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const admin = Keypair.fromSecretKey(Uint8Array.from(walletData));
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/crucible_escrow.json"), "utf-8")
  );

  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(admin.publicKey)) / 1e9} SOL`);

  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);

  // Create mock USDC
  console.log("\n1. Creating mock USDC mint...");
  const usdcMint = await createMint(connection, admin, admin.publicKey, null, 6);
  console.log(`   USDC mint: ${usdcMint.toBase58()}`);

  // Initialize config
  console.log("\n2. Initializing Crucible config...");
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("crucible_config")],
    PROGRAM_ID
  );

  try {
    await (program.methods as any)
      .initialize({
        feeBps: 500,
        minStake: new anchor.BN(10 * 1e6),
        maxStake: new anchor.BN(10000 * 1e6),
      })
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        usdcMint,
        feeRecipient: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("   Crucible initialized!");
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("   Already initialized.");
    } else {
      throw err;
    }
  }

  // Mint test USDC to admin
  console.log("\n3. Minting test USDC...");
  const adminToken = await getOrCreateAssociatedTokenAccount(
    connection, admin, usdcMint, admin.publicKey
  );
  await mintTo(connection, admin, usdcMint, adminToken.address, admin, 100_000 * 1e6);
  console.log(`   Minted 100,000 USDC to ${adminToken.address.toBase58()}`);

  console.log("\n=========================================");
  console.log("  CRUCIBLE INITIALIZED ON DEVNET");
  console.log("=========================================");
  console.log(`  Program:     ${PROGRAM_ID.toBase58()}`);
  console.log(`  Config PDA:  ${configPda.toBase58()}`);
  console.log(`  USDC Mint:   ${usdcMint.toBase58()}`);
  console.log(`  Admin:       ${admin.publicKey.toBase58()}`);
  console.log("=========================================");
}

main().catch(console.error);
