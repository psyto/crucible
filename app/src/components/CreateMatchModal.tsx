"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCrucibleProgram } from "@/hooks/useCrucibleProgram";
import {
  ScoringMethod,
  SCORING_OPTIONS,
  DURATION_OPTIONS,
} from "@/lib/types";

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateMatchModal({ isOpen, onClose, onCreated }: CreateMatchModalProps) {
  const { createMatch, connected } = useCrucibleProgram();
  const [scoring, setScoring] = useState<ScoringMethod>(ScoringMethod.PnlPercent);
  const [duration, setDuration] = useState(86400);
  const [stake, setStake] = useState("50");
  const [capital, setCapital] = useState("5000");
  const [maxLeverage, setMaxLeverage] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const scoringEnum = {
    [ScoringMethod.PnlPercent]: { pnlPercent: {} },
    [ScoringMethod.Sharpe]: { sharpe: {} },
    [ScoringMethod.RiskAdjusted]: { riskAdjusted: {} },
  };

  const handleCreate = async () => {
    if (!connected) {
      setError("Connect your wallet first");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createMatch({
        scoring: scoringEnum[scoring] as any,
        duration,
        stakeAmount: parseFloat(stake) || 50,
        capitalAmount: parseFloat(capital) || 5000,
        maxLeverage: parseInt(maxLeverage) || 10,
      });

      setSuccess(
        `Match #${result.matchId} created! ${stake} USDC staked. TX: ${result.tx.slice(0, 16)}...`
      );
      onCreated?.();
    } catch (err: any) {
      console.error("Create match error:", err);
      setError(err.message || "Failed to create match");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-crucible-card border border-crucible-border rounded-xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-6">Create Match</h2>

            {!connected && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                Connect your wallet to create an on-chain match.
              </div>
            )}

            {/* Protocol */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Protocol
              </label>
              <div className="bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-300">
                Drift Protocol (Solana)
              </div>
            </div>

            {/* Scoring Method */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Scoring Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SCORING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScoring(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      scoring === opt.value
                        ? "bg-crucible-accent/10 border-crucible-accent/40 text-crucible-accent"
                        : "bg-crucible-bg border-crucible-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      duration === opt.value
                        ? "bg-crucible-accent/10 border-crucible-accent/40 text-crucible-accent"
                        : "bg-crucible-bg border-crucible-border text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake + Capital */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                  Stake (USDC)
                </label>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="w-full bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-crucible-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                  Capital per Vault
                </label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  className="w-full bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-crucible-accent/50"
                />
              </div>
            </div>

            {/* Max Leverage */}
            <div className="mb-5">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Max Leverage: {maxLeverage}x
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                className="w-full h-2 bg-crucible-border rounded-lg appearance-none cursor-pointer accent-crucible-accent"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>1x</span>
                <span>20x</span>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-crucible-bg rounded-lg p-3 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Your Stake</span>
                <span className="text-slate-300">{stake} USDC</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Winner Receives</span>
                <span className="text-crucible-green">
                  {(parseFloat(stake || "0") * 2 * 0.95).toFixed(0)} USDC
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Protocol Fee (5%)</span>
                <span className="text-slate-400">
                  {(parseFloat(stake || "0") * 2 * 0.05).toFixed(0)} USDC
                </span>
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            {success ? (
              <div>
                <div className="mb-4 px-4 py-4 rounded-xl bg-crucible-green/10 border border-crucible-green/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-crucible-green font-bold text-sm">Match Created</span>
                  </div>
                  <p className="text-crucible-green/80 text-xs">{success}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setSuccess(null); onClose(); }}
                    className="flex-1 px-4 py-3 rounded-lg border border-crucible-border text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Close
                  </button>
                  <a
                    href="/matches"
                    className="flex-1 px-4 py-3 rounded-lg bg-crucible-accent text-white text-sm font-bold text-center hover:bg-red-600 transition-colors"
                  >
                    View Matches
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-lg border border-crucible-border text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-lg bg-crucible-accent text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing...
                    </span>
                  ) : connected ? (
                    "Create Match"
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
