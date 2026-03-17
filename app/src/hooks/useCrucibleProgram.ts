"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN, setProvider } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import idl from "@/lib/idl.json";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "Guq3DZZQ1PfAU49TG7WuEweSp6bjko8yVMdH3a3Hszfb"
);
const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || "GAV4FB6iiyHvTQt6gqFsjD2kg57oyc8ZLmdicsMwxugP"
);

export function useCrucibleProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletPubkeyStr = wallet.publicKey?.toBase58() || "";

  const program = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    setProvider(provider);
    return new Program(idl as any, provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, walletPubkeyStr]);

  const getConfigPda = () =>
    PublicKey.findProgramAddressSync([Buffer.from("crucible_config")], PROGRAM_ID);

  const getMatchPda = (matchId: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("match"), new BN(matchId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );

  const getMatchVaultPda = (matchPubkey: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("match_vault"), matchPubkey.toBuffer()],
      PROGRAM_ID
    );

  const fetchConfig = async () => {
    if (!program) return null;
    const [configPda] = getConfigPda();
    try {
      return await (program.account as any).crucibleConfig.fetch(configPda);
    } catch {
      return null;
    }
  };

  const fetchMatches = async () => {
    if (!program) return [];
    try {
      return await (program.account as any).matchEscrow.all();
    } catch {
      return [];
    }
  };

  const createMatch = async (params: {
    scoring: { pnlPercent: {} } | { sharpe: {} } | { riskAdjusted: {} };
    duration: number;
    stakeAmount: number;
    capitalAmount: number;
    maxLeverage: number;
    opponent?: PublicKey;
  }) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const config = await fetchConfig();
    if (!config) throw new Error("Crucible not initialized");

    const matchCount = (config as any).matchCount.toNumber();
    const [configPda] = getConfigPda();
    const [matchPda] = getMatchPda(matchCount);
    const [escrowVaultPda] = getMatchVaultPda(matchPda);

    const challengerToken = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

    const tokenInfo = await connection.getAccountInfo(challengerToken);
    if (!tokenInfo) {
      throw new Error("No USDC token account found. You need test USDC.");
    }

    const protocolId = new Uint8Array(32);
    new TextEncoder().encode("drift").forEach((b, i) => (protocolId[i] = b));
    const vaultId = new Uint8Array(32);

    const tx = await (program.methods as any)
      .createMatch({
        scoring: params.scoring,
        protocolId: Array.from(protocolId),
        duration: params.duration,
        stakeAmount: new BN(params.stakeAmount * 1e6),
        capitalAmount: new BN(params.capitalAmount * 1e6),
        maxLeverage: params.maxLeverage,
        challengerVault: Array.from(vaultId),
        opponent: params.opponent || PublicKey.default,
      })
      .accounts({
        challenger: wallet.publicKey,
        config: configPda,
        matchEscrow: matchPda,
        escrowVault: escrowVaultPda,
        challengerToken,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, matchId: matchCount, matchPda };
  };

  const acceptMatch = async (matchPda: PublicKey) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const [configPda] = getConfigPda();
    const [escrowVaultPda] = getMatchVaultPda(matchPda);
    const opponentToken = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

    const tx = await (program.methods as any)
      .acceptMatch()
      .accounts({
        opponent: wallet.publicKey,
        config: configPda,
        matchEscrow: matchPda,
        escrowVault: escrowVaultPda,
        opponentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { tx };
  };

  const cancelMatch = async (matchPda: PublicKey) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const challengerToken = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
    const [escrowVaultPda] = getMatchVaultPda(matchPda);

    const tx = await (program.methods as any)
      .cancelMatch()
      .accounts({
        challenger: wallet.publicKey,
        matchEscrow: matchPda,
        escrowVault: escrowVaultPda,
        challengerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { tx };
  };

  return {
    program,
    programId: PROGRAM_ID,
    usdcMint: USDC_MINT,
    connected: !!wallet.publicKey,
    walletPublicKey: wallet.publicKey,
    fetchConfig,
    fetchMatches,
    createMatch,
    acceptMatch,
    cancelMatch,
    getConfigPda,
    getMatchPda,
    getMatchVaultPda,
  };
}
