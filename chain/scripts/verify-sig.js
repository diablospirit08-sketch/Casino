// Run from chain/ directory:
//   $env:BSC_PRIVATE_KEY="0x..."; node scripts/verify-sig.js
//
// Verifies that EIP-712 signing produces a signature that VoltVault can recover.
// If "signer == cashierSigner" prints true, the signing code is correct and
// the issue is in Supabase env vars. If false, the signing code itself is wrong.

const { ethers } = require('ethers');

async function main() {
  const privateKey = process.env.BSC_PRIVATE_KEY;
  if (!privateKey) throw new Error('Set BSC_PRIVATE_KEY env var to the deployer private key');

  const VAULT_ADDRESS = '0xAEB43910fD2c2AF8dcC2140BB5123A3f7944E88e';
  const CHAIN_ID      = 97;  // BSC Testnet
  const PLAYER        = '0x228558Fe47E0A136e7B189e13e77E6F9ac94007D';

  const signer = new ethers.Wallet(privateKey);
  console.log('Signer address   :', signer.address);
  console.log('Expected signer  : 0xD869E0FF79dFFcCfc3C760278Fed1FDf69031404');
  console.log('Keys match       :', signer.address.toLowerCase() === '0xd869e0ff79dffccfc3c760278fed1fdf69031404');
  console.log('');

  const domain = {
    name:              'VoltVault',
    version:           '1',
    chainId:           CHAIN_ID,
    verifyingContract: VAULT_ADDRESS,
  };
  const types = {
    Withdrawal: [
      { name: 'player',   type: 'address' },
      { name: 'amount',   type: 'uint256' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const amount   = 800000000000000n; // 0.0008 BNB in wei
  const nonce    = BigInt(ethers.hexlify(ethers.randomBytes(16)));
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const voucher  = { player: PLAYER, amount, nonce, deadline };

  const signature = await signer.signTypedData(domain, types, voucher);

  const domainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
  const recovered       = ethers.verifyTypedData(domain, types, voucher, signature);

  console.log('Domain separator :', domainSeparator);
  console.log('Signature        :', signature);
  console.log('Recovered        :', recovered);
  console.log('✅ MATCH         :', recovered.toLowerCase() === signer.address.toLowerCase());

  if (recovered.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('\n❌ Signing is broken — recovered address does not match signer');
    process.exit(1);
  }

  console.log('\n--- calldata preview ---');
  const WITHDRAW_SELECTOR = '0xfe55892d';
  function pad32(hex){ return hex.replace(/^0x/,'').padStart(64,'0'); }
  const sig = signature.replace(/^0x/,'');
  const sigLen = sig.length / 2;
  const sigPadded = sig.padEnd(Math.ceil(sigLen/32)*64,'0');
  const calldata = WITHDRAW_SELECTOR
    + pad32(amount.toString(16))
    + pad32(nonce.toString(16))
    + pad32(deadline.toString(16))
    + pad32((0x80).toString(16))
    + pad32(sigLen.toString(16))
    + sigPadded;
  console.log('length (bytes)   :', calldata.replace('0x','').length/2 + 4);
  console.log('first 10 bytes   :', calldata.slice(0, 24));
}

main().catch(e => { console.error(e); process.exit(1); });
