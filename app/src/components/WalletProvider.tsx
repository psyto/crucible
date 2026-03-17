"use client";

import { useMemo, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConnProvider = ConnectionProvider as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WalletProv = SolanaWalletProvider as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModalProvider = WalletModalProvider as any;

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
    []
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnProvider endpoint={endpoint}>
      <WalletProv wallets={wallets} autoConnect>
        <ModalProvider>{children}</ModalProvider>
      </WalletProv>
    </ConnProvider>
  );
}
