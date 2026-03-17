use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("CrucEscrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod crucible_escrow {
    use super::*;

    /// Initialize the global Crucible config. Called once by admin.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Create a match escrow. Challenger deposits stake.
    pub fn create_match(ctx: Context<CreateMatch>, params: CreateMatchParams) -> Result<()> {
        instructions::create_match::handler(ctx, params)
    }

    /// Accept a match. Opponent deposits matching stake.
    pub fn accept_match(ctx: Context<AcceptMatch>) -> Result<()> {
        instructions::accept_match::handler(ctx)
    }

    /// Settle a match. Coordinator submits scores, escrow pays winner.
    pub fn settle_match(ctx: Context<SettleMatch>, params: SettleMatchParams) -> Result<()> {
        instructions::settle_match::handler(ctx, params)
    }

    /// Cancel an unaccepted match. Returns stake to challenger.
    pub fn cancel_match(ctx: Context<CancelMatch>) -> Result<()> {
        instructions::cancel_match::handler(ctx)
    }
}

#[error_code]
pub enum CrucibleError {
    #[msg("Match is not in the expected state")]
    InvalidMatchState,
    #[msg("Match has not yet expired")]
    MatchNotExpired,
    #[msg("Match challenge has expired")]
    MatchExpired,
    #[msg("Stake below minimum")]
    StakeTooLow,
    #[msg("Stake above maximum")]
    StakeTooHigh,
    #[msg("Cannot match against yourself")]
    SelfMatch,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
