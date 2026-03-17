use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, CloseAccount};
use crate::state::*;
use crate::CrucibleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SettleMatchParams {
    pub challenger_score: i64,
    pub opponent_score: i64,
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(constraint = admin.key() == config.admin @ CrucibleError::Unauthorized)]
    pub admin: Signer<'info>,

    #[account(seeds = [b"crucible_config"], bump = config.bump)]
    pub config: Account<'info, CrucibleConfig>,

    #[account(
        mut,
        constraint = match_escrow.state == MatchState::Active @ CrucibleError::InvalidMatchState,
    )]
    pub match_escrow: Box<Account<'info, MatchEscrow>>,

    #[account(
        mut,
        seeds = [b"match_vault", match_escrow.key().as_ref()],
        bump = match_escrow.escrow_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Winner's token account.
    #[account(mut)]
    pub winner_token: Account<'info, TokenAccount>,

    /// Loser's token account (for draw refunds).
    #[account(mut)]
    pub loser_token: Account<'info, TokenAccount>,

    /// Fee recipient.
    #[account(mut, constraint = fee_token.owner == config.fee_recipient)]
    pub fee_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SettleMatch>, params: SettleMatchParams) -> Result<()> {
    let escrow = &ctx.accounts.match_escrow;

    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= escrow.ends_at, CrucibleError::MatchNotExpired);

    let total_pool = escrow.stake_amount.checked_mul(2).ok_or(CrucibleError::MathOverflow)?;
    let fee = total_pool
        .checked_mul(ctx.accounts.config.fee_bps as u64)
        .ok_or(CrucibleError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(CrucibleError::MathOverflow)?;
    let payout = total_pool.checked_sub(fee).ok_or(CrucibleError::MathOverflow)?;

    // PDA signer — match escrow is the vault authority
    let match_id_bytes = escrow.id.to_le_bytes();
    let seeds = &[b"match" as &[u8], match_id_bytes.as_ref(), &[escrow.bump]];
    let signer_seeds = &[&seeds[..]];

    let is_draw = params.challenger_score == params.opponent_score;

    if is_draw {
        let refund_each = payout / 2;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.winner_token.to_account_info(),
                    authority: ctx.accounts.match_escrow.to_account_info(),
                },
                signer_seeds,
            ),
            refund_each,
        )?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.loser_token.to_account_info(),
                    authority: ctx.accounts.match_escrow.to_account_info(),
                },
                signer_seeds,
            ),
            refund_each,
        )?;
    } else {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.winner_token.to_account_info(),
                    authority: ctx.accounts.match_escrow.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
        )?;
    }

    // Protocol fee
    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.fee_token.to_account_info(),
                    authority: ctx.accounts.match_escrow.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
        )?;
    }

    // Close escrow vault
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.escrow_vault.to_account_info(),
            destination: ctx.accounts.admin.to_account_info(),
            authority: ctx.accounts.match_escrow.to_account_info(),
        },
        signer_seeds,
    ))?;

    // Update state
    let escrow = &mut ctx.accounts.match_escrow;
    escrow.challenger_score = params.challenger_score;
    escrow.opponent_score = params.opponent_score;

    if is_draw {
        escrow.state = MatchState::Draw;
    } else if params.challenger_score > params.opponent_score {
        escrow.state = MatchState::Completed;
        escrow.winner = escrow.challenger;
    } else {
        escrow.state = MatchState::Completed;
        escrow.winner = escrow.opponent;
    }

    msg!("Match #{} settled. Winner: {}", escrow.id, escrow.winner);
    Ok(())
}
