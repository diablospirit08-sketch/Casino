// End-to-end demo of the Stake-style flow, acting as a player:
// deposit on-chain -> ledger credit -> play (simulated via /settle) ->
// withdrawal voucher -> redeem on-chain. Requires a running node + cashier.
//
//   npx hardhat run scripts/cashier-demo.js --network localhost

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const CASHIER = "http://localhost:8484";
const DEPOSIT = ethers.parseEther("1");
const WIN = ethers.parseEther("0.5"); // pretend the player won this at dice

async function cashierBalance(addr) {
  const res = await fetch(`${CASHIER}/balance/${addr}`);
  return BigInt((await res.json()).balance);
}

async function waitForLedger(addr, expected) {
  for (let i = 0; i < 15; i++) {
    if ((await cashierBalance(addr)) === expected) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("ledger never reflected the expected balance — is the cashier running?");
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
  );
  const [, player] = await ethers.getSigners();
  const vault = (await ethers.getContractAt("VoltVault", deployment.vault)).connect(player);
  const start = await cashierBalance(player.address);

  console.log("1. depositing", ethers.formatEther(DEPOSIT), "ETH into the vault…");
  await (await vault.deposit({ value: DEPOSIT })).wait();
  await waitForLedger(player.address, start + DEPOSIT);
  console.log("   ledger credited:", ethers.formatEther(start + DEPOSIT), "ETH");

  console.log("2. playing off-chain — reporting a", ethers.formatEther(WIN), "ETH win…");
  await fetch(`${CASHIER}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: player.address, delta: WIN.toString() }),
  });
  const afterPlay = await cashierBalance(player.address);
  console.log("   ledger balance:", ethers.formatEther(afterPlay), "ETH");

  console.log("3. cashing out the full balance…");
  const res = await fetch(`${CASHIER}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: player.address, amount: afterPlay.toString() }),
  });
  const voucher = await res.json();
  if (voucher.error) throw new Error(`cashier refused: ${voucher.error}`);

  const before = await ethers.provider.getBalance(player.address);
  const tx = await vault.withdraw(voucher.amount, voucher.nonce, voucher.deadline, voucher.signature);
  const receipt = await tx.wait();
  const gas = receipt.gasUsed * receipt.gasPrice;
  const after = await ethers.provider.getBalance(player.address);

  console.log("   redeemed on-chain:", ethers.formatEther(after - before + gas), "ETH");
  console.log("   ledger balance now:", ethers.formatEther(await cashierBalance(player.address)), "ETH");
  console.log("OK — full deposit -> play -> withdraw loop works");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
