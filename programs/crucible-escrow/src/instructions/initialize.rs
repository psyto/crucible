use anchor_lang::prelude::*;
use crate::state::CrucibleConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub fee_bps: u16,
    pub min_stake: u64,
    pub max_stake: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + CrucibleConfig::INIT_SPACE,
        seeds = [b"crucible_config"],
        bump,
    )]
    pub config: Account<'info, CrucibleConfig>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    /// CHECK: fee recipient
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.fee_recipient = ctx.accounts.fee_recipient.key();
    config.fee_bps = params.fee_bps;
    config.min_stake = params.min_stake;
    config.max_stake = params.max_stake;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.match_count = 0;
    config.bump = ctx.bumps.config;

    msg!("Crucible initialized. Admin: {}", config.admin);
    Ok(())
}
