'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';

// RepBridge Dispatcher ABI (minimal)
const DISPATCHER_ABI = [
  {
    name: 'bridgeReputation',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'recipient', type: 'bytes32' }
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }]
  },
  {
    name: 'quoteDispatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'recipient', type: 'bytes32' }
    ],
    outputs: [{ name: 'fee', type: 'uint256' }]
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// Solana domain ID in Hyperlane
const SOLANA_DOMAIN = 1399811149;

// Deployed contract addresses (Base Sepolia)
const DISPATCHER_ADDRESS = '0xe86D40775F4F6394742C091E83829ad334Da7c45' as `0x${string}`;
const MOCK_REGISTRY_ADDRESS = '0x02FEA123Dde4561cdA0dd08D4Cf26d5b37Cc095C' as `0x${string}`;

export default function Home() {
  const { address, isConnected } = useAccount();
  const [solanaAddress, setSolanaAddress] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Convert Solana address to bytes32
  const recipientBytes32 = solanaAddress 
    ? `0x${Buffer.from(solanaAddress).toString('hex').padStart(64, '0')}` as `0x${string}`
    : '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

  // Get quote for bridging
  const { data: quote } = useReadContract({
    address: DISPATCHER_ADDRESS,
    abi: DISPATCHER_ABI,
    functionName: 'quoteDispatch',
    args: [SOLANA_DOMAIN, recipientBytes32],
  });

  // Get user's nonce
  const { data: nonce } = useReadContract({
    address: DISPATCHER_ADDRESS,
    abi: DISPATCHER_ABI,
    functionName: 'nonces',
    args: [address || '0x0'],
  });

  // Bridge transaction
  const { writeContract, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleBridge = async () => {
    if (!solanaAddress || !quote) return;
    
    setTxStatus('pending');
    try {
      writeContract({
        address: DISPATCHER_ADDRESS,
        abi: DISPATCHER_ABI,
        functionName: 'bridgeReputation',
        args: [SOLANA_DOMAIN, recipientBytes32],
        value: quote,
      });
    } catch (e) {
      setTxStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            RepBridge
          </h1>
          <p className="text-gray-400 text-lg">
            Bridge your reputation from Base to Solana
          </p>
          <p className="text-gray-500 text-sm mt-2">
            ERC-8004 → Hyperlane → Sol-8004
          </p>
        </div>

        {/* Connect Wallet */}
        <div className="flex justify-center mb-8">
          <ConnectButton />
        </div>

        {isConnected && (
          <div className="space-y-6">
            {/* User Info Card */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Your Reputation</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Address:</span>
                  <p className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Bridges Sent:</span>
                  <p className="font-mono">{nonce?.toString() || '0'}</p>
                </div>
              </div>
            </div>

            {/* Bridge Form */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Bridge to Solana</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Destination Solana Address
                  </label>
                  <input
                    type="text"
                    value={solanaAddress}
                    onChange={(e) => setSolanaAddress(e.target.value)}
                    placeholder="Enter your Solana address..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {quote && (
                  <div className="text-sm text-gray-400">
                    Estimated fee: {formatEther(quote)} ETH
                  </div>
                )}

                <button
                  onClick={handleBridge}
                  disabled={!solanaAddress || isConfirming}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all"
                >
                  {isConfirming ? 'Bridging...' : 'Bridge Reputation →'}
                </button>

                {isSuccess && (
                  <div className="text-green-400 text-center">
                    ✓ Reputation bridged! Check Solana in ~15 minutes.
                  </div>
                )}
              </div>
            </div>

            {/* How it Works */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
              <h3 className="font-semibold mb-3">How it works</h3>
              <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                <li>Your ERC-8004 reputation is read from Base</li>
                <li>Hyperlane sends a cross-chain message to Solana</li>
                <li>Solana program receives and stores your reputation</li>
                <li>Use your bridged reputation in Solana dApps!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Built by Wiz & the AIFrens team</p>
          <p className="mt-1">Colosseum Hackathon 2026</p>
        </div>
      </div>
    </main>
  );
}
