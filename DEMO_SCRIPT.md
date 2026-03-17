# Crucible Demo Video Script

Total length: ~2 minutes. Screen record with voiceover.

Tools: QuickTime (screen record) or OBS. Record the terminal and browser side by side.

---

## Scene 1: Hook (10 seconds)

**Screen:** Show the Crucible homepage at localhost:3456.

**Voiceover:**
"Every perp DEX runs trading competitions. They're all the same — volume leaderboards and random raffles. None of them answer the real question: which strategy actually has edge? Crucible does."

---

## Scene 2: What It Is (15 seconds)

**Screen:** Scroll through the homepage — show "How it works" section, the active matches, the protocol badge showing Drift.

**Voiceover:**
"Crucible is a competition platform where automated trading strategies compete head-to-head with real capital. Each bot gets an isolated Drift vault. They trade as delegates. A scoring engine evaluates them by Sharpe ratio, not just PnL — because risk-adjusted returns are what separate real edge from noise."

---

## Scene 3: Live Competition (30 seconds)

**Screen:** Switch to terminal. Run the competition output (or show a pre-recorded terminal session with the output):

```
CRUCIBLE: HEAD-TO-HEAD COMPETITION
Vault A (LONG SOL) vs Vault B (SHORT SOL)

Step 1: Creating vaults
Step 2: Placing trades
  SOL price: $94.18
  Bot A: LONG 0.5 SOL-PERP
  Bot B: SHORT 0.5 SOL-PERP

RESULTS:
  Vault A: $999.90 | PnL: -0.0099%
  Vault B: $999.96 | PnL: -0.0038%
  WINNER: Vault B (SHORT)
```

**Voiceover:**
"Here's a live competition on Drift devnet. Two vaults, each funded with a thousand dollars USDC. Bot A goes long SOL. Bot B goes short. Both are trading through Drift's vault delegate system — fully isolated capital, real on-chain execution. The scoring engine reads equity from the Drift User account and determines the winner."

---

## Scene 4: Anti-MEV (15 seconds)

**Screen:** Show the match detail page in the UI, or briefly show the scoring test output (26 tests passing).

**Voiceover:**
"The obvious objection: what stops a bot from just counter-trading its opponent's visible positions? Three things. Sharpe-based scoring penalizes the volatility of counter-trading. Market diversity requirements force strategies to trade across multiple markets. And random start delays prevent targeted pre-positioning. We're not testing strategies in a clean room — we're testing strategies that survive adversarial conditions."

---

## Scene 5: Architecture (15 seconds)

**Screen:** Show the README architecture diagram, or briefly scroll the project structure.

**Voiceover:**
"Crucible is protocol-agnostic. The Drift adapter is the first implementation, but the adapter interface is universal — any protocol that can report vault equity can plug in. Jupiter Perps and Hyperliquid are next. The escrow program is deployed on Solana devnet. The scoring engine has 26 tests covering PnL, Sharpe, drawdown, and diversity penalties."

---

## Scene 6: Close (15 seconds)

**Screen:** Show the Crucible homepage hero section with the tagline.

**Voiceover:**
"Drift runs volume raffles. Other DEXs run manual leaderboards. Nobody builds skill-based, vault-isolated, risk-adjusted strategy competitions. Crucible does. The devnet MVP is live. The code is open source. If you run a trading bot and want to prove it has edge — this is where you do it."

**Screen:** Show the GitHub URL: github.com/psyto/crucible

---

## Recording Tips

1. Use a clean terminal with large font (14-16pt)
2. Browser in dark mode, zoomed to 90% so the full page is visible
3. Record at 1920x1080
4. Speak slowly and clearly — 2 minutes is plenty of time
5. No background music needed — the content speaks for itself
6. Post to Twitter with: "Built this. Two bots, $1K each, head-to-head on @DriftProtocol. Scored by Sharpe ratio. github.com/psyto/crucible"
