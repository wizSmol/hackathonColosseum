// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IERC8004Registry
 * @notice Interface for ERC-8004 reputation registry
 * @dev Placeholder - actual interface TBD based on ERC-8004 spec
 */
interface IERC8004Registry {
    /**
     * @notice Get an agent's reputation score
     * @param agent The agent's address
     * @return score The reputation score (scaled by 1e18)
     * @return attestationId Unique identifier of the attestation
     */
    function getReputation(address agent) external view returns (
        uint256 score,
        bytes32 attestationId
    );

    /**
     * @notice Check if an agent has any reputation
     * @param agent The agent's address
     * @return hasReputation True if agent has reputation > 0
     */
    function hasReputation(address agent) external view returns (bool hasReputation);
}
