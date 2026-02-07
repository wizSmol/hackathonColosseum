// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/evm/RepBridgeDispatcher.sol";

contract DeployRepBridge is Script {
    // Base Sepolia Hyperlane Mailbox
    address constant MAILBOX = 0x6966b0E55883d49BFB24539356a2f8A673E02039;
    
    // Mock ERC-8004 registry for testnet (we'll deploy our own)
    address public registry;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy mock registry first
        MockRegistry mockRegistry = new MockRegistry();
        registry = address(mockRegistry);
        
        // Deploy dispatcher
        RepBridgeDispatcher dispatcher = new RepBridgeDispatcher(MAILBOX, registry);
        
        console.log("MockRegistry deployed to:", registry);
        console.log("RepBridgeDispatcher deployed to:", address(dispatcher));
        
        vm.stopBroadcast();
    }
}

// Simple mock for testnet demo
contract MockRegistry is IERC8004Registry {
    mapping(address => uint256) public scores;
    
    function getReputation(address agent) external view returns (uint256 score, bytes32 attestationId) {
        return (100 ether, keccak256(abi.encodePacked(agent, block.timestamp)));
    }
    
    function hasReputation(address) external pure returns (bool) {
        return true;
    }
}
