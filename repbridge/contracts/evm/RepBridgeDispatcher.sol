// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IMailbox} from "./interfaces/IMailbox.sol";
import {IERC8004Registry} from "./interfaces/IERC8004Registry.sol";

/**
 * @title RepBridgeDispatcher
 * @notice Bridges ERC-8004 reputation attestations to other chains via Hyperlane
 * @dev Phase 1 MVP - Basic dispatcher without fee collection
 */
contract RepBridgeDispatcher {
    // ============ Events ============
    event ReputationBridged(
        address indexed agent,
        uint32 indexed destinationDomain,
        bytes32 indexed recipient,
        uint256 score,
        uint64 nonce,
        bytes32 messageId
    );

    event ERC8004RegistryUpdated(address oldRegistry, address newRegistry);

    // ============ Errors ============
    error NoReputationFound();
    error InsufficientFee();
    error ZeroAddress();
    error Cooldown();

    // ============ State ============
    IMailbox public immutable mailbox;
    IERC8004Registry public erc8004Registry;
    address public admin;

    // Nonce per agent for replay protection
    mapping(address => uint64) public nonces;
    
    // Last bridge timestamp per agent for cooldown
    mapping(address => uint64) public lastBridgeTime;
    
    // Cooldown period (24 hours default)
    uint64 public constant COOLDOWN_PERIOD = 24 hours;

    // ============ Constructor ============
    constructor(address _mailbox, address _erc8004Registry) {
        if (_mailbox == address(0)) revert ZeroAddress();
        mailbox = IMailbox(_mailbox);
        erc8004Registry = IERC8004Registry(_erc8004Registry);
        admin = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Bridge caller's reputation to another chain
     * @param destinationDomain Hyperlane domain ID of destination chain
     * @param recipient Recipient address on destination chain (bytes32 for cross-VM compat)
     * @return messageId The Hyperlane message ID
     */
    function bridgeReputation(
        uint32 destinationDomain,
        bytes32 recipient
    ) external payable returns (bytes32 messageId) {
        // Check cooldown
        if (block.timestamp < lastBridgeTime[msg.sender] + COOLDOWN_PERIOD) {
            revert Cooldown();
        }

        // Read reputation from ERC-8004 registry
        (uint256 score, bytes32 attestationId) = _getReputation(msg.sender);
        if (score == 0) revert NoReputationFound();

        // Increment nonce
        uint64 nonce = ++nonces[msg.sender];
        
        // Update last bridge time
        lastBridgeTime[msg.sender] = uint64(block.timestamp);

        // Encode the attestation message
        bytes memory message = _encodeAttestation(
            msg.sender,
            score,
            uint64(block.timestamp),
            nonce,
            attestationId
        );

        // Quote dispatch fee
        uint256 fee = mailbox.quoteDispatch(destinationDomain, recipient, message);
        if (msg.value < fee) revert InsufficientFee();

        // Dispatch via Hyperlane
        messageId = mailbox.dispatch{value: fee}(
            destinationDomain,
            recipient,
            message
        );

        // Refund excess
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            require(success, "Refund failed");
        }

        emit ReputationBridged(
            msg.sender,
            destinationDomain,
            recipient,
            score,
            nonce,
            messageId
        );
    }

    /**
     * @notice Get quote for bridging reputation
     * @param destinationDomain Hyperlane domain ID
     * @param recipient Recipient address (bytes32)
     * @return fee Required fee in native token
     */
    function quoteDispatch(
        uint32 destinationDomain,
        bytes32 recipient
    ) external view returns (uint256 fee) {
        // Create a dummy message for quote (actual score doesn't matter for gas estimation)
        bytes memory message = _encodeAttestation(
            msg.sender,
            1e18, // dummy score
            uint64(block.timestamp),
            nonces[msg.sender] + 1,
            bytes32(0)
        );
        
        return mailbox.quoteDispatch(destinationDomain, recipient, message);
    }

    // ============ Admin Functions ============

    function setERC8004Registry(address _registry) external {
        require(msg.sender == admin, "Not admin");
        emit ERC8004RegistryUpdated(address(erc8004Registry), _registry);
        erc8004Registry = IERC8004Registry(_registry);
    }

    // ============ Internal Functions ============

    function _getReputation(address agent) internal view returns (uint256 score, bytes32 attestationId) {
        // TODO: Implement actual ERC-8004 read
        // For now, return mock data for testing
        // In production: return erc8004Registry.getReputation(agent);
        
        // Mock: return a score based on address for testing
        score = uint256(uint160(agent)) % 1000 * 1e18;
        attestationId = keccak256(abi.encodePacked(agent, block.timestamp));
    }

    function _encodeAttestation(
        address agent,
        uint256 score,
        uint64 timestamp,
        uint64 nonce,
        bytes32 attestationId
    ) internal view returns (bytes memory) {
        return abi.encode(
            agent,
            score,
            block.chainid, // source chain
            timestamp,
            nonce,
            attestationId
        );
    }
}
