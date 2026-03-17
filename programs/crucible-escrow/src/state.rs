use anchor_lang::prelude::*;

/// Global configuration for Crucible escrow.
#[account]
#[derive(InitSpace)]
pub struct CrucibleConfig {
    pub admin: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_bps: u16,
    pub min_stake: u64,
    pub max_stake: u64,
    pub usdc_mint: Pubkey,
    pub match_count: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MatchState {
    Created,
    Active,
    Settling,
    Completed,
    Cancelled,
    Draw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ScoringMethod {
    PnlPercent,
    Sharpe,
    RiskAdjusted,
}

/// On-chain match escrow — holds stakes and records results.
#[account]
#[derive(InitSpace)]
pub struct MatchEscrow {
    /// Unique match ID.
    pub id: u64,
    /// Challenger wallet.
    pub challenger: Pubkey,
    /// Opponent wallet (default if open).
    pub opponent: Pubkey,
    /// Current state.
    pub state: MatchState,
    /// Scoring method.
    pub scoring: ScoringMethod,
    /// Protocol identifier (hash of "drift", "jupiter", etc.)
    pub protocol_id: [u8; 32],
    /// Duration in seconds.
    pub duration: u32,
    /// Stake per side (USDC, 6 decimals).
    pub stake_amount: u64,
    /// Competition capital per side (may differ from stake).
    pub capital_amount: u64,
    /// Max leverage.
    pub max_leverage: u8,
    /// Challenger vault ID (protocol-specific, stored as 32 bytes).
    pub challenger_vault: [u8; 32],
    /// Opponent vault ID.
    pub opponent_vault: [u8; 32],
    /// Timestamps.
    pub created_at: i64,
    pub started_at: i64,
    pub ends_at: i64,
    /// Final scores (basis points, set at settlement).
    pub challenger_score: i64,
    pub opponent_score: i64,
    /// Winner (default if not settled or draw).
    pub winner: Pubkey,
    /// PDA bumps.
    pub escrow_bump: u8,
    pub bump: u8,
}
