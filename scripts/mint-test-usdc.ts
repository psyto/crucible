/**
 * Mint test USDC to a wallet on devnet.
 * Usage: npx ts-node mint-test-usdc.ts <WALLET_ADDRESS> [AMOUNT_USDC]
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as fs from "fs";

const USDC_MINT = new PublicKey("GAV4FB6iiyHvTQt6gqFsjD2kg57oyc8ZLmdicsMwxugP");
const RPC = "https://delicate-broken-bridge.solana-devnet.quiknode.pro/605a81f50b0aa55a229cbb85042b7563e44e00d2/";

async function main() {
  const targetWallet = process.argv[2];
  const amount = parseInt(process.argv[3] || "5000");

  if (!targetWallet) {
    console.log("Usage: npx ts-node mint-test-usdc.ts <WALLET_ADDRESS> [AMOUNT_USDC]");
    process.exit(1);
  }

  const connection = new Connection(RPC, "confirmed");
  const walletData = JSON.parse(
    fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const admin = Keypair.fromSecretKey(Uint8Array.from(walletData));
  const target = new PublicKey(targetWallet);

  console.log(`Minting ${amount} test USDC to ${target.toBase58()}...`);
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, admin, USDC_MINT, target
  );
  await mintTo(connection, admin, USDC_MINT, tokenAccount.address, admin, amount * 1e6);
  console.log(`Done. Token account: ${tokenAccount.address.toBase58()}`);
}

main().catch(console.error);
