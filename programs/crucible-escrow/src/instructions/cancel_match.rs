use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::CrucibleError;

#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        constraint = match_escrow.state == MatchState::Created @ CrucibleError::InvalidMatchState,
        constraint = match_escrow.challenger == challenger.key() @ CrucibleError::Unauthorized,
    )]
    pub match_escrow: Box<Account<'info, MatchEscrow>>,

    #[account(
        mut,
        seeds = [b"match_vault", match_escrow.key().as_ref()],
        bump = match_escrow.escrow_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = challenger_token.owner == challenger.key())]
    pub challenger_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelMatch>) -> Result<()> {
    let escrow = &ctx.accounts.match_escrow;
    let match_id_bytes = escrow.id.to_le_bytes();
    let seeds = &[b"match" as &[u8], match_id_bytes.as_ref(), &[escrow.bump]];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.challenger_token.to_account_info(),
                authority: ctx.accounts.match_escrow.to_account_info(),
            },
            signer_seeds,
        ),
        escrow.stake_amount,
    )?;

    ctx.accounts.match_escrow.state = MatchState::Cancelled;
    msg!("Match #{} cancelled", ctx.accounts.match_escrow.id);
    Ok(())
}
