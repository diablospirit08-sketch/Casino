// Places a demo bet as a player (second hardhat account) and waits for the
// operator to resolve it. Doubles as an end-to-end smoke test of the
// deploy -> commit -> bet -> reveal loop.
//
//   npx hardhat run scripts/bet.js --network localhost

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const WAGER = ethers.parseEther("0.1");
const ROLL_UNDER = 50; // ~50% win chance, pays 1.98x

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
  );
  const [, player] = await ethers.getSigners();
  const dice = (await ethers.getContractAt("VoltDice", deployment.dice)).connect(player);

  // Grab an available seed hash from the operator's published list.
  const hashes = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "seed-hashes.json"), "utf8")
  );
  if (hashes.length === 0) throw new Error("no seed hashes available — is the operator running?");
  const seedHash = hashes[0];
  const clientSeed = BigInt(ethers.hexlify(ethers.randomBytes(8)));

  const betId = await dice.nextBetId();
  console.log(
    `placing bet ${betId}: ${ethers.formatEther(WAGER)} ETH on roll < ${ROLL_UNDER} (seed ${seedHash.slice(0, 10)}…)`
  );
  await (await dice.placeBet(ROLL_UNDER, seedHash, clientSeed, { value: WAGER })).wait();

  // Wait for the operator to reveal.
  for (let i = 0; i < 30; i++) {
    if ((await dice.bets(betId)).settled) {
      const [resolved] = await dice.queryFilter(dice.filters.BetResolved(betId), 0);
      const { roll, payout } = resolved.args;
      console.log(
        payout === 0n
          ? `rolled ${roll} — lost the wager`
          : `rolled ${roll} — WON ${ethers.formatEther(payout)} ETH`
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("bet was not resolved within 30s — is the operator running?");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
