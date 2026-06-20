/**
 * VoltVault on-chain integration
 *
 * Deposit flow:
 *   Player calls VoltVault.deposit() on BSC
 *   → contract emits Deposited(player, amount)
 *   → Alchemy fires webhook to POST /api/deposits/webhook
 *   → parseDepositedLog() extracts player + amount
 *   → we look up which user owns that wallet address
 *   → credit their off-chain ledger
 *
 * Withdrawal flow:
 *   User requests withdrawal in the frontend
 *   → backend debits ledger + calls signWithdrawal()
 *   → returns EIP-712 signature
 *   → frontend calls VoltVault.withdraw(amount, nonce, deadline, sig) on-chain
 *   → contract verifies signature and pays the player
 */

import { Wallet, keccak256, toUtf8Bytes, AbiCoder, getAddress } from 'ethers';

// keccak256("Deposited(address,uint256)")
export const DEPOSITED_TOPIC = keccak256(toUtf8Bytes('Deposited(address,uint256)'));

// EIP-712 types (must match VoltVault.sol exactly)
const WITHDRAWAL_TYPES = {
  Withdrawal: [
    { name: 'player',   type: 'address' },
    { name: 'amount',   type: 'uint256' },
    { name: 'nonce',    type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const CHAIN_IDS = {
  bsc:         56,
  bsc_testnet: 97,
  mainnet:     1,
};

function getDomain(network, vaultAddress) {
  const chainId = CHAIN_IDS[network];
  if (!chainId) throw new Error(`Unknown network: ${network}`);
  return {
    name:              'VoltVault',
    version:           '1',
    chainId,
    verifyingContract: vaultAddress,
  };
}

function getCashierWallet() {
  const pk = process.env.CASHIER_PRIVATE_KEY;
  if (!pk) throw new Error('CASHIER_PRIVATE_KEY is not set');
  return new Wallet(pk);
}

/**
 * Sign an EIP-712 withdrawal voucher.
 * Returns the hex signature the player passes to VoltVault.withdraw().
 */
export async function signWithdrawal({ player, amountWei, nonce, deadline, network }) {
  const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS;
  if (!vaultAddress) throw new Error('VAULT_CONTRACT_ADDRESS is not set');

  const signer  = getCashierWallet();
  const domain  = getDomain(network, vaultAddress);
  const message = {
    player,
    amount:   BigInt(amountWei),
    nonce:    BigInt(nonce),
    deadline: BigInt(deadline),
  };

  return signer.signTypedData(domain, WITHDRAWAL_TYPES, message);
}

/** The address the cashier wallet uses — must match the cashierSigner
 *  argument passed to the VoltVault constructor at deploy time. */
export function cashierAddress() {
  return getCashierWallet().address;
}

/**
 * Parse a raw EVM log for the Deposited(address,uint256) event.
 * Returns { player, amountWei } or null if not a Deposited log.
 *
 * Log shape (from Alchemy webhook or ethers provider):
 *   log.topics[0] = event topic hash
 *   log.topics[1] = player address (indexed, 32-byte padded)
 *   log.data      = abi-encoded uint256 amount
 */
export function parseDepositedLog(log) {
  if (!log?.topics?.[0]) return null;
  if (log.topics[0].toLowerCase() !== DEPOSITED_TOPIC.toLowerCase()) return null;

  try {
    // topics[1] is the indexed player address, padded to 32 bytes
    const playerRaw = log.topics[1];
    const player    = getAddress('0x' + playerRaw.slice(26)); // checksum

    const [amountWei] = AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);

    return { player, amountWei: amountWei.toString() };
  } catch {
    return null;
  }
}

/** Convert wei to BNB (18 decimals) */
export function weiBnb(amountWei) {
  return parseFloat((BigInt(amountWei) * 100000000n / 1000000000000000000n).toString()) / 100000000;
}
