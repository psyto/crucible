"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScoringMethod,
  SCORING_OPTIONS,
  DURATION_OPTIONS,
} from "@/lib/types";

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateMatchModal({ isOpen, onClose }: CreateMatchModalProps) {
  const [scoring, setScoring] = useState<ScoringMethod>(ScoringMethod.PnlPercent);
  const [duration, setDuration] = useState(86400);
  const [stake, setStake] = useState("50");
  const [capital, setCapital] = useState("5000");
  const [maxLeverage, setMaxLeverage] = useState("10");

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

            {/* Protocol (fixed) */}
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

            {/* Stake */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Stake (USDC)
              </label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-crucible-accent/50"
                placeholder="50"
              />
            </div>

            {/* Capital */}
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Capital per Vault (USDC)
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-crucible-accent/50"
                placeholder="5000"
              />
            </div>

            {/* Max Leverage */}
            <div className="mb-6">
              <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wider">
                Max Leverage
              </label>
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                className="w-full bg-crucible-bg border border-crucible-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-crucible-accent/50"
                placeholder="10"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-crucible-border text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg bg-crucible-accent text-white text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Create Match
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 text-center">
              Not wired to on-chain program yet. Static preview only.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
