import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";

// Load IDL
const idl = require("../target/idl/repbridge.json");

describe("repbridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idl, provider);
  const admin = provider.wallet.publicKey;

  // PDA for program state
  const [programStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    program.programId
  );

  it("Initializes the program", async () => {
    const tx = await program.methods
      .initialize(admin)
      .accounts({
        programState: programStatePda,
        payer: admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize tx:", tx);

    const state = await program.account.programState.fetch(programStatePda);
    expect(state.admin.toBase58()).to.equal(admin.toBase58());
    expect(state.paused).to.equal(false);
    expect(state.totalBridged.toNumber()).to.equal(0);
  });

  it("Handles a bridged reputation message", async () => {
    // Create a mock attestation
    const agentAddress = Buffer.alloc(20);
    agentAddress.write("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "hex");

    const score = new anchor.BN(850);
    const sourceChain = 84532; // Base Sepolia domain
    // Use cluster clock time instead of system time
    const slot = await provider.connection.getSlot();
    const clusterTime = await provider.connection.getBlockTime(slot);
    const timestamp = clusterTime || Math.floor(Date.now() / 1000);
    const nonce = new anchor.BN(1);
    const attestationId = Buffer.alloc(32);
    attestationId.write("abcd".repeat(16), "hex");

    // Encode the attestation using borsh-compatible format
    const attestation = Buffer.concat([
      // agent: Vec<u8> (4 bytes length + data)
      Buffer.from(new Uint8Array(new Uint32Array([20]).buffer)), // length = 20
      agentAddress,
      // score: u64
      Buffer.from(new Uint8Array(score.toArrayLike(Buffer, "le", 8))),
      // source_chain: u32
      Buffer.from(new Uint8Array(new Uint32Array([sourceChain]).buffer)),
      // timestamp: u64
      Buffer.from(new Uint8Array(new anchor.BN(timestamp).toArrayLike(Buffer, "le", 8))),
      // nonce: u64
      Buffer.from(new Uint8Array(nonce.toArrayLike(Buffer, "le", 8))),
      // attestation_id: Vec<u8> (4 bytes length + data)
      Buffer.from(new Uint8Array(new Uint32Array([32]).buffer)), // length = 32
      attestationId,
    ]);

    const origin = sourceChain;
    const sender = Buffer.alloc(32); // mock Hyperlane sender

    // PDA for bridged reputation (seeded with first 20 bytes of message = agent address)
    const [bridgedRepPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridged_rep"), attestation.slice(0, 20)],
      program.programId
    );

    const tx = await program.methods
      .handleMessage(origin, Array.from(sender), Buffer.from(attestation))
      .accounts({
        programState: programStatePda,
        bridgedReputation: bridgedRepPda,
        payer: admin,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("HandleMessage tx:", tx);

    const rep = await program.account.bridgedReputation.fetch(bridgedRepPda);
    expect(rep.isInitialized).to.equal(true);
    expect(rep.score.toNumber()).to.equal(850);
    expect(rep.sourceChain).to.equal(sourceChain);
    expect(rep.nonce.toNumber()).to.equal(1);
  });

  it("Rejects replayed messages (same nonce)", async () => {
    const agentAddress = Buffer.alloc(20);
    agentAddress.write("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "hex");

    const score = new anchor.BN(900);
    const sourceChain = 84532;
    const slot = await provider.connection.getSlot();
    const clusterTime = await provider.connection.getBlockTime(slot);
    const timestamp = clusterTime || Math.floor(Date.now() / 1000);
    const nonce = new anchor.BN(1); // Same nonce as before — should fail

    const attestationId = Buffer.alloc(32);

    const attestation = Buffer.concat([
      Buffer.from(new Uint8Array(new Uint32Array([20]).buffer)),
      agentAddress,
      Buffer.from(new Uint8Array(score.toArrayLike(Buffer, "le", 8))),
      Buffer.from(new Uint8Array(new Uint32Array([sourceChain]).buffer)),
      Buffer.from(new Uint8Array(new anchor.BN(timestamp).toArrayLike(Buffer, "le", 8))),
      Buffer.from(new Uint8Array(nonce.toArrayLike(Buffer, "le", 8))),
      Buffer.from(new Uint8Array(new Uint32Array([32]).buffer)),
      attestationId,
    ]);

    const origin = sourceChain;
    const sender = Buffer.alloc(32);

    const [bridgedRepPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridged_rep"), attestation.slice(0, 20)],
      program.programId
    );

    try {
      await program.methods
        .handleMessage(origin, Array.from(sender), Buffer.from(attestation))
        .accounts({
          programState: programStatePda,
          bridgedReputation: bridgedRepPda,
          payer: admin,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown replay error");
    } catch (err: any) {
      const errStr = err.toString();
      expect(
        errStr.includes("ReplayedMessage") || errStr.includes("6002")
      ).to.be.true;
    }
  });

  it("Allows pause and unpause by admin", async () => {
    // Pause
    await program.methods
      .setPaused(true)
      .accounts({
        programState: programStatePda,
        admin: admin,
      })
      .rpc();

    let state = await program.account.programState.fetch(programStatePda);
    expect(state.paused).to.equal(true);

    // Unpause
    await program.methods
      .setPaused(false)
      .accounts({
        programState: programStatePda,
        admin: admin,
      })
      .rpc();

    state = await program.account.programState.fetch(programStatePda);
    expect(state.paused).to.equal(false);
  });
});
