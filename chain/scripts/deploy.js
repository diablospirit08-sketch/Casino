// Deploys VoltBankroll + VoltDice to the target network, whitelists the game,
// funds the vault, and records the addresses in chain/deployment.json for the
// operator and frontend to pick up.
//
//   npx hardhat run scripts/deploy.js --network localhost

const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  // Local chain has infinite play money; on a real testnet the house funds
  // come out of the deployer's faucet ETH, so default small (override with
  // $env:HOUSE_FUNDS_ETH).
  const isBSC = chainId === 56 || chainId === 97;
  const nativeSymbol = isBSC ? "BNB" : "ETH";
  const HOUSE_FUNDS = ethers.parseEther(
    chainId === 31337 ? "1000" : process.env.HOUSE_FUNDS_BNB || process.env.HOUSE_FUNDS_ETH || "0.05"
  );

  const bankroll = await ethers.deployContract("VoltBankroll");
  await bankroll.waitForDeployment();

  const dice = await ethers.deployContract("VoltDice", [await bankroll.getAddress()]);
  await dice.waitForDeployment();

  await (await bankroll.setGame(await dice.getAddress(), true)).wait();
  await (await bankroll.deposit({ value: HOUSE_FUNDS })).wait();

  // Cashier vault for the Stake-style flow: deployer doubles as the voucher
  // signer on the local network. Pre-fund it so withdrawals of winnings have
  // house liquidity beyond raw player deposits.
  const vault = await ethers.deployContract("VoltVault", [deployer.address]);
  await vault.waitForDeployment();
  await (await deployer.sendTransaction({ to: await vault.getAddress(), value: HOUSE_FUNDS })).wait();

  const deployment = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    bankroll: await bankroll.getAddress(),
    dice: await dice.getAddress(),
    vault: await vault.getAddress(),
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("VoltBankroll:", deployment.bankroll);
  console.log("VoltDice:    ", deployment.dice);
  console.log("VoltVault:   ", deployment.vault);
  console.log("Bankroll funded with", ethers.formatEther(HOUSE_FUNDS), nativeSymbol);
  console.log("Addresses written to chain/deployment.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
