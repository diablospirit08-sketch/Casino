// Gives any address play ETH on the LOCAL hardhat chain, so you can connect
// your own MetaMask account instead of importing a test key.
//
//   npm run faucet -- 0xYourAddress
//
// Plain node script (not hardhat run, which swallows CLI args). Only works
// against the local node — hardhat_setBalance does not exist on real networks.

const { ethers } = require("ethers");

const RPC = "http://127.0.0.1:8545";
const AMOUNT = ethers.parseEther("100");

async function main() {
  const address = process.argv[2];
  if (!ethers.isAddress(address)) {
    console.error("usage: npm run faucet -- 0xYourAddress");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(RPC);
  await provider.send("hardhat_setBalance", [address, "0x" + AMOUNT.toString(16)]);
  console.log(`${address} now has ${ethers.formatEther(AMOUNT)} ETH on the local chain`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
