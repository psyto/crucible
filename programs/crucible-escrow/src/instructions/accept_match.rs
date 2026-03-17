use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::CrucibleError;

#[derive(Accounts)]
pub struct AcceptMatch<'info> {
    #[account(mut)]
    pub opponent: Signer<'info>,

    #[account(seeds = [b"crucible_config"], bump = config.bump)]
    pub config: Account<'info, CrucibleConfig>,

    #[account(
        mut,
        constraint = match_escrow.state == MatchState::Created @ CrucibleError::InvalidMatchState,
        constraint = match_escrow.opponent == Pubkey::default() || match_escrow.opponent == opponent.key(),
        constraint = match_escrow.challenger != opponent.key() @ CrucibleError::SelfMatch,
    )]
    pub match_escrow: Box<Account<'info, MatchEscrow>>,

    #[account(
        mut,
        seeds = [b"match_vault", match_escrow.key().as_ref()],
        bump = match_escrow.escrow_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = opponent_token.mint == config.usdc_mint,
        constraint = opponent_token.owner == opponent.key(),
    )]
    pub opponent_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<AcceptMatch>) -> Result<()> {
    let escrow = &ctx.accounts.match_escrow;

    // Check challenge hasn't expired (24h)
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < escrow.created_at + 86400, CrucibleError::MatchExpired);

    // Transfer opponent stake
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.opponent_token.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.opponent.to_account_info(),
            },
        ),
        escrow.stake_amount,
    )?;

    let escrow = &mut ctx.accounts.match_escrow;
    escrow.opponent = ctx.accounts.opponent.key();
    escrow.state = MatchState::Active;
    let next_minute = ((clock.unix_timestamp / 60) + 1) * 60;
    escrow.started_at = next_minute;
    escrow.ends_at = next_minute + escrow.duration as i64;

    msg!("Match #{} accepted. Starts at {}", escrow.id, escrow.started_at);
    Ok(())
}
