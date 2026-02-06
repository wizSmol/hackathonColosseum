// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMailbox
 * @notice Hyperlane Mailbox interface for cross-chain messaging
 */
interface IMailbox {
    /**
     * @notice Dispatch a message to a destination domain
     * @param destinationDomain The domain ID of the destination chain
     * @param recipientAddress The address of the recipient on the destination chain
     * @param messageBody The raw bytes content of the message
     * @return messageId The unique identifier of the dispatched message
     */
    function dispatch(
        uint32 destinationDomain,
        bytes32 recipientAddress,
        bytes calldata messageBody
    ) external payable returns (bytes32 messageId);

    /**
     * @notice Quote the required payment for dispatching a message
     * @param destinationDomain The domain ID of the destination chain
     * @param recipientAddress The address of the recipient
     * @param messageBody The message content
     * @return fee The required fee in native token
     */
    function quoteDispatch(
        uint32 destinationDomain,
        bytes32 recipientAddress,
        bytes calldata messageBody
    ) external view returns (uint256 fee);
}
