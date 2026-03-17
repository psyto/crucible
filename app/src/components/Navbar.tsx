"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const NAV_ITEMS = [
  { href: "/", label: "Arena" },
  { href: "/matches", label: "Matches" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-crucible-border bg-crucible-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-crucible-accent to-orange-600 flex items-center justify-center text-white font-bold text-sm">
              C
            </div>
            <span className="text-lg font-bold flex items-center gap-1.5">
              <span className="text-crucible-accent">Crucible</span>
              <svg
                viewBox="0 0 16 20"
                className="w-4 h-5 text-crucible-accent opacity-80 group-hover:opacity-100 transition-opacity"
                fill="currentColor"
              >
                <path d="M8 0C8 0 14 6 14 11C14 14.5 11.3 17 8 17C4.7 17 2 14.5 2 11C2 9 3 7 4 5.5C4 5.5 5 8 6.5 8.5C6.5 8.5 5.5 4 8 0Z" />
                <path
                  d="M8 9C8 9 10.5 11.5 10.5 13.5C10.5 14.9 9.4 16 8 16C6.6 16 5.5 14.9 5.5 13.5C5.5 11.5 8 9 8 9Z"
                  className="text-orange-400"
                  fill="currentColor"
                />
              </svg>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-crucible-accent/15 text-crucible-accent border border-crucible-accent/25 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Wallet */}
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
