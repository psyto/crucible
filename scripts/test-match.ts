/**
 * Test the full match lifecycle on devnet:
 * create -> accept -> (wait) -> settle
 *
 * Usage: npx ts-node test-match.ts
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("Guq3DZZQ1PfAU49TG7WuEweSp6bjko8yVMdH3a3Hszfb");
const USDC_MINT = new PublicKey("GAV4FB6iiyHvTQt6gqFsjD2kg57oyc8ZLmdicsMwxugP");
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

  // Create opponent keypair
  const opponent = Keypair.generate();
  console.log(`Admin:    ${admin.publicKey.toBase58()}`);
  console.log(`Opponent: ${opponent.publicKey.toBase58()}`);

  // Fund opponent
  const sig = await connection.requestAirdrop(opponent.publicKey, 0.1 * 1e9).catch(() => null);
  if (!sig) {
    // Airdrop failed, transfer from admin
    const tx = new (await import("@solana/web3.js")).Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: opponent.publicKey,
        lamports: 0.1 * 1e9,
      })
    );
    await (await import("@solana/web3.js")).sendAndConfirmTransaction(connection, tx, [admin]);
  }

  // Mint USDC to opponent
  const opponentToken = await getOrCreateAssociatedTokenAccount(
    connection, admin, USDC_MINT, opponent.publicKey
  );
  await mintTo(connection, admin, USDC_MINT, opponentToken.address, admin, 10000 * 1e6);
  console.log(`Opponent USDC: ${opponentToken.address.toBase58()}`);

  // Admin program client
  const adminProvider = new anchor.AnchorProvider(
    connection, new anchor.Wallet(admin), { commitment: "confirmed" }
  );
  anchor.setProvider(adminProvider);
  const adminProgram = new anchor.Program(idl, adminProvider);

  // Opponent program client
  const opponentProvider = new anchor.AnchorProvider(
    connection, new anchor.Wallet(opponent), { commitment: "confirmed" }
  );
  const opponentProgram = new anchor.Program(idl, opponentProvider);

  // ── 1. Fetch config ──
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("crucible_config")], PROGRAM_ID
  );
  const config = await (adminProgram.account as any).crucibleConfig.fetch(configPda);
  const matchId = config.matchCount.toNumber();
  console.log(`\nNext match ID: ${matchId}`);

  // ── 2. Create match ──
  console.log("\n--- Creating match ---");
  const [matchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("match"), new anchor.BN(matchId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const [escrowVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("match_vault"), matchPda.toBuffer()],
    PROGRAM_ID
  );

  const adminToken = await getOrCreateAssociatedTokenAccount(
    connection, admin, USDC_MINT, admin.publicKey
  );

  // Protocol ID as 32 bytes (hash of "drift")
  const protocolId = new Uint8Array(32);
  new TextEncoder().encode("drift").forEach((b, i) => protocolId[i] = b);

  // Vault ID placeholder
  const vaultId = new Uint8Array(32);

  const stakeAmount = 100 * 1e6; // 100 USDC

  const tx1 = await (adminProgram.methods as any)
    .createMatch({
      scoring: { pnlPercent: {} },
      protocolId: Array.from(protocolId),
      duration: 60, // 1 minute for testing
      stakeAmount: new anchor.BN(stakeAmount),
      capitalAmount: new anchor.BN(1000 * 1e6),
      maxLeverage: 10,
      challengerVault: Array.from(vaultId),
      opponent: PublicKey.default,
    })
    .accounts({
      challenger: admin.publicKey,
      config: configPda,
      matchEscrow: matchPda,
      escrowVault: escrowVaultPda,
      challengerToken: adminToken.address,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`Match #${matchId} created! TX: ${tx1}`);

  // ── 3. Accept match ──
  console.log("\n--- Accepting match ---");
  const tx2 = await (opponentProgram.methods as any)
    .acceptMatch()
    .accounts({
      opponent: opponent.publicKey,
      config: configPda,
      matchEscrow: matchPda,
      escrowVault: escrowVaultPda,
      opponentToken: opponentToken.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([opponent])
    .rpc();

  console.log(`Match accepted! TX: ${tx2}`);

  // Check match state
  const matchData = await (adminProgram.account as any).matchEscrow.fetch(matchPda);
  console.log(`State: ${Object.keys(matchData.state)[0]}`);
  console.log(`Ends at: ${new Date(matchData.endsAt.toNumber() * 1000).toISOString()}`);

  // ── 4. Wait for expiry then settle ──
  const endsAt = matchData.endsAt.toNumber();
  const waitTime = Math.max(0, endsAt - Math.floor(Date.now() / 1000)) + 2;
  console.log(`\nWaiting ${waitTime}s for match to expire...`);
  await new Promise(r => setTimeout(r, waitTime * 1000));

  console.log("\n--- Settling match ---");
  const feeToken = await getOrCreateAssociatedTokenAccount(
    connection, admin, USDC_MINT, admin.publicKey
  );

  const tx3 = await (adminProgram.methods as any)
    .settleMatch({
      challengerScore: new anchor.BN(1250), // 12.5%
      opponentScore: new anchor.BN(830),    // 8.3%
    })
    .accounts({
      admin: admin.publicKey,
      config: configPda,
      matchEscrow: matchPda,
      escrowVault: escrowVaultPda,
      winnerToken: adminToken.address,       // challenger wins
      loserToken: opponentToken.address,
      feeToken: feeToken.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(`Match settled! TX: ${tx3}`);

  // Verify final state
  const finalMatch = await (adminProgram.account as any).matchEscrow.fetch(matchPda);
  console.log(`\nFinal state: ${Object.keys(finalMatch.state)[0]}`);
  console.log(`Winner: ${finalMatch.winner.toBase58()}`);
  console.log(`Challenger score: ${finalMatch.challengerScore.toNumber()} bps`);
  console.log(`Opponent score: ${finalMatch.opponentScore.toNumber()} bps`);

  console.log("\n=========================================");
  console.log("  FULL MATCH LIFECYCLE TEST PASSED");
  console.log("=========================================");
}

main().catch(console.error);
