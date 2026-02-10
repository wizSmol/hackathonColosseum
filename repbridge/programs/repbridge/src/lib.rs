use anchor_lang::prelude::*;

declare_id!("CTqxMTPmzGfinjc5oDZna7NnyeBuzENLzxFttincvezK");

/// RepBridge Solana Program
/// Receives cross-chain reputation attestations via Hyperlane
#[program]
pub mod repbridge {
    use super::*;

    /// Initialize the program state
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.program_state;
        state.admin = admin;
        state.paused = false;
        state.total_bridged = 0;
        Ok(())
    }

    /// Handle incoming Hyperlane message with reputation attestation
    /// Called by Hyperlane Mailbox after message validation
    pub fn handle_message(
        ctx: Context<HandleMessage>,
        origin: u32,           // Source domain ID
        _sender: [u8; 32],      // Sender address on source chain
        message: Vec<u8>,      // Encoded ReputationAttestation
    ) -> Result<()> {
        let state = &ctx.accounts.program_state;
        require!(!state.paused, RepBridgeError::Paused);

        // Decode the attestation
        let attestation = ReputationAttestation::try_from_slice(&message)
            .map_err(|_| RepBridgeError::InvalidMessage)?;

        // Verify nonce is greater than last seen (replay protection)
        let bridged_rep = &mut ctx.accounts.bridged_reputation;
        if bridged_rep.is_initialized {
            require!(
                attestation.nonce > bridged_rep.nonce,
                RepBridgeError::ReplayedMessage
            );
        }

        // Verify timestamp is within validity window (24 hours)
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let attestation_age = current_time - attestation.timestamp as i64;
        require!(
            attestation_age >= 0 && attestation_age < 86400, // 24 hours
            RepBridgeError::StaleAttestation
        );

        // Store the bridged reputation
        bridged_rep.is_initialized = true;
        bridged_rep.source_agent = attestation.agent;
        bridged_rep.score = attestation.score;
        bridged_rep.source_chain = origin;
        bridged_rep.timestamp = current_time;
        bridged_rep.nonce = attestation.nonce;
        bridged_rep.attestation_id = attestation.attestation_id;
        bridged_rep.bump = ctx.bumps.bridged_reputation;

        // Increment total bridged counter
        let state = &mut ctx.accounts.program_state;
        state.total_bridged += 1;

        emit!(ReputationBridged {
            source_agent: bridged_rep.source_agent.clone(),
            score: attestation.score,
            source_chain: origin,
            nonce: attestation.nonce,
        });

        Ok(())
    }

    /// Query bridged reputation for an agent
    pub fn query_reputation(ctx: Context<QueryReputation>) -> Result<BridgedReputationData> {
        let rep = &ctx.accounts.bridged_reputation;
        require!(rep.is_initialized, RepBridgeError::NotFound);

        Ok(BridgedReputationData {
            source_agent: rep.source_agent.clone(),
            score: rep.score,
            source_chain: rep.source_chain,
            timestamp: rep.timestamp,
            nonce: rep.nonce,
        })
    }

    /// Admin: Pause the bridge
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.program_state.paused = paused;
        Ok(())
    }
}

// ============ Accounts ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + ProgramState::INIT_SPACE,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(origin: u32, sender: [u8; 32], message: Vec<u8>)]
pub struct HandleMessage<'info> {
    #[account(
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BridgedReputation::INIT_SPACE,
        seeds = [b"bridged_rep", &message[0..20]], // First 20 bytes = agent address
        bump
    )]
    pub bridged_reputation: Account<'info, BridgedReputation>,

    // TODO: Add Hyperlane Mailbox account verification
    // For MVP, we trust the caller; production needs ISM validation

    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct QueryReputation<'info> {
    pub bridged_reputation: Account<'info, BridgedReputation>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"program_state"],
        bump,
        has_one = admin
    )]
    pub program_state: Account<'info, ProgramState>,
    
    pub admin: Signer<'info>,
}

// ============ State ============

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub paused: bool,
    pub total_bridged: u64,
}

#[account]
#[derive(InitSpace)]
pub struct BridgedReputation {
    pub is_initialized: bool,
    #[max_len(20)]
    pub source_agent: Vec<u8>,      // EVM address (20 bytes)
    pub score: u64,                  // Reputation score
    pub source_chain: u32,           // Hyperlane domain ID
    pub timestamp: i64,              // When bridged
    pub nonce: u64,                  // For replay protection
    #[max_len(32)]
    pub attestation_id: Vec<u8>,     // Original attestation hash
    pub bump: u8,
}

// ============ Messages ============

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ReputationAttestation {
    pub agent: Vec<u8>,             // 20 bytes EVM address
    pub score: u64,
    pub source_chain: u32,
    pub timestamp: u64,
    pub nonce: u64,
    pub attestation_id: Vec<u8>,    // 32 bytes
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BridgedReputationData {
    pub source_agent: Vec<u8>,
    pub score: u64,
    pub source_chain: u32,
    pub timestamp: i64,
    pub nonce: u64,
}

// ============ Events ============

#[event]
pub struct ReputationBridged {
    pub source_agent: Vec<u8>,
    pub score: u64,
    pub source_chain: u32,
    pub nonce: u64,
}

// ============ Errors ============

#[error_code]
pub enum RepBridgeError {
    #[msg("Bridge is paused")]
    Paused,
    #[msg("Invalid message format")]
    InvalidMessage,
    #[msg("Message has already been processed (replay)")]
    ReplayedMessage,
    #[msg("Attestation is too old")]
    StaleAttestation,
    #[msg("No bridged reputation found")]
    NotFound,
}
