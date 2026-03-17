use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::CrucibleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMatchParams {
    pub scoring: ScoringMethod,
    pub protocol_id: [u8; 32],
    pub duration: u32,
    pub stake_amount: u64,
    pub capital_amount: u64,
    pub max_leverage: u8,
    pub challenger_vault: [u8; 32],
    /// Specific opponent, or Pubkey::default for open challenge.
    pub opponent: Pubkey,
}

#[derive(Accounts)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [b"crucible_config"],
        bump = config.bump,
    )]
    pub config: Account<'info, CrucibleConfig>,

    #[account(
        init,
        payer = challenger,
        space = 8 + MatchEscrow::INIT_SPACE,
        seeds = [b"match", config.match_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub match_escrow: Box<Account<'info, MatchEscrow>>,

    #[account(
        init,
        payer = challenger,
        token::mint = usdc_mint,
        token::authority = match_escrow,
        seeds = [b"match_vault", match_escrow.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = challenger_token.mint == config.usdc_mint,
        constraint = challenger_token.owner == challenger.key(),
    )]
    pub challenger_token: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMatch>, params: CreateMatchParams) -> Result<()> {
    let config = &ctx.accounts.config;

    require!(params.stake_amount >= config.min_stake, CrucibleError::StakeTooLow);
    require!(params.stake_amount <= config.max_stake, CrucibleError::StakeTooHigh);
    require!(params.opponent != ctx.accounts.challenger.key(), CrucibleError::SelfMatch);

    // Transfer stake to escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.challenger_token.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.challenger.to_account_info(),
            },
        ),
        params.stake_amount,
    )?;

    let clock = Clock::get()?;
    let escrow = &mut ctx.accounts.match_escrow;
    escrow.id = ctx.accounts.config.match_count;
    escrow.challenger = ctx.accounts.challenger.key();
    escrow.opponent = params.opponent;
    escrow.state = MatchState::Created;
    escrow.scoring = params.scoring;
    escrow.protocol_id = params.protocol_id;
    escrow.duration = params.duration;
    escrow.stake_amount = params.stake_amount;
    escrow.capital_amount = params.capital_amount;
    escrow.max_leverage = params.max_leverage;
    escrow.challenger_vault = params.challenger_vault;
    escrow.opponent_vault = [0u8; 32];
    escrow.created_at = clock.unix_timestamp;
    escrow.started_at = 0;
    escrow.ends_at = 0;
    escrow.challenger_score = 0;
    escrow.opponent_score = 0;
    escrow.winner = Pubkey::default();
    escrow.escrow_bump = ctx.bumps.escrow_vault;
    escrow.bump = ctx.bumps.match_escrow;

    let config = &mut ctx.accounts.config;
    config.match_count = config.match_count.checked_add(1).ok_or(CrucibleError::MathOverflow)?;

    msg!("Match #{} created by {}", escrow.id, escrow.challenger);
    Ok(())
}
